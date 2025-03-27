const Container = require('./Container');
const RealTokenProvider = require('../implementations/RealTokenProvider');
const RealCloudClient = require('../implementations/RealCloudClient');
const RealLogStore = require('../implementations/RealLogStore');
const RealConsole = require('../implementations/RealConsole');
const RealFileSystem = require('../implementations/RealFileSystem');
const CloudClient = require('../interfaces/CloudClient');
const LogStore = require('../interfaces/LogStore');

// Create a new container instance
const container = new Container();

// Register dependencies for production
if (process.env.NODE_ENV !== 'test') {
  container
    .register('tokenProvider', new RealTokenProvider())
    .register('console', new RealConsole())
    .register('fileSystem', new RealFileSystem())
    .registerService('CloudClient', CloudClient, (token, opts) => new RealCloudClient(token, opts))
    .registerService('LogStore', LogStore, (config) => new RealLogStore(config));
}

module.exports = container; 