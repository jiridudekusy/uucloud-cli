const CloudClient = require('../interfaces/CloudClient');
const UuCloudClient = require('../uucloud/uucloud-client');

/**
 * Real implementation of CloudClient using UucloudClient
 */
class RealCloudClient extends CloudClient {
  /**
   * Create a new RealCloudClient instance
   * @param {string} oidcToken - Authentication token
   * @param {Object} options - Client options
   */
  constructor(oidcToken, options = {}) {
    super();
    // Ensure options is an object to prevent errors when accessing properties
    this.client = new UuCloudClient(oidcToken, options || {});
  }

  /**
   * Get the list of application deployments from a resource pool
   * @param {string} resourcePoolUri - The URI of the resource pool
   * @returns {Promise<Array>} - List of application deployments
   */
  async getAppDeploymentList(resourcePoolUri) {
    return this.client.getAppDeploymentList(resourcePoolUri);
  }

  /**
   * Get the universe client if available
   * @returns {Promise<Object|null>} - The universe client or null
   */
  async getUniverseClient() {
    return this.client.getUniverseClient();
  }

  /**
   * Get the list of AWIDs for a given uuSubApp deployment
   * @param {Object} subAppDeployment - The subApp deployment object
   * @returns {Promise<Array>} - List of AWIDs with their properties
   */
  async getAwids(subAppDeployment) {
    return this.client.getAwids(subAppDeployment);
  }
}

module.exports = RealCloudClient; 