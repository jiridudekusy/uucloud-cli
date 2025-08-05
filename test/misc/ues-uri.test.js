const UESUri = require('../../src/misc/ues-uri');

describe('UESUri', () => {
  describe('parse', () => {
    test('should parse valid UES URI with territory code and artifact code', () => {
      const result = UESUri.parse('ues:territory.code:artifact.code');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory.code');
      expect(result.territory.id).toBeUndefined();
      expect(result.artifact.code).toBe('artifact.code');
      expect(result.artifact.id).toBeUndefined();
      expect(result.object.code).toBeUndefined();
      expect(result.object.id).toBeUndefined();
    });
    
    test('should parse UES URI with territory ID in brackets', () => {
      const result = UESUri.parse('ues:territory[12345]:artifact.code');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory');
      expect(result.territory.id).toBe('12345');
      expect(result.artifact.code).toBe('artifact.code');
    });
    
    test('should parse UES URI with artifact ID in brackets', () => {
      const result = UESUri.parse('ues:territory.code:artifact[67890]');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory.code');
      expect(result.artifact.code).toBe('artifact');
      expect(result.artifact.id).toBe('67890');
    });
    
    test('should parse UES URI with object code', () => {
      const result = UESUri.parse('ues:territory.code:artifact.code:object.code');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory.code');
      expect(result.artifact.code).toBe('artifact.code');
      expect(result.object.code).toBe('object.code');
      expect(result.object.id).toBeUndefined();
    });
    
    test('should parse UES URI with object ID in brackets', () => {
      const result = UESUri.parse('ues:territory.code:artifact.code:object[11111]');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory.code');
      expect(result.artifact.code).toBe('artifact.code');
      expect(result.object.code).toBe('object');
      expect(result.object.id).toBe('11111');
    });
    
    test('should parse UES URI with only IDs', () => {
      const result = UESUri.parse('ues:[12345]:[67890]:[11111]');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBeUndefined();
      expect(result.territory.id).toBe('12345');
      expect(result.artifact.code).toBeUndefined();
      expect(result.artifact.id).toBe('67890');
      expect(result.object.code).toBeUndefined();
      expect(result.object.id).toBe('11111');
    });
    
    test('should handle complex codes with dots, dashes, and slashes', () => {
      const result = UESUri.parse('ues:territory-1.code:artifact/sub.path-2:object.final-code');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory-1.code');
      expect(result.artifact.code).toBe('artifact/sub.path-2');
      expect(result.object.code).toBe('object.final-code');
    });
    
    test('should return undefined for invalid UES URI format', () => {
      const result = UESUri.parse('invalid:uri:format');
      
      expect(result).toBeUndefined();
    });
    
    test('should return undefined for UES URI without territory', () => {
      const result = UESUri.parse('ues::artifact.code');
      
      expect(result).toBeNull();
    });
    
    test('should return undefined for UES URI without artifact', () => {
      const result = UESUri.parse('ues:territory.code:');
      
      expect(result).toBeNull();
    });
    
    test('should return undefined for empty string', () => {
      const result = UESUri.parse('');
      
      expect(result).toBeUndefined();
    });
    
    test('should return undefined for non-UES URI', () => {
      const result = UESUri.parse('http://example.com');
      
      expect(result).toBeUndefined();
    });
    
    test('should handle UES URI with alphanumeric IDs', () => {
      const result = UESUri.parse('ues:territory[abc123]:artifact[def456]:object[ghi789]');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('territory');
      expect(result.territory.id).toBe('abc123');
      expect(result.artifact.code).toBe('artifact');
      expect(result.artifact.id).toBe('def456');
      expect(result.object.code).toBe('object');
      expect(result.object.id).toBe('ghi789');
    });
    
    test('should handle minimal valid UES URI', () => {
      const result = UESUri.parse('ues:t:a');
      
      expect(result).toBeDefined();
      expect(result.territory.code).toBe('t');
      expect(result.artifact.code).toBe('a');
      expect(result.object.code).toBeUndefined();
    });
  });
});