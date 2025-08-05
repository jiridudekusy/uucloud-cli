const OidcToken = require('../../src/devkit/oidc-token');
const fs = require('fs');
const PropertiesReader = require('properties-reader');
const OidcClient = require('../../src/devkit/oidc-client');

// Mock external dependencies
jest.mock('fs');
jest.mock('properties-reader');
jest.mock('../../src/devkit/oidc-client');

describe('OidcToken', () => {
  let oidcToken;
  let mockConfig;
  let mockOidcClient;
  let mockProperties;
  
  beforeEach(() => {
    mockConfig = {
      issuer: 'https://auth.example.com',
      clientId: 'test-client-id'
    };
    
    mockOidcClient = {
      interactiveLogin: jest.fn()
    };
    
    mockProperties = {
      get: jest.fn()
    };
    
    // Setup mocks
    OidcClient.mockImplementation(() => mockOidcClient);
    PropertiesReader.mockReturnValue(mockProperties);
    fs.existsSync.mockReturnValue(true);
    
    oidcToken = new OidcToken('/path/to/token/file', mockConfig);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    test('should initialize with token file path and config', () => {
      expect(oidcToken.tokenPath).toBeDefined();
      expect(OidcClient).toHaveBeenCalledWith(mockConfig);
    });
  });
  
  describe('get', () => {
    test('should return token if already available', async () => {
      oidcToken.token = 'Bearer existing-token';
      
      const result = await oidcToken.get();
      
      expect(result).toBe('Bearer existing-token');
    });
    
    test('should refresh token if not available', async () => {
      mockProperties.get.mockReturnValue('valid-token');
      
      // Mock token verification to return true
      oidcToken._verifyTokenExpiration = jest.fn().mockResolvedValue(true);
      
      const result = await oidcToken.get();
      
      expect(result).toBe('Bearer valid-token');
    });
  });
  
  describe('refresh', () => {
    test('should load token from file if available and valid', async () => {
      mockProperties.get.mockReturnValue('valid-token');
      oidcToken._verifyTokenExpiration = jest.fn().mockResolvedValue(true);
      
      const result = await oidcToken.refresh();
      
      expect(fs.existsSync).toHaveBeenCalledWith(oidcToken.tokenPath);
      expect(PropertiesReader).toHaveBeenCalledWith(oidcToken.tokenPath);
      expect(mockProperties.get).toHaveBeenCalledWith('id_token');
      expect(result).toBe('Bearer valid-token');
    });
    
    test('should perform interactive login if no token file exists', async () => {
      fs.existsSync.mockReturnValue(false);
      mockOidcClient.interactiveLogin.mockResolvedValue('new-token');
      oidcToken._interactiveLogin = jest.fn().mockResolvedValue('Bearer new-token');
      
      await oidcToken.refresh();
      
      expect(oidcToken._interactiveLogin).toHaveBeenCalled();
    });
    
    test('should perform interactive login if token from file is expired', async () => {
      mockProperties.get.mockReturnValue('expired-token');
      oidcToken._verifyTokenExpiration = jest.fn().mockResolvedValue(false);
      oidcToken._interactiveLogin = jest.fn().mockResolvedValue('Bearer new-token');
      
      await oidcToken.refresh();
      
      expect(oidcToken._interactiveLogin).toHaveBeenCalled();
    });
    
    test('should perform interactive login if no id_token in properties', async () => {
      mockProperties.get.mockReturnValue(null);
      oidcToken._interactiveLogin = jest.fn().mockImplementation(() => {
        oidcToken.token = 'Bearer new-token';
        return Promise.resolve('Bearer new-token');
      });
      
      const result = await oidcToken.refresh();
      
      expect(oidcToken._interactiveLogin).toHaveBeenCalled();
      expect(result).toBe('Bearer new-token');
    });
  });
  
  describe('_setToken', () => {
    test('should format token with Bearer prefix', () => {
      const result = oidcToken._setToken('raw-token');
      
      expect(result).toBe('Bearer raw-token');
      expect(oidcToken.token).toBe('Bearer raw-token');
    });
  });
  
  describe('_loadTokenFromFile', () => {
    test('should return false if token file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = await oidcToken._loadTokenFromFile();
      
      expect(result).toBe(false);
    });
    
    test('should return true if valid token is loaded from file', async () => {
      mockProperties.get.mockReturnValue('valid-token');
      oidcToken._verifyTokenExpiration = jest.fn().mockResolvedValue(true);
      
      const result = await oidcToken._loadTokenFromFile();
      
      expect(result).toBe(true);
      expect(oidcToken.token).toBe('Bearer valid-token');
    });
    
    test('should return false if token from file is expired', async () => {
      mockProperties.get.mockReturnValue('expired-token');
      oidcToken._verifyTokenExpiration = jest.fn().mockResolvedValue(false);
      
      const result = await oidcToken._loadTokenFromFile();
      
      expect(result).toBe(false);
    });
    
    test('should return false if no id_token in properties file', async () => {
      mockProperties.get.mockReturnValue(null);
      
      const result = await oidcToken._loadTokenFromFile();
      
      expect(result).toBe(false);
    });
  });
  
  describe('_resolveTokenPath', () => {
    test('should resolve absolute path as-is', () => {
      const absolutePath = '/absolute/path/to/token';
      const token = new OidcToken(absolutePath, mockConfig);
      
      expect(token.tokenPath).toBe(absolutePath);
    });
    
    test('should resolve relative path from home directory', () => {
      const relativePath = 'relative/path/to/token';
      const token = new OidcToken(relativePath, mockConfig);
      
      expect(token.tokenPath).toContain('relative/path/to/token');
    });
  });
});