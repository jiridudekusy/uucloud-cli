const Container = require('../../src/di/Container');
const MockTokenProvider = require('../mocks/MockTokenProvider');
const MockCloudClient = require('../mocks/MockCloudClient');
const MockLogStore = require('../mocks/MockLogStore');
const MockConsole = require('../mocks/MockConsole');
const MockTaskUtils = require('../mocks/MockTaskUtils');
const CloudClient = require('../../src/interfaces/CloudClient');
const LogStore = require('../../src/interfaces/LogStore');

/**
 * Create a test container with mock dependencies
 * @returns {Container} - Container with mock dependencies
 */
function createTestContainer() {
  const container = new Container();
  
  // Register mock dependencies
  container
    .register('tokenProvider', new MockTokenProvider())
    .register('console', new MockConsole())
    .register('taskUtils', new MockTaskUtils())
    .registerService('CloudClient', CloudClient, () => new MockCloudClient())
    .registerService('LogStore', LogStore, () => new MockLogStore());
  
  return container;
}

/**
 * Get the container instance for testing
 * @returns {Container} - Container for testing
 */
module.exports = createTestContainer(); 