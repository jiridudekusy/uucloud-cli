/**
 * Mock implementation of LogStore for testing
 */
class MockLogStore {
  constructor() {
    this.getLogs = jest.fn();
    this.tailLogs = jest.fn();
  }
}

module.exports = MockLogStore; 