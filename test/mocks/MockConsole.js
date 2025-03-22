const Console = require('../../src/interfaces/Console');

/**
 * Mock implementation of Console for testing
 */
class MockConsole extends Console {
  /**
   * Create a new mock console
   */
  constructor() {
    super();
    this.log = jest.fn();
    this.error = jest.fn();
    this.info = jest.fn();
    this.warn = jest.fn();
    this.messages = [];
    this.errorMessages = [];
  }

  /**
   * Log a message to standard output
   * @param {string} message - Message to log
   */
  log(message) {
    this.messages.push(message);
  }

  /**
   * Log an error message to standard error
   * @param {string} message - Error message to log
   */
  error(message) {
    this.errorMessages.push(message);
  }
}

module.exports = MockConsole; 