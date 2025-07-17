const xml2js = require("xml2js");

const Environment = require("./environment");
const util = require("./util");
const logger = require("./logger");
const {findCartridges} = require("./code-helpers");

/**
 * @typedef {Object} LogFile
 * @property {string} name
 * @property {Date} lastModified
 */

/**
 * Get the logs from the instance
 *
 * @param env {Environment}
 * @return {Promise<LogFile[]>}
 */
async function getLogs(env) {
    var resp = await env.webdav({
        url: "Logs/",
        method: "PROPFIND",
    });
    var xml = await xml2js.parseStringPromise(resp.data);

    return xml.multistatus.response
        .map((_resp) => {
            let prop = _resp.propstat[0].prop[0];
            let name = prop.displayname[0];
            // getlastmodified: Array(1) [Sat, 04 Dec 2021 02:32:05 GMT]
            let _lastModified = prop.getlastmodified[0];
            if (prop.resourcetype[0].collection) {
                // is dir
                return;
            }
            let lastModified = new Date(Date.parse(_lastModified));
            return {
                name,
                lastModified,
            };
        })
        .filter((_file) => !!_file);
}

/**
 * Normalizes log entries by replacing all cartridge file paths
 * with their local paths.
 * @param logEntries {string[]}
 * @param cartridges {import("./code-helpers").CartridgeMapping[]}
 * @returns {string[]} normalized log entries
 */
function normalizePaths(logEntries, cartridges) {
    for (let i = 0; i < logEntries.length; i++) {
        if (!logEntries[i]) {
            continue;
        }
        for (let cartridge of cartridges) {
            let relativePath = cartridge.src.replace(process.cwd(), "");
            relativePath = relativePath.replace(/^\//, "");
            
            // Escape cartridge name for regex
            const escapedName = cartridge.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Pattern 1: Replace paths in parentheses (e.g., "(app_mysite/cartridge/...)")
            let reParens = new RegExp(
                `\\(${escapedName}/([^\\)]+)\\)`,
                "g"
            );
            
            // Pattern 2: Replace paths in quotes (e.g., "'app_mysite/cartridge/...'")
            let reQuotes = new RegExp(
                `(['"\`])${escapedName}/([^'"\`]+)\\1`,
                "g"
            );
            
            // Pattern 3: Replace paths with "at " prefix (e.g., "at app_mysite/cartridge/...")
            let reAt = new RegExp(
                `(\\bat\\s+)${escapedName}/([^\\s:]+)`,
                "g"
            );
            
            try {
                // Apply all replacements - replace cartridge name with local path
                logEntries[i] = logEntries[i]
                    .replace(reParens, `(${relativePath}/$1)`)
                    .replace(reQuotes, `$1${relativePath}/$2$1`)
                    .replace(reAt, `$1${relativePath}/$2`);
            } catch (e) {
                logger.error(e);
                console.log(logEntries[i]);
            }
        }
    }
    return logEntries;
}

/**
 *
 * @param filters {string[]}
 * @param task {boolean} normalize file paths for tasks.json
 * @return {Promise<void>}
 */
async function tailCommand(filters, task = false) {
    /* @type Environment */
    var env = new Environment();

    var contentPositions = {};
    var cartridges = [];
    if (task) {
        cartridges = findCartridges();
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        var logs = await getLogs(env);
        for (const filter of filters) {
            var targetLogs = logs.filter(
                (l) => l.name.substring(0, filter.length) === filter,
            );
            if (!targetLogs || !targetLogs.length) {
                continue;
            }
            targetLogs.sort(
                (a, b) => a.lastModified.getTime() - b.lastModified.getTime(),
            );
            var targetLog = targetLogs.pop();

            // TODO: this probably doesn't support multi-byte utf-8 chars; fix to calculate actual byte offset
            var currentPosition = contentPositions[targetLog.name];
            if (currentPosition) {
                try {
                    var resp = await env.webdav.get(`Logs/${targetLog.name}`, {
                        headers: {
                            range: `bytes=${currentPosition}-`,
                        },
                    });
                } catch (e) {
                    if (e.response.status === 416) {
                        continue;
                    } else {
                        throw e;
                    }
                }
                // TODO better regexp split
                var logEntries = resp.data.split(/(?<=^)\[/m).filter(
                    (entry) => entry !== "",
                );
                contentPositions[targetLog.name] =
                    resp.data.length + currentPosition;
            } else {
                // initial request
                resp = await env.webdav.get(`Logs/${targetLog.name}`);
                // get only the last log entry
                logEntries = [resp.data.split(/(?<=^)\[/m).filter((entry) => entry !== "").pop()];
                contentPositions[targetLog.name] = resp.data.length;
            }

            if (task) {
                normalizePaths(logEntries, cartridges);
            }

            if (resp.data.length) {
                console.log("-".repeat(targetLog.name.length + 6));
                logger.info(targetLog.name);
                console.log("-".repeat(targetLog.name.length + 6));
                // kindy hacky
                console.log(logEntries.map((e) => "[" + e).join(""));
                console.log("");
            }
        }
        await util.sleep(3000);
    }
}

/**
 * Get recent log entries from specific log files
 * @param {Environment} env
 * @param {string[]} filters - log file prefixes to filter by
 * @param {number} maxEntries - maximum number of entries to return
 * @param {boolean} normalizePathsFlag - whether to normalize cartridge paths
 * @returns {Promise<{logName: string, entries: string[]}[]>}
 */
async function getRecentLogs(env, filters, maxEntries = 50, normalizePathsFlag = true) {
    const logs = await getLogs(env);
    const results = [];
    const cartridges = normalizePathsFlag ? findCartridges() : [];
    
    for (const filter of filters) {
        const targetLogs = logs.filter(
            (l) => l.name.substring(0, filter.length) === filter
        );
        if (!targetLogs || !targetLogs.length) {
            continue;
        }
        targetLogs.sort(
            (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
        );
        const targetLog = targetLogs[0];
        
        try {
            const resp = await env.webdav.get(`Logs/${targetLog.name}`);
            let logEntries = resp.data.split(/(?<=^)\[/m).filter(
                (entry) => entry !== ""
            );
            
            // Get only the most recent entries
            if (logEntries.length > maxEntries) {
                logEntries = logEntries.slice(-maxEntries);
            }
            
            if (normalizePathsFlag && cartridges.length > 0) {
                logEntries = normalizePaths(logEntries, cartridges);
            }
            
            results.push({
                logName: targetLog.name,
                entries: logEntries.map(e => '[' + e)
            });
        } catch (e) {
            logger.error(`Failed to fetch log ${targetLog.name}:`, e.message);
        }
    }
    
    return results;
}

module.exports = {
    command: "tail",
    desc: "watch instance logs",
    builder: (yargs) =>
        yargs.option("f", {
            alias: "filter",
            default: ["error-", "customerror-"],
            describe: "log prefixes to watch",
            type: "array",
        }).option("task", {
            alias: "normalize",
            describe: "normalize file paths",
            type: "boolean",
            default: false,
        }).group(["f", "task"], "Tail"),
    handler: async (argv) => await tailCommand(argv.filter, argv.task),
    // Export internal functions for reuse
    getLogs,
    normalizePaths,
    getRecentLogs
};
