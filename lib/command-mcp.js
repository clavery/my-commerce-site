const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const Environment = require('./environment');
const { getRecentLogs } = require('./command-tail');

/**
 * Creates and starts an MCP server
 */
async function startMCPServer() {
    const server = new McpServer({
        name: 'b2c-tools-mcp-server',
        version: '1.0.0'
    });

    // Register all sites resource
    server.resource(
        'b2c-sites',
        'b2c://sites',
        async (uri) => {
            try {
                const env = new Environment();
                const sites = await env.ocapi.get('sites?select=(**)');
                
                const siteData = {};
                for (const siteInfo of sites.data.data) {
                    siteData[siteInfo.id] = {
                        name: siteInfo.name || siteInfo.id,
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
    server.resource(
        'b2c-site-cartridge-path',
        new ResourceTemplate('b2c://sites/{siteId}/cartridge-path', {
            list: async () => ({ resources: [] })
        }),
        async (uri, params) => {
            try {
                const siteId = params.siteId;
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

    // Alternative approach: Register a resource that handles all site-specific queries
    // This approach manually parses the URI without using ResourceTemplate
    server.resource(
        'b2c-site-data',
        'b2c://site-data',
        async (uri) => {
            try {
                // Parse query parameters from the URI
                const url = new URL(uri.href);
                const siteId = url.searchParams.get('siteId');
                const dataType = url.searchParams.get('type') || 'info';

                if (!siteId) {
                    throw new Error('siteId query parameter is required');
                }

                const env = new Environment();
                const site = await env.ocapi.get(`sites/${siteId}?select=(**)`);
                
                if (!site.data) {
                    throw new Error(`Site '${siteId}' not found`);
                }

                let responseData;
                switch (dataType) {
                    case 'cartridges':
                        responseData = {
                            siteId: siteId,
                            cartridges: site.data.cartridges ? site.data.cartridges.split(':') : []
                        };
                        break;
                    case 'info':
                    default:
                        responseData = {
                            siteId: siteId,
                            name: site.data.name || siteId,
                            description: site.data.description,
                            enabled: site.data.enabled || false,
                            cartridges: site.data.cartridges ? site.data.cartridges.split(':') : []
                        };
                        break;
                }

                return {
                    contents: [{
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(responseData, null, 2)
                    }]
                };
            } catch (error) {
                throw new Error(`Failed to fetch site data: ${error.message}`);
            }
        }
    );

    // Register tool for fetching recent error logs
    server.tool(
        'get-error-logs',
        'Fetch recent error logs from the B2C instance',
        {
            type: 'object',
            properties: {
                maxEntries: {
                    type: 'number',
                    description: 'Maximum number of log entries to return (default: 5)',
                    default: 5
                },
                filters: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Log file prefixes to filter (default: ["error-", "customerror-"])',
                    default: ['error-', 'customerror-']
                },
                includeAllLogs: {
                    type: 'boolean',
                    description: 'Include all logs, not just those with local project paths (default: false)',
                    default: false
                }
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
                    
                    // Only include error entries (skip INFO, DEBUG, etc)
                    entries = entries.filter(entry => {
                        return entry.match(/\bERROR\b/i) || entry.match(/\bFATAL\b/i);
                    });
                    
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
