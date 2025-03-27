// Mock dependencies before requiring the command class
jest.mock('../../src/misc/prompt-utils', () => {
  const searchPrompt = jest.fn();
  // First call returns the app selection
  searchPrompt.mockResolvedValueOnce('test-asid-1');
  // Second call returns the action selection
  searchPrompt.mockResolvedValueOnce('action1');
  
  return { searchPrompt };
});

jest.mock('../../src/actions/action-handler-factory', () => ({
  getHandler: jest.fn()
}));

// After mocking modules, require the dependencies
const InteractiveCommand = require('../../src/commands/InteractiveCommand');
const actionHandlerFactory = require('../../src/actions/action-handler-factory');
const promptUtils = require('../../src/misc/prompt-utils');
const MockTokenProvider = require('../mocks/MockTokenProvider');
const MockCloudClient = require('../mocks/MockCloudClient');
const MockConsole = require('../mocks/MockConsole');
const MockTaskUtils = require('../mocks/MockTaskUtils');

// Create standard mock deployments to use in tests
const createMockDeployments = () => [
  { 
    asid: 'test-asid-1',
    code: 'test-app-1',
    version: '1.0.0',
    tags: 'tag1',
    data: {
      uuAppResourcePoolOid: 'pool-1'
    }
  },
  {
    asid: 'test-asid-2',
    code: 'test-app-2',
    version: '1.0.0',
    tags: 'tag2',
    data: {
      uuAppResourcePoolOid: 'pool-2'
    }
  }
];

describe('InteractiveCommand', () => {
  let command;
  let tokenProvider;
  let cloudClient;
  let universeClient;
  let console;
  let taskUtils;
  let mockHandler;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset the search prompt mock for each test
    promptUtils.searchPrompt.mockReset();
    promptUtils.searchPrompt.mockResolvedValueOnce('test-asid-1');
    promptUtils.searchPrompt.mockResolvedValueOnce('action1');
    
    // Create mock handler
    mockHandler = {
      getGroupedActionMenu: jest.fn().mockResolvedValue([
        { name: 'Action 1', value: 'action1' },
        { name: 'Action 2', value: 'action2' }
      ]),
      processAction: jest.fn().mockResolvedValue(true)
    };
    actionHandlerFactory.getHandler.mockReturnValue(mockHandler);
    
    // Create mock dependencies using the standard mock classes
    tokenProvider = new MockTokenProvider();
    
    // Create a mock universe client
    universeClient = {
      getUuAppResourcePool: jest.fn().mockResolvedValue({
        uuAppResourcePool: {
          name: 'test-resource-pool',
          code: 'test-rp'
        }
      })
    };
    
    // Setup the cloud client
    cloudClient = new MockCloudClient();
    cloudClient.getAppDeploymentList.mockResolvedValue(createMockDeployments());
    cloudClient.getUniverseClient.mockResolvedValue(universeClient);
    
    // Create mock console and task utils
    console = new MockConsole();
    taskUtils = new MockTaskUtils();
    
    // Setup taskUtils mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ 
      resourcePool: 'test-resource-pool'
    });
    taskUtils.mergeWithConfig.mockReturnValue({
      resourcePool: 'test-resource-pool'
    });
    
    // Create a serviceFactory that returns the appropriate mock based on the interface type
    const serviceFactory = jest.fn((type, ...args) => {
      if (type === 'CloudClient') return cloudClient;
      return null;
    });
    
    // Create command instance
    command = new InteractiveCommand({
      tokenProvider,
      serviceFactory,
      console,
      taskUtils
    });
  });
  
  test('should execute interactive command flow with universe client', async () => {
    // Act
    await command.execute(['-r', 'test-resource-pool']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(cloudClient.getAppDeploymentList).toHaveBeenCalledWith('test-resource-pool');
    expect(cloudClient.getUniverseClient).toHaveBeenCalled();
    
    // Verify that we got the resource pools
    expect(universeClient.getUuAppResourcePool).toHaveBeenCalledTimes(2);
    expect(universeClient.getUuAppResourcePool).toHaveBeenCalledWith('pool-1');
    expect(universeClient.getUuAppResourcePool).toHaveBeenCalledWith('pool-2');
    
    // Verify prompts were called with correct arguments
    expect(promptUtils.searchPrompt).toHaveBeenCalledTimes(2);
    expect(promptUtils.searchPrompt.mock.calls[0][0]).toBe('Select uuSubApp deployment:');
    expect(promptUtils.searchPrompt.mock.calls[1][0]).toBe('Select action:');
    
    // Verify that we interacted with the action handler
    expect(actionHandlerFactory.getHandler).toHaveBeenCalledWith('test-app-1', expect.anything());
    expect(mockHandler.getGroupedActionMenu).toHaveBeenCalledWith('test-app-1', expect.anything(), 'test-asid-1', expect.anything(), expect.anything());
    expect(mockHandler.processAction).toHaveBeenCalledWith('action1', expect.anything(), 'test-asid-1', expect.anything(), expect.anything());
  });
  
  test('should execute interactive command flow without universe client', async () => {
    // Arrange
    cloudClient.getUniverseClient.mockResolvedValue(null); // No universe client
    
    // Act
    await command.execute(['-r', 'test-resource-pool']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(cloudClient.getAppDeploymentList).toHaveBeenCalled();
    
    // Verify that we still get the actions
    expect(actionHandlerFactory.getHandler).toHaveBeenCalledWith('test-app-1', expect.anything());
    expect(mockHandler.getGroupedActionMenu).toHaveBeenCalled();
    expect(mockHandler.processAction).toHaveBeenCalled();
  });
}); 