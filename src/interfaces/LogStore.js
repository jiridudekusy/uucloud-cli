/**
 * Interface for LogStore operations
 */
class LogStore {
  /**
   * Create a new LogStore instance
   * @param {Object} config - LogStore configuration
   */
  constructor(config) {
    this._config = config;
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
    throw new Error("Method getLogs not implemented"); 
  }
  
  /**
   * Follow logs in real-time for one or more applications
   * @param {Array<string>} appDeploymentUris - List of application deployment URIs
   * @param {Object} criteria - Filter criteria
   * @param {Function} callback - Callback function for log batches
   * @returns {Promise<void>}
   */
  async tailLogs(appDeploymentUris, criteria, callback) { 
    throw new Error("Method tailLogs not implemented"); 
  }
}

module.exports = LogStore; 