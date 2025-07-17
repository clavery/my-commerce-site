const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const Environment = require('./environment');
const { getRecentLogs } = require('./command-tail');
const { siteArchiveExport } = require('./jobs');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');

/**
 * Creates and starts an MCP server
 */
async function startMCPServer() {
    const server = new McpServer({
        name: 'b2c-tools-mcp-server',
        version: '1.0.0'
    });

    // Register all sites resource
    server.registerResource(
        'sites',
        'b2c://sites',
        {
            title: 'B2C Sites',
            description: 'List all configured B2C sites with their details'
        },
        async (uri) => {
            try {
                const env = new Environment();
                const sites = await env.ocapi.get('sites?select=(**)');
                
                const siteData = {};
                for (const siteInfo of sites.data.data) {
                    siteData[siteInfo.id] = {
                        name: siteInfo.display_name || siteInfo.id,
                        description: siteInfo.description,
                        cartridges: siteInfo.cartridges ? siteInfo.cartridges.split(':') : [],
                        enabled: siteInfo.enabled || false
                    };
                }

                return {
                    contents: [{
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(siteData, null, 2)
                    }]
                };
            } catch (error) {
                throw new Error(`Failed to fetch sites data: ${error.message}`);
            }
        }
    );

    // Register cartridge path resource for specific site using ResourceTemplate
    server.registerResource(
        'site-cartridge-path',
        new ResourceTemplate('b2c://sites/{siteId}/cartridge-path', { list: undefined }),
        {
            title: 'Site Cartridge Path',
            description: 'Get the cartridge path for a specific B2C site'
        },
        // @ts-ignore wtf?
        async (uri, { siteId }) => {
            try {
                if (!siteId) {
                    throw new Error('siteId parameter is required');
                }

                const env = new Environment();
                const site = await env.ocapi.get(`sites/${siteId}?select=(**)`);
                
                if (!site.data) {
                    throw new Error(`Site '${siteId}' not found`);
                }

                const cartridges = site.data.cartridges ? site.data.cartridges.split(':') : [];

                return {
                    contents: [{
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify({
                            siteId: siteId,
                            siteName: site.data.name || siteId,
                            cartridges: cartridges
                        }, null, 2)
                    }]
                };
            } catch (error) {
                throw new Error(`Failed to fetch cartridge data for site: ${error.message}`);
            }
        }
    );

    // Register tool for fetching recent error logs
    server.registerTool(
        'get-error-logs',
        {
            title: 'Get Error Logs',
            description: 'Fetch recent error logs from the B2C instance',
            inputSchema: {
                maxEntries: z.number().default(5).describe('Maximum number of log entries to return'),
                filters: z.array(z.string()).default(['error-', 'customerror-']).describe('Log file prefixes to filter'),
                includeAllLogs: z.boolean().default(false).describe('Include all logs, not just those with local project paths')
            }
        },
        async (params) => {
            try {
                const env = new Environment();
                const maxEntries = params.maxEntries || 5;
                const filters = params.filters || ['error-', 'customerror-'];
                const includeAllLogs = params.includeAllLogs || false;
                
                /**
                 * Truncate a log entry to reduce context size
                 * @param {string} entry - The log entry to truncate
                 * @returns {string} - The truncated entry
                 */
                function truncateLogEntry(entry) {
                    const lines = entry.split('\n');
                    const maxLines = 10;
                    const maxStackTraceLines = 5;
                    
                    // Find where the stack trace starts (usually after the error message)
                    let stackTraceStart = -1;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].trim().match(/^\s*at\s+/)) {
                            stackTraceStart = i;
                            break;
                        }
                    }
                    
                    if (stackTraceStart === -1) {
                        // No stack trace, just truncate to maxLines
                        if (lines.length > maxLines) {
                            return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
                        }
                        return entry;
                    }
                    
                    // Has stack trace: keep error message + limited stack trace
                    const errorLines = lines.slice(0, stackTraceStart);
                    const stackLines = lines.slice(stackTraceStart, stackTraceStart + maxStackTraceLines);
                    const totalLines = errorLines.concat(stackLines);
                    
                    if (lines.length > totalLines.length) {
                        return totalLines.join('\n') + '\n... (truncated)';
                    }
                    return totalLines.join('\n');
                }
                
                const logResults = await getRecentLogs(env, filters, maxEntries, true);
                
                /**
                 * Check if a log entry contains normalized local paths
                 * @param {string} entry - The log entry to check
                 * @param {Array} cartridges - The cartridge mappings to check against
                 * @returns {boolean} - True if entry contains local project paths
                 */
                function hasLocalPaths(entry, cartridges) {
                    // Check if any of our local cartridge paths appear in the entry
                    for (const cartridge of cartridges) {
                        let relativePath = cartridge.src.replace(process.cwd(), "");
                        relativePath = relativePath.replace(/^\//, "");
                        
                        // Look for the local path in various contexts
                        const patterns = [
                            new RegExp(`\\(${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}/[^\\)]+\\)`),  // (local/path/...)
                            new RegExp(`at\\s+${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}/[^\\s:]+`),  // at local/path/...
                            new RegExp(`['"\`]${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}/[^'"\`]+['"\`]`)  // "local/path/..."
                        ];
                        
                        if (patterns.some(pattern => entry.match(pattern))) {
                            return true;
                        }
                    }
                    return false;
                }
                
                // Get cartridge mappings for path detection
                const { findCartridges } = require('./code-helpers');
                const cartridges = findCartridges();
                
                // Process and format the results
                const formattedResults = [];
                for (const logResult of logResults) {
                    let entries = logResult.entries;
                    
                    // By default, only include entries with local project paths
                    if (!includeAllLogs) {
                        entries = entries.filter(entry => hasLocalPaths(entry, cartridges));
                    }
                    
                    // Truncate each entry to reduce size
                    entries = entries.map(entry => truncateLogEntry(entry));
                    
                    if (entries.length > 0) {
                        formattedResults.push({
                            logFile: logResult.logName,
                            entries: entries.slice(0, maxEntries) // Extra safety limit
                        });
                    }
                }
                
                // Create a compact response
                const response = {
                    count: formattedResults.reduce((sum, log) => sum + log.entries.length, 0),
                    logs: formattedResults
                };
                
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(response, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: `Failed to fetch error logs: ${error.message}`
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Register tool for exporting site data
    server.registerTool(
        'export-b2c-site-data',
        {
            title: 'Export B2C Site Data',
            description: 'Export site and global data from B2C instance',
            inputSchema: {
                outputPath: z.string().default('./tmp').describe('Output directory path for extracted files'),
                dataUnits: z.object({
                    catalog_static_resources: z.record(z.boolean()).optional(),
                    catalogs: z.record(z.boolean()).optional(),
                    customer_lists: z.record(z.boolean()).optional(),
                    inventory_lists: z.record(z.boolean()).optional(),
                    library_static_resources: z.record(z.boolean()).optional(),
                    libraries: z.record(z.boolean()).optional(),
                    price_books: z.record(z.boolean()).optional(),
                    sites: z.record(z.object({
                        ab_tests: z.boolean().optional(),
                        active_data_feeds: z.boolean().optional(),
                        all: z.boolean().optional(),
                        cache_settings: z.boolean().optional(),
                        campaigns_and_promotions: z.boolean().optional(),
                        content: z.boolean().optional(),
                        coupons: z.boolean().optional(),
                        custom_objects: z.boolean().optional(),
                        customer_cdn_settings: z.boolean().optional(),
                        customer_groups: z.boolean().optional(),
                        distributed_commerce_extensions: z.boolean().optional(),
                        dynamic_file_resources: z.boolean().optional(),
                        gift_certificates: z.boolean().optional(),
                        ocapi_settings: z.boolean().optional(),
                        payment_methods: z.boolean().optional(),
                        payment_processors: z.boolean().optional(),
                        redirect_urls: z.boolean().optional(),
                        search_settings: z.boolean().optional(),
                        shipping: z.boolean().optional(),
                        site_descriptor: z.boolean().optional(),
                        site_preferences: z.boolean().optional(),
                        sitemap_settings: z.boolean().optional(),
                        slots: z.boolean().optional(),
                        sorting_rules: z.boolean().optional(),
                        source_codes: z.boolean().optional(),
                        static_dynamic_alias_mappings: z.boolean().optional(),
                        stores: z.boolean().optional(),
                        tax: z.boolean().optional(),
                        url_rules: z.boolean().optional()
                    })).optional(),
                    global_data: z.object({
                        access_roles: z.boolean().optional(),
                        all: z.boolean().optional(),
                        csc_settings: z.boolean().optional(),
                        csrf_whitelists: z.boolean().optional(),
                        custom_preference_groups: z.boolean().optional(),
                        custom_quota_settings: z.boolean().optional(),
                        custom_types: z.boolean().optional(),
                        geolocations: z.boolean().optional(),
                        global_custom_objects: z.boolean().optional(),
                        job_schedules: z.boolean().optional(),
                        job_schedules_deprecated: z.boolean().optional(),
                        locales: z.boolean().optional(),
                        meta_data: z.boolean().optional(),
                        oauth_providers: z.boolean().optional(),
                        ocapi_settings: z.boolean().optional(),
                        page_meta_tags: z.boolean().optional(),
                        preferences: z.boolean().optional(),
                        price_adjustment_limits: z.boolean().optional(),
                        services: z.boolean().optional(),
                        sorting_rules: z.boolean().optional(),
                        static_resources: z.boolean().optional(),
                        system_type_definitions: z.boolean().optional(),
                        users: z.boolean().optional(),
                        webdav_client_permissions: z.boolean().optional()
                    }).optional()
                }).describe('Export data units configuration')
            }
        },
        async (params) => {
            try {
                const env = new Environment();
                const dataUnits = params.dataUnits;
                const outputPath = params.outputPath || './tmp';
                
                const now = (new Date()).toISOString().replace(/[:.-]+/g, '');
                const archiveDir = `${now}_export`;
                const zipFilename = `${archiveDir}.zip`;
                
                // Ensure output directory exists
                await fs.ensureDir(outputPath);
                
                // Export the site archive
                const data = await siteArchiveExport(env, dataUnits, zipFilename);
                
                // Extract the zip contents
                const zip = new AdmZip(data);
                
                // Extract all files to the output directory
                await zip.extractAllToAsync(outputPath, true);
                
                // Get the extracted files for summary
                const extractPath = path.join(outputPath, archiveDir);
                const entries = zip.getEntries();
                
                // Create a summary of exported files
                const exportedFiles = entries.map(entry => {
                    return {
                        path: entry.entryName,
                        size: entry.header.size
                    };
                });
                
                // Get total size
                const totalSize = entries.reduce((sum, entry) => sum + entry.header.size, 0);
                
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            outputPath: extractPath,
                            archiveName: archiveDir,
                            totalFiles: exportedFiles.length,
                            totalSize: totalSize,
                            exportedDataUnits: dataUnits,
                            files: exportedFiles.slice(0, 20), // Show first 20 files
                            message: `Export completed successfully. Files extracted to ${extractPath}`
                        }, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: `Failed to export site data: ${error.message}`
                        }, null, 2)
                    }]
                };
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Keep the server running
    process.on('SIGINT', async () => {
        await server.close();
        process.exit(0);
    });
}

module.exports = {
    command: 'mcp',
    desc: 'start MCP server for Model Context Protocol integration',
    builder: (yargs) => yargs,
    handler: async () => {
        try {
            await startMCPServer();
        } catch (error) {
            process.stderr.write(`Failed to start MCP server: ${error.message}\n`);
            process.exit(1);
        }
    }
};
