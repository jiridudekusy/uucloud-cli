const { getAppConfig } = require('../../src/misc/config-utils');

describe('config-utils', () => {
  describe('getAppConfig', () => {
    test('should return undefined for business territory apps', () => {
      const subAppDeployment = {
        source: 'business-territory',
        uuAppServerEnvironment: {
          key1: 'value1',
          key2: 'value2'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1');
      
      expect(result).toBeUndefined();
    });
    
    test('should return config value for first matching key', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key1: 'value1',
          key2: 'value2',
          key3: 'value3'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1');
      
      expect(result).toBe('value1');
    });
    
    test('should return config value for first available key from multiple keys', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key2: 'value2',
          key3: 'value3'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1', 'key2', 'key3');
      
      expect(result).toBe('value2');
    });
    
    test('should return undefined when key does not exist', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key1: 'value1'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'nonexistent');
      
      expect(result).toBeUndefined();
    });
    
    test('should return undefined when uuAppServerEnvironment is undefined', () => {
      const subAppDeployment = {
        source: 'uucloud'
      };
      
      const result = getAppConfig(subAppDeployment, 'key1');
      
      expect(result).toBeUndefined();
    });
    
    test('should return undefined when uuAppServerEnvironment is null', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: null
      };
      
      const result = getAppConfig(subAppDeployment, 'key1');
      
      expect(result).toBeUndefined();
    });
    
    test('should handle nested object values', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key1: {
            nested: 'nested_value'
          }
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1');
      
      expect(result).toEqual({ nested: 'nested_value' });
    });
    
    test('should handle falsy values that are not undefined or null', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key1: false,
          key2: 0,
          key3: '',
          key4: 'value4'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1', 'key2', 'key3', 'key4');
      
      expect(result).toBe(false);
    });
    
    test('should skip null values and find next available', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key1: null,
          key2: 'value2'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1', 'key2');
      
      expect(result).toBe('value2');
    });
    
    test('should skip undefined values and find next available', () => {
      const subAppDeployment = {
        source: 'uucloud',
        uuAppServerEnvironment: {
          key1: undefined,
          key2: 'value2'
        }
      };
      
      const result = getAppConfig(subAppDeployment, 'key1', 'key2');
      
      expect(result).toBe('value2');
    });
  });
});