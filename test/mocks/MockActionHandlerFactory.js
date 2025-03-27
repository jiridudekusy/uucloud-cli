/**
 * Mock implementation of action handler factory for testing
 */
const mockHandler = {
  getGroupedActionMenu: jest.fn().mockResolvedValue([
    { name: 'Action 1', value: 'action1' },
    { name: 'Action 2', value: 'action2' }
  ]),
  processAction: jest.fn().mockResolvedValue(true)
};

const actionHandlerFactory = {
  getHandler: jest.fn().mockReturnValue(mockHandler)
};

module.exports = actionHandlerFactory; 