const LogStore = require('../interfaces/LogStore');
const UuLogStore = require('../uucloud/uulog-store');

/**
 * Real implementation of LogStore using UuLogStore
 */
class RealLogStore extends LogStore {
  /**
   * Create a new RealLogStore instance
   * @param {Object} config - Configuration object containing oidcToken and optional logStoreUri
   */
  constructor(config = {}) {
    super(config);
    // Create the UuLogStore instance
    this.store = new UuLogStore(config);
  }

  /**
   * Get logs for a specific application
   * @param {string} appDeploymentUri - Application deployment URI
   * @param {Date} from - Start date
   * @param {Date} to - End date
   * @param {Object} criteria - Filter criteria
   * @param {Function} callback - Callback function for log batches
   * @returns {Promise<void>}
   */
  async getLogs(appDeploymentUri, from, to, criteria, callback) {
    return this.store.getLogs(appDeploymentUri, from, to, criteria, callback);
  }
  
  /**
   * Follow logs in real-time for one or more applications
   * @param {Array<string>} appDeploymentUris - List of application deployment URIs
   * @param {Object} criteria - Filter criteria
   * @param {Function} callback - Callback function for log batches
   * @returns {Promise<void>}
   */
  async tailLogs(appDeploymentUris, criteria, callback) {
    return this.store.tailLogs(appDeploymentUris, criteria, callback);
  }
}

module.exports = RealLogStore; 