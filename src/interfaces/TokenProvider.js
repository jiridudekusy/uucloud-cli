/**
 * Interface for token providers used throughout the application
 */
class TokenProvider {
  /**
   * Get a valid token for API operations
   * @param {Object} options - Authentication options
   * @returns {Promise<string>} - The authentication token
   */
  async getToken(options) { 
    throw new Error("Method getToken not implemented"); 
  }
}

module.exports = TokenProvider; 