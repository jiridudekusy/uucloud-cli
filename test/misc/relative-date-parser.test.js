const parseRelativeDateTime = require('../../src/misc/relative-date-parser');

describe('parseRelativeDateTime', () => {
  const refDate = new Date('2023-01-01T12:00:00Z');
  
  test('should parse absolute date string', () => {
    const result = parseRelativeDateTime('2023-01-01T10:00:00Z', refDate);
    
    expect(result).toEqual(new Date('2023-01-01T10:00:00Z'));
  });
  
  test('should parse relative time in minutes', () => {
    const result = parseRelativeDateTime('30m', refDate);
    
    const expected = new Date(refDate);
    expected.setMinutes(expected.getMinutes() - 30);
    expect(result).toEqual(expected);
  });
  
  test('should parse relative time in hours', () => {
    const result = parseRelativeDateTime('2h', refDate);
    
    const expected = new Date(refDate);
    expected.setHours(expected.getHours() - 2);
    expect(result).toEqual(expected);
  });
  
  test('should parse single digit relative time', () => {
    const result = parseRelativeDateTime('5m', refDate);
    
    const expected = new Date(refDate);
    expected.setMinutes(expected.getMinutes() - 5);
    expect(result).toEqual(expected);
  });
  
  test('should parse large numbers for relative time', () => {
    const result = parseRelativeDateTime('120m', refDate);
    
    const expected = new Date(refDate);
    expected.setMinutes(expected.getMinutes() - 120);
    expect(result).toEqual(expected);
  });
  
  test('should return undefined for invalid relative format', () => {
    const result = parseRelativeDateTime('30s', refDate);
    
    expect(result).toBeUndefined();
  });
  
  test('should return undefined for invalid format without unit', () => {
    const result = parseRelativeDateTime('30', refDate);
    
    expect(result).toBeUndefined();
  });
  
  test('should return undefined for invalid format with wrong unit', () => {
    const result = parseRelativeDateTime('30d', refDate);
    
    expect(result).toBeUndefined();
  });
  
  test('should return undefined for non-numeric amount', () => {
    const result = parseRelativeDateTime('abcm', refDate);
    
    expect(result).toBeUndefined();
  });
  
  test('should return undefined for empty string', () => {
    const result = parseRelativeDateTime('', refDate);
    
    expect(result).toBeUndefined();
  });
  
  test('should handle ISO date strings', () => {
    const result = parseRelativeDateTime('2023-01-01', refDate);
    
    expect(result).toEqual(new Date('2023-01-01'));
  });
  
  test('should handle different reference dates', () => {
    const differentRefDate = new Date('2023-06-15T18:30:00Z');
    const result = parseRelativeDateTime('45m', differentRefDate);
    
    const expected = new Date(differentRefDate);
    expected.setMinutes(expected.getMinutes() - 45);
    expect(result).toEqual(expected);
  });
  
  test('should handle zero amounts', () => {
    const result = parseRelativeDateTime('0m', refDate);
    
    expect(result).toEqual(refDate);
  });
  
  test('should not modify original reference date', () => {
    const originalRefDate = new Date('2023-01-01T12:00:00Z');
    const refDateCopy = new Date(originalRefDate);
    
    parseRelativeDateTime('30m', refDateCopy);
    
    expect(originalRefDate).toEqual(new Date('2023-01-01T12:00:00Z'));
  });
});