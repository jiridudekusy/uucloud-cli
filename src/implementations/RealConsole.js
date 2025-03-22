const Console = require('../interfaces/Console');

/**
 * Real implementation of Console using Node.js console
 */
class RealConsole extends Console {
  /**
   * Log a message to standard output
   * @param {string} message - Message to log
   */
  log(message) {
    console.log(message);
  }

  /**
   * Log an error message to standard error
   * @param {string} message - Error message to log
   */
  error(message) {
    console.error(message);
  }

  /**
   * Log info message to standard output
   * @param {string} message - Info message to log
   */
  info(message) {
    console.info(message);
  }

  /**
   * Log a warning message to standard output
   * @param {string} message - Warning message to log
   */
  warn(message) {
    console.warn(message);
  }
}

module.exports = RealConsole; 