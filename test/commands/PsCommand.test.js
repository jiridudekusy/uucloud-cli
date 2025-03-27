const PsCommand = require('../../src/commands/PsCommand');
const MockTokenProvider = require('../mocks/MockTokenProvider');
const MockCloudClient = require('../mocks/MockCloudClient');
const MockConsole = require('../mocks/MockConsole');
const MockTaskUtils = require('../mocks/MockTaskUtils');

describe('PsCommand', () => {
  let command;
  let tokenProvider;
  let client;
  let console;
  let taskUtils;
  
  beforeEach(() => {
    // Setup mock dependencies
    tokenProvider = new MockTokenProvider();
    client = new MockCloudClient();
    
    // Create a serviceFactory that returns the appropriate mock based on the interface type
    const serviceFactory = jest.fn((type, ...args) => {
      if (type === 'CloudClient') return client;
      return null;
    });
    
    console = new MockConsole();
    taskUtils = new MockTaskUtils();
    
    // Create command with mock dependencies
    command = new PsCommand({
      tokenProvider,
      serviceFactory,
      console,
      taskUtils
    });
  });
  
  test('should display app deployments in table format', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        version: '1.0.0',
        tags: 'tag1',
        nodeSize: 'small',
        nodeCount: 1,
        cpu: 100,
        memory: 512,
        state: 'active'
      },
      {
        asid: 'test-asid-2',
        code: 'test-app-2',
        version: '1.0.0',
        tags: 'tag2',
        nodeSize: 'medium',
        nodeCount: 2,
        cpu: 200,
        memory: 1024,
        state: 'active'
      }
    ];
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ 
      codec: 'table',
      resourcePool: 'test-resource-pool'
    });
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    
    // Act
    await command.execute(['-r', 'test-resource-pool']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(client.getAppDeploymentList).toHaveBeenCalledWith(['test-resource-pool']);
    expect(console.log).toHaveBeenCalled();
  });
  
  test('should display app deployments in raw format', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        data: { name: 'test-app-1' }
      },
      {
        asid: 'test-asid-2',
        code: 'test-app-2',
        data: { name: 'test-app-2' }
      }
    ];
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ 
      codec: 'raw',
      resourcePool: 'test-resource-pool'
    });
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    
    // Act
    await command.execute(['-r', 'test-resource-pool']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(client.getAppDeploymentList).toHaveBeenCalledWith(['test-resource-pool']);
    expect(console.log).toHaveBeenCalled();
    
    // Check that the output contains our mock data
    const consoleOutput = console.log.mock.calls[0][0];
    expect(consoleOutput).toContain('test-app-1');
    expect(consoleOutput).toContain('test-app-2');
  });
  
  test('should use mock data when present in present configuration', async () => {
    // Arrange
    const mockDeployments = [
      { asid: 'test-asid-3', code: 'test-app-3' },
      { asid: 'test-asid-4', code: 'test-app-4' }
    ];
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ codec: 'table' });
    taskUtils.loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    // Act
    await command.execute([]);
    
    // Assert
    expect(tokenProvider.getToken).not.toHaveBeenCalled();
    expect(client.getAppDeploymentList).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
}); 