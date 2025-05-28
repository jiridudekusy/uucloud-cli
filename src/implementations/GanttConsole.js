const Console = require('../interfaces/Console');
const Gantt = require("../misc/gantt");

/**
 * Real implementation of Console using Node.js console
 */
class GanttConsole extends Console {

    constructor() {
       super();
       this._logs=[];
    }
    /**
     * Log a message to standard output
     * @param {string} message - Message to log
     */
    log(message) {
       this._logs.push(...message);
    }

    /**
     * Log an error message to standard error
     * @param {string} message - Error message to log
     */
    error(message) {
        this._logs.push(...message);
    }

    /**
     * Log info message to standard output
     * @param {string} message - Info message to log
     */
    info(message) {
        this._logs.push(...message);
    }

    /**
     * Log a warning message to standard output
     * @param {string} message - Warning message to log
     */
    warn(message) {
        this._logs.push(...message);
    }

    async finish() {
        //find out proper chartWidth
        const gantt= new Gantt();
        const width = process.stdout.columns - Gantt.config.defaultWidthOffset;
        await gantt.renderGantt(this._logs, Gantt.modes.INTERACTIVE,  width);
    }
}

module.exports = GanttConsole;