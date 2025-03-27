const Container = require('./Container');
const RealTokenProvider = require('../implementations/RealTokenProvider');
const RealCloudClient = require('../implementations/RealCloudClient');
const RealConsole = require('../implementations/RealConsole');
const RealFileSystem = require('../implementations/RealFileSystem');
const CloudClient = require('../interfaces/CloudClient');

// Create a new container instance
const container = new Container();

// Register dependencies for production
if (process.env.NODE_ENV !== 'test') {
  container
    .register('tokenProvider', new RealTokenProvider())
    .register('console', new RealConsole())
    .register('fileSystem', new RealFileSystem())
    .registerService('CloudClient', CloudClient, (token, opts) => new RealCloudClient(token, opts));
}

module.exports = container; 