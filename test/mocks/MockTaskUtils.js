/**
 * Mock implementation of TaskUtils for testing
 */
class MockTaskUtils {
  /**
   * Create a new mock task utils
   */
  constructor() {
    this.parseCliArguments = jest.fn().mockReturnValue({});
    this.loadPresent = jest.fn().mockReturnValue(null);
    this.mergeWithConfig = jest.fn((options) => options);
    this.testOption = jest.fn();
  }
}

module.exports = MockTaskUtils; 