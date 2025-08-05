const PsCommand = require('../../src/commands/PsCommand');
const Container = require('../../src/di/Container');
const RealCloudClient = require('../../src/implementations/RealCloudClient');
const CloudClient = require('../../src/interfaces/CloudClient');
const TaskUtils = require('../../src/misc/task-utils');
const UuCloud = require('../../src/uucloud/uucloud');
const UuUniverseClient = require('../../src/uucloud/uu-universe-client');
const { AppClient } = require('uu_appg01_core-appclient');

describe('PsCommand - using DI container with minimal mocks', () => {
  let originalExecuteCommand;
  let originalCommandGet;
  let originalLoadPresent;
  let originalAppClientGet;
  let mockExecuteCommand;
  let mockCommandGet;
  let container;
  let command;
  
  beforeAll(() => {
    // Store original methods
    originalExecuteCommand = UuCloud.prototype._executeCommand;
    originalLoadPresent = TaskUtils.prototype.loadPresent;
    originalAppClientGet = AppClient.get;
    // For private methods, we need to access them differently
    originalCommandGet = UuUniverseClient.prototype.constructor;
  });
  
  beforeEach(() => {
    // Create mock functions
    mockExecuteCommand = jest.fn();
    mockCommandGet = jest.fn();
    
    // Replace only the specific methods
    UuCloud.prototype._executeCommand = mockExecuteCommand;
    
    // Mock the private #commandGet method by intercepting the getAppDeploymentList method
    const originalGetAppDeploymentList = UuUniverseClient.prototype.getAppDeploymentList;
    UuUniverseClient.prototype.getAppDeploymentList = async function(resourcePoolOid) {
      let deployList = [];
      for (let rp of resourcePoolOid) {
        let res = await mockCommandGet("uuSubAppInstanceWorkload/list", {uuAppResourcePoolOid: rp});
        deployList = deployList.concat(res.itemList);
      }
      return deployList.map(item => ({
        asid: item.asid,
        code: item.urlPath,
        version: item.version,
        tags: item.uuAppServerEnvironment?.tags || "",
        nodeSize: null,
        nodeCount: null,
        cpu: null,
        memory: null,
        state: item.state,
        uuAppServerEnvironment: item.uuAppServerEnvironment,
        data: item,
        sourceType: "resource-pool"
      }));
    };
    
    // Mock only the loadPresent method from TaskUtils
    TaskUtils.prototype.loadPresent = jest.fn().mockReturnValue(null);
    
    // Mock AppClient.get for BusinessTerritoryClient
    AppClient.get = jest.fn();
    
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
      .registerService('CloudClient', CloudClient, (token, opts) => new RealCloudClient(token, opts));
    
    // Create command using real DI mechanism
    command = container.createCommand(PsCommand);
  });
  
  afterEach(() => {
    // Restore original methods
    UuCloud.prototype._executeCommand = originalExecuteCommand;
    UuUniverseClient.prototype.getAppDeploymentList = require('../../src/uucloud/uu-universe-client').prototype.getAppDeploymentList;
    TaskUtils.prototype.loadPresent = originalLoadPresent;
    AppClient.get = originalAppClientGet;
  });
  
  test('should execute PsCommand with UuCloud provider using mocked _executeCommand', async () => {
    // Arrange
    const mockResponse = {
      body: JSON.stringify({
        pageEntries: [
          {
            uri: 'ues:test:testApp1',
            code: 'test-app-1',
            asid: 'test-asid-1',
            version: '1.0.0',
            config: {
              deployUnits: [{ nodeSize: 'small' }],
              deploymentTimeConfig: { tags: 'tag1' }
            },
            nodeSets: [{ nodeCount: 1 }],
            allocatedCapacity: { cpu: 100, mem: 512 },
            state: 'active'
          }
        ],
        totalSize: 1
      })
    };
    
    mockExecuteCommand.mockResolvedValue(mockResponse);
    
    // Act
    await command.execute(['--resource-pool', 'ues:test:testResourcePool', '--c3-uri', 'https://test-c3.uri/']);
    
    // Assert
    const tokenProvider = container.get('tokenProvider');
    const console = container.get('console');
    
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      expect.stringContaining('uu-c3/AppDeployment/getAppDeploymentList/exec'),
      'get',
      null,
      {},
      expect.objectContaining({
        'Accept': 'application/json',
        'Content-type': 'application/json'
      })
    );
    expect(console.log).toHaveBeenCalled();
    
    // Verify table output format
    const consoleOutput = console.log.mock.calls[0][0];
    expect(consoleOutput).toContain('test-asid-1');
    expect(consoleOutput).toContain('test-app-1');
  });
  
  test('should execute PsCommand with UuUniverseClient provider using mocked #commandGet', async () => {
    // Arrange
    const mockResponse = {
      itemList: [
        {
          asid: 'test-asid-1',
          urlPath: 'test-app-1',
          version: '1.0.0',
          state: 'active',
          uuAppServerEnvironment: { tags: 'tag1' }
        }
      ]
    };
    
    mockCommandGet.mockResolvedValue(mockResponse);
    
    // Act
    await command.execute(['--resource-pool', '507f1f77bcf86cd799439011', '--universe-uri', 'https://test-universe.uri/']);
    
    // Assert
    const tokenProvider = container.get('tokenProvider');
    const console = container.get('console');
    
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(mockCommandGet).toHaveBeenCalledWith(
      'uuSubAppInstanceWorkload/list',
      { uuAppResourcePoolOid: '507f1f77bcf86cd799439011' }
    );
    expect(console.log).toHaveBeenCalled();
    
    // Verify table output contains the data
    const consoleOutput = console.log.mock.calls[0][0];
    expect(consoleOutput).toContain('test-asid-1');
    expect(consoleOutput).toContain('test-app-1');
  });
  
  test('should execute PsCommand with raw codec format', async () => {
    // Arrange
    const mockResponse = {
      body: JSON.stringify({
        pageEntries: [
          {
            uri: 'ues:test:testApp3',
            code: 'test-app-3',
            asid: 'test-asid-3',
            version: '1.0.0',
            config: {
              deployUnits: [{ nodeSize: 'small' }],
              deploymentTimeConfig: { tags: 'tag3' }
            },
            nodeSets: [{ nodeCount: 1 }],
            allocatedCapacity: { cpu: 100, mem: 512 },
            state: 'active'
          }
        ],
        totalSize: 1
      })
    };
    
    mockExecuteCommand.mockResolvedValue(mockResponse);
    
    // Act
    await command.execute(['--resource-pool', 'ues:test:testResourcePool3', '--codec', 'raw', '--c3-uri', 'https://test-c3.uri/']);
    
    // Assert
    const console = container.get('console');
    
    expect(mockExecuteCommand).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
    
    // Verify raw output format (JSON)
    const consoleOutput = console.log.mock.calls[0][0];
    const parsedOutput = JSON.parse(consoleOutput);
    expect(parsedOutput).toHaveProperty('itemList');
  });
  
  test('should handle multiple resource pools with mocked _executeCommand', async () => {
    // Arrange
    const mockResponse1 = {
      body: JSON.stringify({
        pageEntries: [
          {
            uri: 'ues:test:testApp1',
            code: 'test-app-1',
            asid: 'test-asid-1',
            version: '1.0.0',
            config: { deployUnits: [{ nodeSize: 'small' }], deploymentTimeConfig: {} },
            nodeSets: [{ nodeCount: 1 }],
            allocatedCapacity: { cpu: 100, mem: 512 },
            state: 'active'
          }
        ],
        totalSize: 1
      })
    };
    
    const mockResponse2 = {
      body: JSON.stringify({
        pageEntries: [
          {
            uri: 'ues:test:testApp2',
            code: 'test-app-2',
            asid: 'test-asid-2',
            version: '2.0.0',
            config: { deployUnits: [{ nodeSize: 'medium' }], deploymentTimeConfig: {} },
            nodeSets: [{ nodeCount: 2 }],
            allocatedCapacity: { cpu: 200, mem: 1024 },
            state: 'active'
          }
        ],
        totalSize: 1
      })
    };
    
    mockExecuteCommand
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);
    
    // Act
    await command.execute([
      '--resource-pool', 'ues:test:testResourcePool1', 
      '--resource-pool', 'ues:test:testResourcePool2', 
      '--c3-uri', 'https://test-c3.uri/'
    ]);
    
    // Assert
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
    expect(container.get('console').log).toHaveBeenCalled();
  });
  
  test('should execute PsCommand with business territory resource pool using mocked AppClient.get', async () => {
    // Arrange
    AppClient.get
      .mockResolvedValueOnce({
        // First call: listInstalledUuApps
        data: { 
          installedUuApps: [
            { code: 'bt-test-app', version: '1.0.0' },
            { code: 'bt-another-app', version: '2.0.0' }
          ] 
        }
      })
      .mockResolvedValueOnce({
        // Second call: listAppAwscs  
        data: { 
          awscs: {
            'bt-test-app': [{
              uuAppWorkspaceUri: 'ues:test:workspace:12345-67890',
              oid: 'bt-oid-123456789012345678901234',
              state: 'active',
              appKey: 'bt-test-app/asid12345678901234567890-awid67890',
              unitName: 'Main Unit'
            }],
            'bt-another-app': [{
              uuAppWorkspaceUri: 'ues:test:workspace:98765-43210',
              oid: 'bt-oid-987654321098765432109876',
              state: 'active',
              appKey: 'bt-another-app/asid98765432109876543210-awid43210',
              unitName: 'Secondary Unit'
            }]
          }
        }
      });

    // Act
    await command.execute([
      '--resource-pool', 'https://bt.test.unicorn.com/territory/123',
      '--c3-uri', 'https://test-c3.uri/'
    ]);

    // Assert
    const tokenProvider = container.get('tokenProvider');
    const console = container.get('console');

    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(AppClient.get).toHaveBeenCalledTimes(2);
    
    // Verify listInstalledUuApps call
    expect(AppClient.get).toHaveBeenCalledWith(
      expect.stringContaining('listInstalledUuApps'),
      {},
      expect.objectContaining({ headers: expect.any(Object) })
    );
    
    // Verify listAppAwscs call
    expect(AppClient.get).toHaveBeenCalledWith(
      expect.stringContaining('listAppAwscs'),
      { appCodeList: ['bt-test-app', 'bt-another-app'] },
      expect.objectContaining({ headers: expect.any(Object) })
    );
    
    expect(console.log).toHaveBeenCalled();
    
    // Verify table output contains business territory apps
    const consoleOutput = console.log.mock.calls[0][0];
    expect(consoleOutput).toContain('asid12345678901234567890');
    expect(consoleOutput).toContain('bt-test-app');
  });
  
  test('should handle business territory with universe resource pools', async () => {
    // Arrange - Mock UuUniverseClient response (OID)
    const universeResponse = {
      itemList: [{
        asid: 'universe-mixed-asid-1',
        urlPath: 'universe-mixed-app-1',
        version: '2.0.0',
        state: 'active',
        uuAppServerEnvironment: { tags: 'universe-mixed-tag' }
      }]
    };
    
    mockCommandGet.mockResolvedValue(universeResponse);
    
    // Mock BusinessTerritory response
    AppClient.get
      .mockResolvedValueOnce({
        data: { installedUuApps: [{ code: 'bt-mixed-app', version: '1.5.0' }] }
      })
      .mockResolvedValueOnce({
        data: { 
          awscs: {
            'bt-mixed-app': [{
              uuAppWorkspaceUri: 'ues:test:workspace:mixed-12345',
              oid: 'bt-mixed-oid123456789012345678901234',
              state: 'active',
              appKey: 'bt-mixed-app/asidmixed12345678901234567890-awidmixed12345'
            }]
          }
        }
      });

    // Act - Mix OID (UuUniverseClient) and HTTPS URL (BusinessTerritory) - Valid combination
    await command.execute([
      '--resource-pool', '507f1f77bcf86cd799439033',  // Universe (OID)
      '--resource-pool', 'https://bt.mixed.unicorn.com/territory/456', // BusinessTerritory
      '--universe-uri', 'https://test-universe.uri/'
    ]);

    // Assert - Both Universe and BusinessTerritory clients were called
    const tokenProvider = container.get('tokenProvider');
    const console = container.get('console');
    
    expect(tokenProvider.getToken).toHaveBeenCalled();
    expect(mockCommandGet).toHaveBeenCalled(); // UuUniverseClient
    expect(AppClient.get).toHaveBeenCalled(); // BusinessTerritory
    expect(console.log).toHaveBeenCalled();
    
    // Verify output contains apps from both sources
    const consoleOutput = console.log.mock.calls[0][0];
    expect(consoleOutput).toContain('universe-mixed-asid-1'); // From Universe
    expect(consoleOutput).toContain('asidmixed12345678901234567890'); // From BusinessTerritory
  });
  
  test('should handle multiple C3 resource pools together', async () => {
    // Arrange - Mock UuCloud responses for multiple C3 resource pools
    const mockResponse1 = {
      body: JSON.stringify({
        pageEntries: [{
          uri: 'ues:test:c3App1',
          code: 'c3-app-1',
          asid: 'c3-asid-1',
          version: '1.0.0',
          config: { deployUnits: [{ nodeSize: 'small' }], deploymentTimeConfig: {} },
          nodeSets: [{ nodeCount: 1 }],
          allocatedCapacity: { cpu: 100, mem: 512 },
          state: 'active'
        }],
        totalSize: 1
      })
    };
    
    const mockResponse2 = {
      body: JSON.stringify({
        pageEntries: [{
          uri: 'ues:test:c3App2',
          code: 'c3-app-2',
          asid: 'c3-asid-2',
          version: '2.0.0',
          config: { deployUnits: [{ nodeSize: 'medium' }], deploymentTimeConfig: {} },
          nodeSets: [{ nodeCount: 2 }],
          allocatedCapacity: { cpu: 200, mem: 1024 },
          state: 'active'
        }],
        totalSize: 1
      })
    };
    
    mockExecuteCommand
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    // Act - Multiple C3 resource pools (UES URIs) - Valid combination
    await command.execute([
      '--resource-pool', 'ues:test:c3ResourcePool1',
      '--resource-pool', 'ues:test:c3ResourcePool2',
      '--c3-uri', 'https://test-c3.uri/'
    ]);

    // Assert - UuCloud client called twice for both resource pools
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
    expect(container.get('console').log).toHaveBeenCalled();
    
    // Verify output contains apps from both C3 resource pools
    const consoleOutput = container.get('console').log.mock.calls[0][0];
    expect(consoleOutput).toContain('c3-asid-1');
    expect(consoleOutput).toContain('c3-asid-2');
  });
  
  test('should handle multiple universe resource pools with business territory', async () => {
    // Arrange - Mock UuUniverseClient responses for multiple OIDs
    const universeResponse = {
      itemList: [
        {
          asid: 'universe-multi-asid-1',
          urlPath: 'universe-multi-app-1',
          version: '2.0.0',
          state: 'active',
          uuAppServerEnvironment: { tags: 'universe-multi-tag1' }
        },
        {
          asid: 'universe-multi-asid-2',
          urlPath: 'universe-multi-app-2',
          version: '2.1.0',
          state: 'active',
          uuAppServerEnvironment: { tags: 'universe-multi-tag2' }
        }
      ]
    };
    
    mockCommandGet.mockResolvedValue(universeResponse);
    
    // Mock BusinessTerritory response
    AppClient.get
      .mockResolvedValueOnce({
        data: { installedUuApps: [{ code: 'bt-multi-app', version: '3.0.0' }] }
      })
      .mockResolvedValueOnce({
        data: { 
          awscs: {
            'bt-multi-app': [{
              uuAppWorkspaceUri: 'ues:test:workspace:multi-789',
              oid: 'bt-multi-oid123456789012345678901234',
              state: 'active',
              appKey: 'bt-multi-app/asidmulti789012345678901234567890-awidmulti789'
            }]
          }
        }
      });

    // Act - Multiple Universe OIDs + BusinessTerritory - Valid combination
    await command.execute([
      '--resource-pool', '507f1f77bcf86cd799439044',  // Universe OID 1
      '--resource-pool', '507f1f77bcf86cd799439055',  // Universe OID 2
      '--resource-pool', 'https://bt.multi.com/territory/999', // BusinessTerritory
      '--universe-uri', 'https://test-universe.uri/'
    ]);

    // Assert - Both Universe and BusinessTerritory clients were called
    expect(mockCommandGet).toHaveBeenCalled(); // UuUniverseClient
    expect(AppClient.get).toHaveBeenCalled(); // BusinessTerritory
    expect(container.get('console').log).toHaveBeenCalled();
    
    // Verify output contains apps from both sources
    const consoleOutput = container.get('console').log.mock.calls[0][0];
    expect(consoleOutput).toContain('universe-multi-asid-1'); // From Universe
    expect(consoleOutput).toContain('asidmulti7890123456789012345678'); // From BusinessTerritory (truncated in display)
  });
});