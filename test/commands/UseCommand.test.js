const UseCommand = require('../../src/commands/UseCommand');
const MockConsole = require('../mocks/MockConsole');
const MockTaskUtils = require('../mocks/MockTaskUtils');
const Config = require('../../src/misc/config');

// Mock the Config module
jest.mock('../../src/misc/config');

describe('UseCommand', () => {
  let command;
  let console;
  let taskUtils;
  
  beforeEach(() => {
    // Setup mock dependencies
    console = new MockConsole();
    taskUtils = new MockTaskUtils();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup Config mock
    Config.set = jest.fn();
    Config.all = { resourcePool: 'old-resource-pool' };
    
    // Create command with mock dependencies
    command = new UseCommand({
      console,
      taskUtils
    });
  });
  
  test('should save options to config', async () => {
    // Arrange
    const mockOptions = { 
      resourcePool: ['test-resource-pool'],
      auth: 'interactive'
    };
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue(mockOptions);
    
    // Act
    await command.execute(['-r', 'test-resource-pool', '-a', 'interactive']);
    
    // Assert
    expect(taskUtils.parseCliArguments).toHaveBeenCalled();
    
    // Verify that Config.set was called for each option
    expect(Config.set).toHaveBeenCalledWith('resourcePool', mockOptions.resourcePool);
    expect(Config.set).toHaveBeenCalledWith('auth', 'interactive');
    
    expect(console.error).toHaveBeenCalledWith('Current configuration:');
    expect(console.log).toHaveBeenCalled();
  });
  

  test('should display updated configuration', async () => {
    // Arrange
    const mockOptions = { resourcePool: ['new-resource-pool'] };
    const updatedConfig = { resourcePool: ['new-resource-pool'] };
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue(mockOptions);
    Config.all = updatedConfig;
    
    // Act
    await command.execute(['-r', 'new-resource-pool']);
    
    // Assert
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(updatedConfig, null, 2));
  });
  
  test('should handle multiple configuration options', async () => {
    // Arrange
    const mockOptions = { 
      resourcePool: ['test-resource-pool'],
      auth: 'browser',
      userUid: 'test-user'
    };
    
    // Setup mock behavior
    taskUtils.parseCliArguments.mockReturnValue(mockOptions);
    
    // Act
    await command.execute(['-r', 'test-resource-pool', '-a', 'browser', '-u', 'test-user']);
    
    // Assert
    // Check that Config.set was called for each option
    expect(Config.set).toHaveBeenCalledWith('resourcePool', mockOptions.resourcePool);
    expect(Config.set).toHaveBeenCalledWith('auth', 'browser');
    expect(Config.set).toHaveBeenCalledWith('userUid', 'test-user');
  });
});