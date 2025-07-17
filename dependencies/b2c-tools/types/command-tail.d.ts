declare namespace _exports {
    export { LogFile };
}
declare namespace _exports {
    export let command: string;
    export let desc: string;
    export function builder(yargs: any): any;
    export function handler(argv: any): Promise<void>;
    export { getLogs };
    export { normalizePaths };
    export { getRecentLogs };
}
export = _exports;
type LogFile = {
    name: string;
    lastModified: Date;
};
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
declare function getLogs(env: Environment): Promise<LogFile[]>;
/**
 * Normalizes log entries by replacing all cartridge file paths
 * with their local paths.
 * @param logEntries {string[]}
 * @param cartridges {import("./code-helpers").CartridgeMapping[]}
 * @returns {string[]} normalized log entries
 */
declare function normalizePaths(logEntries: string[], cartridges: import("./code-helpers").CartridgeMapping[]): string[];
/**
 * Get recent log entries from specific log files
 * @param {Environment} env
 * @param {string[]} filters - log file prefixes to filter by
 * @param {number} maxEntries - maximum number of entries to return
 * @param {boolean} normalizePathsFlag - whether to normalize cartridge paths
 * @returns {Promise<{logName: string, entries: string[]}[]>}
 */
declare function getRecentLogs(env: Environment, filters: string[], maxEntries?: number, normalizePathsFlag?: boolean): Promise<{
    logName: string;
    entries: string[];
}[]>;
import Environment = require("./environment");
//# sourceMappingURL=command-tail.d.ts.map