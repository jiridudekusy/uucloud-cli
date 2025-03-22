const CloudClient = require('../../src/interfaces/CloudClient');

/**
 * Mock implementation of CloudClient for testing
 */
class MockCloudClient extends CloudClient {
  /**
   * Create a new mock cloud client
   */
  constructor() {
    super();
    this.getAppDeploymentList = jest.fn().mockResolvedValue([]);
    this.getUniverseClient = jest.fn().mockResolvedValue(null);
  }
}

module.exports = MockCloudClient; 