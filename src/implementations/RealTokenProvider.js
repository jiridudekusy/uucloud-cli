const TokenProvider = require('../interfaces/TokenProvider');
const OidcTokenProvider = require('../oidc-token-provider');

/**
 * Real implementation of TokenProvider using OidcTokenProvider
 */
class RealTokenProvider extends TokenProvider {
  constructor() {
    super();
    this.oidcTokenProvider = new OidcTokenProvider();
  }

  /**
   * Get a valid token for API operations
   * @param {Object} options - Authentication options
   * @returns {Promise<string>} - The authentication token
   */
  async getToken(options) {
    return this.oidcTokenProvider.getToken(options);
  }
}

module.exports = RealTokenProvider; 