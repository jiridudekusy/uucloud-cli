/**
 * Interface for CLI commands
 */
class Command {
  /**
   * Create a new command instance
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    this._deps = dependencies;
  }
  
  /**
   * Execute the command with the provided arguments
   * @param {Array} args - Command line arguments
   * @returns {Promise<any>} - Command execution result
   */
  async execute(args) { 
    throw new Error("Method execute not implemented"); 
  }
}

module.exports = Command; 