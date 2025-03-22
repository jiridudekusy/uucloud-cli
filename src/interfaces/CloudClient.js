/**
 * Interface for cloud client operations
 */
class CloudClient {
  /**
   * Get the list of application deployments from a resource pool
   * @param {string} resourcePoolUri - The URI of the resource pool
   * @returns {Promise<Array>} - List of application deployments
   */
  async getAppDeploymentList(resourcePoolUri) { 
    throw new Error("Method getAppDeploymentList not implemented"); 
  }

  /**
   * Get the universe client if available
   * @returns {Promise<Object|null>} - The universe client or null
   */
  async getUniverseClient() {
    throw new Error("Method getUniverseClient not implemented");
  }
}

module.exports = CloudClient; 