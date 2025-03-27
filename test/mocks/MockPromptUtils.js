/**
 * Mock implementation of prompt utilities for testing
 */
const promptUtils = {
  searchPrompt: jest.fn().mockResolvedValue('test-value')
};

module.exports = promptUtils; 