const LogsCommand = require('../../src/commands/LogsCommand');
const Container = require('../../src/di/Container');
const RealCloudClient = require('../../src/implementations/RealCloudClient');
const CloudClient = require('../../src/interfaces/CloudClient');
const TaskUtils = require('../../src/misc/task-utils');
const RealLogStore = require('../../src/implementations/RealLogStore');
const LogStore = require('../../src/interfaces/LogStore');
const UuLogStore = require('../../src/uucloud/uulog-store');

// Mock log-utils module at the top level
jest.mock('../../src/misc/log-utils', () => ({
  getLogAccessAttributes: jest.fn(),
  extractLogCriteriaFromUri: jest.fn()
}));

describe('LogsCommand - using DI container with minimal mocks', () => {
  let originalExecuteCommand;
  let originalLoadPresent;
  let originalMergeWithConfig;
  let originalTestOption;
  let originalPrintOtionsErrorAndExit;
  let mockExecuteCommand;
  let container;
  let command;
  
  beforeAll(() => {
    // Store original methods
    originalExecuteCommand = UuLogStore.prototype._executeCommand;
    originalLoadPresent = TaskUtils.prototype.loadPresent;
    originalMergeWithConfig = TaskUtils.prototype.mergeWithConfig;
    originalTestOption = TaskUtils.prototype.testOption;
    originalPrintOtionsErrorAndExit = TaskUtils.prototype.printOtionsErrorAndExit;
  });
  
  beforeEach(() => {
    // Use fake timers to control setTimeout in tailLogs
    jest.useFakeTimers();
    
    // Create mock functions
    mockExecuteCommand = jest.fn();
    
    // Replace only the specific method that makes network calls
    UuLogStore.prototype._executeCommand = mockExecuteCommand;
    
    // Mock TaskUtils methods
    TaskUtils.prototype.loadPresent = jest.fn().mockReturnValue(null);
    TaskUtils.prototype.mergeWithConfig = jest.fn().mockImplementation((options) => options);
    TaskUtils.prototype.testOption = jest.fn().mockImplementation((condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    });
    TaskUtils.prototype.printOtionsErrorAndExit = jest.fn().mockImplementation((message) => {
      throw new Error(message);
    });
    
    // Create DI container with real dependencies
    container = new Container();
    container
      .register('tokenProvider', {
        getToken: jest.fn().mockResolvedValue({
          refresh: jest.fn().mockResolvedValue('Bearer test-token')
        })
      })
      .register('console', {
        log: jest.fn(),
        error: jest.fn()
      })
      .register('taskUtils', new TaskUtils(LogsCommand.optionsDefinitions, LogsCommand.help))
      .registerService('CloudClient', CloudClient, (token, opts) => new RealCloudClient(token, opts))
      .registerService('LogStore', LogStore, (config) => new RealLogStore(config));
    
    // Create command using real DI mechanism
    command = container.createCommand(LogsCommand);
  });
  
  afterEach(() => {
    // Restore real timers
    jest.useRealTimers();
    
    // Clear mock calls
    jest.clearAllMocks();
    
    // Restore original methods
    UuLogStore.prototype._executeCommand = originalExecuteCommand;
    TaskUtils.prototype.loadPresent = originalLoadPresent;
    TaskUtils.prototype.mergeWithConfig = originalMergeWithConfig;
    TaskUtils.prototype.testOption = originalTestOption;
    TaskUtils.prototype.printOtionsErrorAndExit = originalPrintOtionsErrorAndExit;
  });
  
  test('should get app deployment list and display logs', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
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
    
    // Setup mock present
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act - Pass parsed options directly instead of command line args
    await command.execute({
      resourcePool: ['test-resource-pool'],
      apps: ['test-app-1']
    });
    
    // Assert
    const console = container.get('console');
    
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
  
  test('should follow logs in real-time', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
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
    
    // Setup mock present
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act
    await command.execute(['--resource-pool', 'test-resource-pool', '--follow', 'test-app-1']);
    
    // Assert
    const console = container.get('console');
    
    expect(mockExecuteCommand).toHaveBeenCalled();
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
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act
    await command.execute(['--resource-pool', 'test-resource-pool', '--disable-resolving', 'ues:test:app:1']);
    
    // Assert
    const console = container.get('console');
    
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
  
  test('should handle multiple apps with allowMultiApp option', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      },
      { 
        asid: 'test-asid-2',
        code: 'test-app-2',
        uri: 'ues:test:app:2',
        version: '1.0.0'
      }
    ];
    
    const mockLogs = [
      { eventTime: '2023-01-01T10:00:00Z', message: 'Log from app 1' },
      { eventTime: '2023-01-01T10:01:00Z', message: 'Log from app 2' }
    ];
    
    // Setup mock present
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act
    await command.execute(['test-app', '--allow-multi-app']);
    
    // Assert
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
  });
  
  test('should handle date filtering', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    // Setup mock present
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: [],
        totalSize: 0
      })
    });
    
    // Act
    await command.execute(['test-app-1', '--since', '2023-01-01T00:00:00.000Z', '--until', '2023-01-01T23:59:59.000Z']);
    
    // Assert
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      expect.stringContaining('from=2023-01-01T00:00:00.000Z'),
      'get',
      null,
      expect.any(Object)
    );
  });
  
  test('should handle multiple apps without allowMultiApp', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      },
      { 
        asid: 'test-asid-2',
        code: 'test-app-2',
        uri: 'ues:test:app:2',
        version: '1.0.0'
      }
    ];
    
    // Setup mock present
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
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
        uri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    // Setup mock present
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: [],
        totalSize: 0
      })
    });
    
    // Act
    await command.execute(['test-app-1', '--criteria', 'logLevel:ERROR']);
    
    // Assert
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      expect.stringContaining('logLevel=ERROR'),
      'get',
      null,
      expect.any(Object)
    );
  });

  // Test 1: Color handling options
  test('should handle color options - always', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    const mockLogs = [
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'ERROR',
        message: 'Test error message'
      }
    ];
    
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act
    await command.execute({
      resourcePool: ['test-resource-pool'],
      apps: ['test-app-1'],
      color: 'always'
    });
    
    // Assert
    const console = container.get('console');
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  test('should handle color options - never', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    const mockLogs = [
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'WARNING',
        message: 'Test warning message'
      }
    ];
    
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act
    await command.execute({
      resourcePool: ['test-resource-pool'],
      apps: ['test-app-1'],
      color: 'never'
    });
    
    // Assert
    const console = container.get('console');
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  // Test 2: Client-side filtering
  test('should handle client-side filtering with --filter option', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    const mockLogs = [
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'ERROR',
        message: 'Error message'
      },
      {
        appDeploymentUri: 'ues:test:app:1',
        eventTime: new Date(),
        recordType: 'TRACE_LOG', 
        logLevel: 'INFO',
        message: 'Info message'
      }
    ];
    
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act - Filter for ERROR level logs only
    await command.execute({
      resourcePool: ['test-resource-pool'],
      apps: ['test-app-1'],
      filter: 'logLevel == "ERROR"'
    });
    
    // Assert
    const console = container.get('console');
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
    // The actual filtering happens in the business logic
  });

  test('should handle invalid filter expressions', async () => {
    // Arrange
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
      }
    ];
    
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    // Act & Assert - Invalid filter expression should throw
    await expect(command.execute({
      resourcePool: ['test-resource-pool'],
      apps: ['test-app-1'],
      filter: 'invalid filter expression ((('
    })).rejects.toThrow('Cannot parse filter expression');
  });

  // Test 3: Output directory functionality
  test('should save logs to output directory with --output', async () => {
    // Arrange
    const fs = require('fs');
    const path = require('path');
    const mkdirp = require('mkdirp');
    
    // Mock fs operations
    const originalExistsSync = fs.existsSync;
    const originalAppendFileSync = fs.appendFileSync;
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.appendFileSync = jest.fn();
    
    const mockDeployments = [
      { 
        asid: 'test-asid-1',
        code: 'test-app-1',
        uri: 'ues:test:app:1',
        version: '1.0.0'
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
    
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    try {
      // Act
      await command.execute({
        resourcePool: ['test-resource-pool'],
        apps: ['test-app-1'],
        output: '/tmp/test-logs'
      });
      
      // Assert
      expect(mockExecuteCommand).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    } finally {
      // Cleanup
      fs.existsSync = originalExistsSync;
      fs.appendFileSync = originalAppendFileSync;
    }
  });

  // Test 4: Business territory apps with AWSC handling
  test('should handle business territory apps with AWSC', async () => {
    // Arrange - Use the mocked log utils
    const logUtils = require('../../src/misc/log-utils');
    
    // Configure mocks for this test
    logUtils.getLogAccessAttributes.mockResolvedValue({
      logDataUri: 'https://test.example.com/logs/data'
    });
    logUtils.extractLogCriteriaFromUri.mockReturnValue({
      appCode: 'bt-app-1'
    });
    
    const mockDeployments = [
      { 
        asid: 'bt-asid-1',
        code: 'bt-app-1',
        uri: 'bt-app-1',
        version: '1.0.0',
        awscs: [{
          uuAppWorkspaceUri: 'ues:DEV22:DEF:myworkspace',
          oid: 'bt-oid-123456789012345678901234',
          state: 'active',
          appKey: 'bt-app-1/asid12345678901234567890-awid67890'
        }]
      }
    ];
    
    const mockLogs = [
      {
        appDeploymentUri: 'ues:DEV22:DEF:myworkspace',
        eventTime: new Date(),
        recordType: 'TRACE_LOG',
        logLevel: 'INFO',
        message: 'Business territory log message'
      }
    ];
    
    container.get('taskUtils').loadPresent.mockReturnValue({
      mocks: {
        getAppDeploymentList: mockDeployments
      }
    });
    
    mockExecuteCommand.mockResolvedValue({
      body: JSON.stringify({
        pageEntries: mockLogs,
        totalSize: mockLogs.length
      })
    });
    
    // Act
    await command.execute({
      resourcePool: ['https://bt.test.com/territory/123'],
      apps: ['bt-app-1']
    });
    
    // Assert
    const console = container.get('console');
    
    expect(logUtils.getLogAccessAttributes).toHaveBeenCalledWith(
      'ues:DEV22:DEF:myworkspace',
      expect.any(Object)
    );
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });
}); 