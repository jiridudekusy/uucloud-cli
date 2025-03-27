/**
 * Mock implementation of universe client for testing
 */
class MockUniverseClient {
  constructor() {
    this.getUuAppResourcePool = jest.fn().mockResolvedValue({
      uuAppResourcePool: {
        name: 'test-resource-pool',
        code: 'test-rp'
      }
    });
  }
}

module.exports = MockUniverseClient; 