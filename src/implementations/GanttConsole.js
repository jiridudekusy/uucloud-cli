const Console = require('../interfaces/Console');
const Gantt = require("../misc/gantt");

/**
 * Real implementation of Console using Node.js console for Gantt charts
 */
class GanttConsole extends Console {

    /**
     * Create a new GanttConsole instance
     * @param {string} appLogStoreUri - App log store URI
     * @param {string} oidcUri - OIDC URI
     * @param {Object} dependencies - Optional dependencies for testing
     */
    constructor(appLogStoreUri, oidcUri, dependencies = {}) {
       super();
       
       // Prepare dependencies for Gantt
       const ganttDependencies = {
           appLogStoreUri,
           oidcUri,
           console: this,
           uuAppLogStoreClientFactory: dependencies.uuAppLogStoreClientFactory,
           oidcTokenProviderFactory: dependencies.oidcTokenProviderFactory
       };
       
       this._gantt = new Gantt(ganttDependencies);
       this._logs = [];
    }
    
    /**
     * Log a message to standard output
     * @param {string} message - Message to log
     */
    log(message) {
       if (Array.isArray(message)) {
           this._logs.push(...message);
       } else {
           console.log(message);
       }
    }

    /**
     * Log an error message to standard error
     * @param {string} message - Error message to log
     */
    error(message) {
        if (Array.isArray(message)) {
            this._logs.push(...message);
        } else {
            console.error(message);
        }
    }

    /**
     * Log info message to standard output
     * @param {string} message - Info message to log
     */
    info(message) {
        if (Array.isArray(message)) {
            this._logs.push(...message);
        } else {
            console.info(message);
        }
    }

    /**
     * Log a warning message to standard output
     * @param {string} message - Warning message to log
     */
    warn(message) {
        if (Array.isArray(message)) {
            this._logs.push(...message);
        } else {
            console.warn(message);
        }
    }

    /**
     * Finish processing and render the Gantt chart
     * @returns {Promise<void>}
     */
    async finish() {
        //find out proper chartWidth
        const width = process.stdout.columns - Gantt.config.defaultWidthOffset;
        await this._gantt.renderGantt(this._logs, Gantt.modes.INTERACTIVE, width);
    }
}

module.exports = GanttConsole;