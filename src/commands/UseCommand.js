const Command = require('../interfaces/Command');
const Config = require("../misc/config");
const {commonOptionsDefinitionsWithResourcePool, verifyCommonOptionsDefinitionsWithResourcePool} = require("../misc/common-tasks-option");

const optionsDefinitions = commonOptionsDefinitionsWithResourcePool;

const help = [
  {
    header: "use command",
    content: "Sets up default parameter values. This parameter values will be used as default by all other commands, if not overridden."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud use [-r {underline resource pool uri}] [-a {underline browser|vault|interactive}] [-u {underline user uid}]'
  },
  {
    header: 'Options',
    optionList: optionsDefinitions
  }
];

/**
 * Command implementation for the 'use' command
 */
class UseCommand extends Command {
  /**
   * Create a new UseCommand instance
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    super(dependencies);
    
    // Extract dependencies
    this._console = dependencies.console;
    this._taskUtils = dependencies.taskUtils;
  }
  
  /**
   * Execute the use command
   * @param {Array} args - Command line arguments
   * @returns {Promise<void>}
   */
  async execute(args) {
    try {
      // Parse and validate arguments
      let options = this._taskUtils.parseCliArguments(args);
      verifyCommonOptionsDefinitionsWithResourcePool(options, this._taskUtils);
      
      // Set config values
      Object.keys(options).forEach(key => Config.set(key, options[key]));
      
      // Display current configuration
      this._console.error("Current configuration:");
      this._console.log(JSON.stringify(Config.all, null, 2));
    } catch (error) {
      this._console.error(`Error: ${error.message}`);
      throw error;
    }
  }
}

// Set static properties
UseCommand.optionsDefinitions = optionsDefinitions;
UseCommand.help = help;

module.exports = UseCommand;