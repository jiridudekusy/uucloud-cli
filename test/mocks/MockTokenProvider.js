const TokenProvider = require('../../src/interfaces/TokenProvider');

/**
 * Mock implementation of TokenProvider for testing
 */
class MockTokenProvider extends TokenProvider {
  /**
   * Create a new mock token provider
   */
  constructor() {
    super();
    this.getToken = jest.fn().mockResolvedValue('mock-token');
  }
}

module.exports = MockTokenProvider; 