const { filterAppDeployments } = require('../../src/uucloud/uucloud-utils');

describe('uucloud-utils', () => {
  describe('filterAppDeployments', () => {
    const mockDeployList = [
      {
        asid: 'app-123-456',
        code: 'my-test-app',
        uri: 'https://my-test-app.example.com',
        tags: ['production', 'stable']
      },
      {
        asid: 'app-789-012',
        code: 'another-app',
        uri: 'https://another-app.example.com',
        tags: ['development', 'beta']
      },
      {
        asid: 'app-345-678',
        code: 'third-app-test',
        uri: 'https://third-app.example.com',
        tags: ['staging']
      },
      {
        asid: 'app-999-888',
        code: 'no-tags-app',
        uri: 'https://no-tags-app.example.com'
      }
    ];
    
    test('should return all apps when no identifiers provided', () => {
      const result = filterAppDeployments(mockDeployList, null);
      
      expect(result).toEqual(mockDeployList);
    });
    
    test('should return empty array when empty identifiers array provided', () => {
      const result = filterAppDeployments(mockDeployList, []);
      
      expect(result).toEqual([]);
    });
    
    test('should filter by exact URI match', () => {
      const result = filterAppDeployments(mockDeployList, ['https://my-test-app.example.com']);
      
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('my-test-app');
    });
    
    test('should filter by ASID prefix match', () => {
      const result = filterAppDeployments(mockDeployList, ['app-123']);
      
      expect(result).toHaveLength(1);
      expect(result[0].asid).toBe('app-123-456');
    });
    
    test('should filter by exact ASID match', () => {
      const result = filterAppDeployments(mockDeployList, ['app-789-012']);
      
      expect(result).toHaveLength(1);
      expect(result[0].asid).toBe('app-789-012');
    });
    
    test('should filter by code substring match', () => {
      const result = filterAppDeployments(mockDeployList, ['test']);
      
      expect(result).toHaveLength(2);
      expect(result.map(app => app.code)).toContain('my-test-app');
      expect(result.map(app => app.code)).toContain('third-app-test');
    });
    
    test('should filter by exact code match', () => {
      const result = filterAppDeployments(mockDeployList, ['another-app']);
      
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('another-app');
    });
    
    test('should filter by single tag match', () => {
      const result = filterAppDeployments(mockDeployList, ['production']);
      
      expect(result).toHaveLength(1);
      expect(result[0].tags).toContain('production');
    });
    
    test('should filter by multiple comma-separated tags (all must match)', () => {
      const result = filterAppDeployments(mockDeployList, ['production,stable']);
      
      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['production', 'stable']);
    });
    
    test('should return empty array when comma-separated tags do not all match', () => {
      const result = filterAppDeployments(mockDeployList, ['production,nonexistent']);
      
      expect(result).toHaveLength(0);
    });
    
    test('should filter by tag that also matches code', () => {
      // Add test case where tag name might also be in code
      const testList = [
        ...mockDeployList,
        {
          asid: 'app-555-666',
          code: 'beta-release-app',
          uri: 'https://beta-release.example.com',
          tags: ['production']
        }
      ];
      
      const result = filterAppDeployments(testList, ['beta']);
      
      expect(result).toHaveLength(2); // One from tags, one from code
    });
    
    test('should handle apps without tags', () => {
      const result = filterAppDeployments(mockDeployList, ['no-tags']);
      
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('no-tags-app');
    });
    
    test('should handle apps without code', () => {
      const listWithoutCode = [
        {
          asid: 'app-without-code',
          uri: 'https://no-code.example.com',
          tags: ['test']
        }
      ];
      
      const result = filterAppDeployments(listWithoutCode, ['app-without']);
      
      expect(result).toHaveLength(1);
    });
    
    test('should handle multiple identifiers with OR logic', () => {
      const result = filterAppDeployments(mockDeployList, ['my-test-app', 'another-app']);
      
      expect(result).toHaveLength(2);
      expect(result.map(app => app.code)).toContain('my-test-app');
      expect(result.map(app => app.code)).toContain('another-app');
    });
    
    test('should return empty array when no matches found', () => {
      const result = filterAppDeployments(mockDeployList, ['nonexistent']);
      
      expect(result).toHaveLength(0);
    });
    
    test('should handle mixed identifier types', () => {
      const result = filterAppDeployments(mockDeployList, [
        'app-123', // ASID prefix
        'staging', // tag
        'https://no-tags-app.example.com' // exact URI
      ]);
      
      expect(result).toHaveLength(3);
    });
  });
});