/**
 * Interface for console output operations
 */
class Console {
  /**
   * Log a message to standard output
   * @param {string} message - Message to log
   */
  log(message) {
    throw new Error("Method log not implemented");
  }

  /**
   * Log an error message to standard error
   * @param {string} message - Error message to log
   */
  error(message) {
    throw new Error("Method error not implemented");
  }

  /**
   * Log info message to standard output
   * @param {string} message - Info message to log
   */
  info(message) {
    throw new Error("Method info not implemented");
  }

  /**
   * Log a warning message to standard output
   * @param {string} message - Warning message to log
   */
  warn(message) {
    throw new Error("Method warn not implemented");
  }

  async finish(){
    throw new Error("Method finish not implemented");
  }


}

module.exports = Console; 