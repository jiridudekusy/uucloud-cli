const TokenProvider = require('../interfaces/TokenProvider');
const OidcTokenProvider = require('../oidc-token-provider');

/**
 * Real implementation of TokenProvider using OidcTokenProvider
 */
class RealTokenProvider extends TokenProvider {
  /**
   * Get a valid token for API operations
   * @param {Object} options - Authentication options
   * @returns {Promise<string>} - The authentication token
   */
  async getToken(options) {
    const oidcTokenProvider = new OidcTokenProvider();
    return oidcTokenProvider.getToken(options);
  }
}

module.exports = RealTokenProvider; 