const LogsCommand = require('../../src/commands/LogsCommand');
const MockTokenProvider = require('../mocks/MockTokenProvider');
const MockCloudClient = require('../mocks/MockCloudClient');
const MockLogStore = require('../mocks/MockLogStore');
const MockConsole = require('../mocks/MockConsole');
const MockTaskUtils = require('../mocks/MockTaskUtils');

describe('LogsCommand', () => {
  let command;
  let tokenProvider;
  let client;
  let logStore;
  let console;
  let taskUtils;
  
  beforeEach(() => {
    // Setup mock dependencies
    tokenProvider = new MockTokenProvider();
    client = new MockCloudClient();
    logStore = new MockLogStore();
    
    // Create a serviceFactory that returns the appropriate mock based on the interface type
    const serviceFactory = jest.fn((type, ...args) => {
      if (type === 'CloudClient') return client;
      if (type === 'LogStore') return logStore;
      return null;
    });
    
    console = new MockConsole();
    taskUtils = new MockTaskUtils();
    
    // Create command with mock dependencies
    command = new LogsCommand({
      tokenProvider,
      serviceFactory,
      console,
      taskUtils
    });
  });
  
  test('should get app deployment list and display logs', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        appDeploymentUri: 'ues:test:app:1',
        version: '1.0.0',
        tags: 'tag1'
      }
    ];
    
    const mockLogs = [
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'INFO',
        message: 'Test log message'
      }
    ];
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ 
      codec: 'formatted',
      resourcePool: 'test-resource-pool',
      apps: ['test-app-1']
    });
    
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    logStore.getLogs.mockImplementation((uri, from, to, criteria, callback) => {
      callback(mockLogs);
      return Promise.resolve();
    });
    
    // Act
    await command.execute(['-r', 'test-resource-pool', 'test-app-1']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(client.getAppDeploymentList).toHaveBeenCalledWith(['test-resource-pool']);
    expect(logStore.getLogs).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
  
  test('should follow logs in real-time', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        appDeploymentUri: 'ues:test:app:1',
        version: '1.0.0',
        tags: 'tag1'
      }
    ];
    
    const mockLogs = [
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'INFO',
        message: 'Test log message'
      }
    ];
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ 
      codec: 'formatted',
      resourcePool: 'test-resource-pool',
      apps: ['test-app-1'],
      follow: true
    });
    
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    logStore.tailLogs.mockImplementation((uris, criteria, callback) => {
      callback(mockLogs);
      return Promise.resolve();
    });
    
    // Act
    await command.execute(['-r', 'test-resource-pool', '-f', 'test-app-1']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(client.getAppDeploymentList).toHaveBeenCalledWith(['test-resource-pool']);
    expect(logStore.tailLogs).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
  
  test('should handle direct app URIs with disable-resolving', async () => {
    // Arrange
    const mockLogs = [
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'INFO',
        message: 'Test log message'
      }
    ];
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue({ 
      codec: 'formatted',
      resourcePool: 'test-resource-pool',
      apps: ['ues:test:app:1'],
      disableResolving: true
    });
    
    logStore.getLogs.mockImplementation((uri, from, to, criteria, callback) => {
      callback(mockLogs);
      return Promise.resolve();
    });
    
    // Act
    await command.execute(['-r', 'test-resource-pool', '-n', 'ues:test:app:1']);
    
    // Assert
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(client.getAppDeploymentList).not.toHaveBeenCalled();
    expect(logStore.getLogs).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
  
  test('should handle multiple apps with allowMultiApp option', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        appDeploymentUri: 'ues:test:app:1',
        version: '1.0.0'
      },
      { 
        asid: 'test-asid-2',
        code: 'test-app-2',
        appDeploymentUri: 'ues:test:app:2',
        version: '1.0.0'
      }
    ];
    
    const mockLogs = [
      { eventTime: '2023-01-01T10:00:00Z', message: 'Log from app 1' },
      { eventTime: '2023-01-01T10:01:00Z', message: 'Log from app 2' }
    ];
    
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    taskUtils.parseCliArguments.mockReturnValue({
      apps: ['test-app'],
      allowMultiApp: true,
      resourcePool: ['test-pool']
    });
    taskUtils.loadPresent.mockReturnValue({});
    taskUtils.mergeWithConfig.mockImplementation(opts => opts);
    
    logStore.getLogs.mockImplementation((app, from, to, criteria, callback) => {
      callback(mockLogs);
      return Promise.resolve();
    });
    
    // Act
    await command.execute(['test-app', '--allow-multi-app']);
    
    // Assert
    expect(client.getAppDeploymentList).toHaveBeenCalled();
    expect(logStore.getLogs).toHaveBeenCalledTimes(2);
  });
  
  test('should handle date filtering', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        appDeploymentUri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    taskUtils.parseCliArguments.mockReturnValue({
      apps: ['test-app-1'],
      since: '2023-01-01T00:00:00Z',
      until: '2023-01-01T23:59:59Z',
      resourcePool: ['test-pool']
    });
    taskUtils.loadPresent.mockReturnValue({});
    taskUtils.mergeWithConfig.mockImplementation(opts => opts);
    
    logStore.getLogs.mockImplementation((app, from, to, criteria, callback) => {
      callback([]);
      return Promise.resolve();
    });
    
    // Act
    await command.execute(['test-app-1', '--since', '2023-01-01T00:00:00.000Z', '--until', '2023-01-01T23:59:59.000Z']);
    
    // Assert
    expect(logStore.getLogs).toHaveBeenCalledWith(
      expect.any(Object),
      new Date('2023-01-01T00:00:00Z'),
      new Date('2023-01-01T23:59:59Z'),
      expect.any(Object),
      expect.any(Function)
    );
  });
  
  test('should handle multiple apps without allowMultiApp', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        appDeploymentUri: 'ues:test:app:1',
        version: '1.0.0'
      },
      { 
        asid: 'test-asid-2',
        code: 'test-app-2',
        appDeploymentUri: 'ues:test:app:2',
        version: '1.0.0'
      }
    ];
    
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    taskUtils.parseCliArguments.mockReturnValue({
      apps: ['test-app'],
      allowMultiApp: false,
      resourcePool: ['test-pool']
    });
    taskUtils.loadPresent.mockReturnValue({});
    taskUtils.mergeWithConfig.mockImplementation(opts => opts);
    taskUtils.testOption.mockImplementation((condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    });
    
    // Act & Assert
    await expect(command.execute(['test-app'])).rejects.toThrow();
  });
  
  test('should handle log filtering with criteria', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        appDeploymentUri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    client.getAppDeploymentList.mockResolvedValue(mockDeployments);
    taskUtils.parseCliArguments.mockReturnValue({
      apps: ['test-app-1'],
      criteria: ['logLevel:ERROR'],
      resourcePool: ['test-pool']
    });
    taskUtils.loadPresent.mockReturnValue({});
    taskUtils.mergeWithConfig.mockImplementation(opts => opts);
    
    logStore.getLogs.mockImplementation((app, from, to, criteria, callback) => {
      callback([]);
      return Promise.resolve();
    });
    
    // Act
    await command.execute(['test-app-1', '--criteria', 'logLevel:ERROR']);
    
    // Assert
    expect(logStore.getLogs).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      undefined,
      expect.objectContaining({ logLevel: 'ERROR' }),
      expect.any(Function)
    );
  });
}); 