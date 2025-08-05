const ExecuteCommand = require('../../src/commands/ExecuteCommand');
const MockConsole = require('../mocks/MockConsole');
const MockTaskUtils = require('../mocks/MockTaskUtils');
const MockCloudClient = require('../mocks/MockCloudClient');
const MockTokenProvider = require('../mocks/MockTokenProvider');
const { AppClient } = require('uu_appg01_core-appclient');
const OidcTokenProvider = require('../../src/oidc-token-provider');
const { Uri } = require('uu_appg01_core-uri');

// Mock external modules
jest.mock('uu_appg01_core-appclient', () => ({
  AppClient: {
    get: jest.fn()
  }
}));
jest.mock('../../src/oidc-token-provider');
jest.mock('uu_appg01_core-uri', () => ({
  Uri: {
    parse: jest.fn().mockReturnValue({ awid: 'AWID001' }),
    createBuilder: jest.fn().mockReturnValue({
      parse: jest.fn().mockReturnThis(),
      setUseCase: jest.fn().mockReturnThis(),
      toUri: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('https://app.com/ws-123/test/command')
      })
    })
  }
}));

describe('ExecuteCommand', () => {
  let command;
  let mockConsole;
  let mockTaskUtils;
  let mockTokenProvider;
  let mockServiceFactory;
  let mockCloudClient;
  let mockUniverseClient;
  let mockAppClient;
  
  beforeEach(() => {
    mockConsole = new MockConsole();
    mockTaskUtils = new MockTaskUtils();
    mockTokenProvider = new MockTokenProvider();
    
    mockUniverseClient = {
      call: jest.fn()
    };
    
    mockAppClient = {
      call: jest.fn()
    };
    
    mockCloudClient = new MockCloudClient();
    mockCloudClient.getUniverseClient.mockResolvedValue(mockUniverseClient);
    
    mockServiceFactory = jest.fn().mockReturnValue(mockCloudClient);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock OidcTokenProvider
    const mockOidcTokenProvider = {
      getToken: jest.fn().mockResolvedValue({
        get: jest.fn().mockResolvedValue('Bearer mock-oidc-token')
      })
    };
    OidcTokenProvider.mockImplementation(() => mockOidcTokenProvider);
    
    command = new ExecuteCommand({
      console: mockConsole,
      taskUtils: mockTaskUtils,
      tokenProvider: mockTokenProvider,
      serviceFactory: mockServiceFactory
    });
    
    // Setup default mock behaviors
    mockTaskUtils.parseCliArguments.mockReturnValue({
      commandPath: '/test/command',
      apps: ['test-app'],
      dtoIn: '{"test": "data"}',
      resourcePool: ['test-pool']
    });
    
    mockTaskUtils.loadPresent.mockReturnValue({});
    mockTaskUtils.mergeWithConfig.mockImplementation((options, present) => options);
    mockTokenProvider.getToken.mockResolvedValue('test-token');
    
    mockCloudClient.getAppDeploymentList.mockResolvedValue([
      {
        asid: 'app-123',
        code: 'test-app',
        version: '1.0.0',
        uri: 'https://test-app.com',
        uuAppWorkspaceMap: { 'ws-123': { name: 'Test Workspace' } },
        uuAppServerEnvironment: {
          'uu_app_oidc_providers_oidcg02_uri': 'ues:WSS_PROD:AWID001:OIDC'
        }
      }
    ]);
  });
  
  describe('execute', () => {
    test('should execute command successfully with single app match', async () => {
      // Mock AWIDs response
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123', awidUri: 'https://app.com/ws-123' }
      ]);
      
      AppClient.get.mockResolvedValue({
        data: { result: 'success' }
      });
      
      await command.execute(['-c', '/test/command', '-d', '{"test": "data"}', 'test-app']);
      
      expect(mockTokenProvider.getToken).toHaveBeenCalled();
      expect(mockCloudClient.getAppDeploymentList).toHaveBeenCalledWith(['test-pool']);
      expect(mockCloudClient.getAwids).toHaveBeenCalled();
      expect(AppClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/test/command'),
        { test: 'data' },
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(mockConsole.log).toHaveBeenCalledWith(JSON.stringify({ result: 'success' }, null, 2));
    });
    
    test('should throw error when command path is missing', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        apps: ['test-app']
      });
      
      await expect(command.execute(['test-app'])).rejects.toThrow(
        'Command path is required. Use -c or --command-path to specify the command path.'
      );
    });
    
    test('should throw error when app is missing and not interactive', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        interactive: false
      });
      
      await expect(command.execute(['-c', '/test/command'])).rejects.toThrow(
        'Application identifier is required. Specify an application or use -i to enable interactive mode.'
      );
    });
    
    test('should throw error when no apps match filter', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        apps: ['non-existent-app']
      });
      
      await expect(command.execute(['-c', '/test/command', 'non-existent-app'])).rejects.toThrow(
        'No applications found matching the specified filter: non-existent-app'
      );
    });
    
    test('should handle multiple matching apps in non-interactive mode', async () => {
      mockCloudClient.getAppDeploymentList.mockResolvedValue([
        {
          asid: 'app-123',
          code: 'test-app-1',
          version: '1.0.0',
          uri: 'https://test-app-1.com',
          uuAppWorkspaceMap: { 'ws-123': { name: 'Test Workspace 1' } }
        },
        {
          asid: 'app-456',
          code: 'test-app-2', 
          version: '1.0.0',
          uri: 'https://test-app-2.com',
          uuAppWorkspaceMap: { 'ws-456': { name: 'Test Workspace 2' } }
        }
      ]);
      
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        apps: ['test-app'],
        interactive: false
      });
      
      await expect(command.execute(['-c', '/test/command', 'test-app'])).rejects.toThrow(
        'Multiple applications found. Please refine your filter criteria or use -i for interactive mode.'
      );
    });
    
    test('should handle workspace selection with single workspace', async () => {
      // Mock AWIDs response
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123', awidUri: 'https://app.com/ws-123' }
      ]);
      
      AppClient.get.mockResolvedValue({
        data: { result: 'success' }
      });
      
      await command.execute(['-c', '/test/command', '-d', '{"test": "data"}', 'test-app']);
      
      expect(AppClient.get).toHaveBeenCalled();
    });
    
    test('should handle multiple workspaces in non-interactive mode', async () => {
      mockCloudClient.getAppDeploymentList.mockResolvedValue([
        {
          asid: 'app-123',
          code: 'test-app',
          version: '1.0.0',
          uri: 'https://test-app.com',
          uuAppWorkspaceMap: {
            'ws-123': { name: 'Test Workspace 1' },
            'ws-456': { name: 'Test Workspace 2' }
          },
          uuAppServerEnvironment: {
            'uu_app_oidc_providers_oidcg02_uri': 'ues:WSS_PROD:AWID001:OIDC'
          }
        }
      ]);
      
      // Mock multiple AWIDs response  
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123', awidUri: 'https://app.com/ws-123' },
        { awid: 'ws-456', targetAwid: 'ws-456', awidUri: 'https://app.com/ws-456' }
      ]);
      
      await expect(command.execute(['-c', '/test/command', 'test-app'])).rejects.toThrow(
        'Multiple AWIDs found. Please specify an AWID using -a or --awid, or use -i to enable interactive mode.'
      );
    });
    
    test('should use specified AWID when provided', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        apps: ['test-app'],
        awid: 'ws-123',
        dtoIn: '{"test": "data"}'
      });
      
      mockCloudClient.getAppDeploymentList.mockResolvedValue([
        {
          asid: 'app-123',
          code: 'test-app',
          version: '1.0.0',
          uri: 'https://test-app.com',
          uuAppWorkspaceMap: {
            'ws-123': { name: 'Test Workspace 1' },
            'ws-456': { name: 'Test Workspace 2' }
          },
          uuAppServerEnvironment: {
            'uu_app_oidc_providers_oidcg02_uri': 'ues:WSS_PROD:AWID001:OIDC'
          }
        }
      ]);
      
      // Mock AWIDs response with multiple workspaces
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123', awidUri: 'https://app.com/ws-123' },
        { awid: 'ws-456', targetAwid: 'ws-456', awidUri: 'https://app.com/ws-456' }
      ]);
      
      AppClient.get.mockResolvedValue({
        data: { result: 'success' }
      });
      
      await command.execute(['-c', '/test/command', '--awid', 'ws-123', 'test-app']);
      
      expect(AppClient.get).toHaveBeenCalled();
    });
    
    test('should handle invalid JSON in dtoIn', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        apps: ['test-app'],
        dtoIn: 'invalid-json'
      });
      
      await expect(command.execute(['-c', '/test/command', '-d', 'invalid-json', 'test-app'])).rejects.toThrow();
    });
    
    test('should handle API call failures', async () => {
      // Mock AWIDs response first
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123', awidUri: 'https://app.com/ws-123' }
      ]);
      
      // Mock app deployment with OIDC config
      mockCloudClient.getAppDeploymentList.mockResolvedValue([
        {
          asid: 'app-123',
          code: 'test-app',
          version: '1.0.0',
          uri: 'https://test-app.com',
          uuAppWorkspaceMap: { 'ws-123': { name: 'Test Workspace' } },
          uuAppServerEnvironment: {
            'uu_app_oidc_providers_oidcg02_uri': 'ues:WSS_PROD:AWID001:OIDC'
          }
        }
      ]);
      
      AppClient.get.mockRejectedValue(new Error('API call failed'));
      
      await expect(command.execute(['-c', '/test/command', 'test-app'])).rejects.toThrow('API call failed');
    });
    
    test('should handle workspace not found error', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        apps: ['test-app'],
        awid: 'non-existent-ws'
      });
      
      // Mock AWIDs response with different AWID
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123' }
      ]);
      
      await expect(command.execute(['-c', '/test/command', '--awid', 'non-existent-ws', 'test-app'])).rejects.toThrow(
        'Specified AWID \'non-existent-ws\' does not exist for the selected uuSubApp.'
      );
    });
    
    test('should use default empty object for dtoIn when not provided', async () => {
      mockTaskUtils.parseCliArguments.mockReturnValue({
        commandPath: '/test/command',
        apps: ['test-app'],
        dtoIn: '{}'  // Mock the default value since parseCliArguments should set this
      });
      
      // Mock AWIDs response
      mockCloudClient.getAwids.mockResolvedValue([
        { awid: 'ws-123', targetAwid: 'ws-123', awidUri: 'https://app.com/ws-123' }
      ]);
      
      // Mock app deployment with OIDC config
      mockCloudClient.getAppDeploymentList.mockResolvedValue([
        {
          asid: 'app-123',
          code: 'test-app',
          version: '1.0.0',
          uri: 'https://test-app.com',
          uuAppWorkspaceMap: { 'ws-123': { name: 'Test Workspace' } },
          uuAppServerEnvironment: {
            'uu_app_oidc_providers_oidcg02_uri': 'ues:WSS_PROD:AWID001:OIDC'
          }
        }
      ]);
      
      AppClient.get.mockResolvedValue({
        data: { result: 'success' }
      });
      
      await command.execute(['-c', '/test/command', 'test-app']);
      
      expect(AppClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/test/command'),
        {},
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });
  });
  
  describe('static properties', () => {
    test('should have correct optionsDefinitions', () => {
      expect(ExecuteCommand.optionsDefinitions).toBeDefined();
      expect(ExecuteCommand.optionsDefinitions).toContainEqual(
        expect.objectContaining({
          name: 'command-path',
          alias: 'c'
        })
      );
    });
    
    test('should have help documentation', () => {
      expect(ExecuteCommand.help).toBeDefined();
      expect(ExecuteCommand.help).toContainEqual(
        expect.objectContaining({
          header: 'execute command'
        })
      );
    });
  });
});