const Command = require('../interfaces/Command');
const Table = require('cli-table2');
const {commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent} = require("../misc/common-tasks-option");
const {filterAppDeployments} = require("../uucloud/uucloud-utils");

const optionsDefinitions = [
  ...commonOptionsDefinitionsWithPresentAndApps,
  {
    name: "codec",
    type: String,
    description: `Format od result. Supported values : "table"(default) or "raw"(JSON received from command call. It can be filtered using "apps" option.)`,
    defaultValue: "table"
  }
];

const help = [
  {
    header: "ps command",
    content: "Displays list of deployed uuApps."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud ps -r {underline uri}'
  },
  {
    header: 'Options',
    optionList: optionsDefinitions
  }
];

/**
 * Command implementation for the 'ps' command
 */
class PsCommand extends Command {
  /**
   * Create a new PsCommand instance
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    super(dependencies);
    
    // Extract dependencies
    this._tokenProvider = dependencies.tokenProvider;
    this._serviceFactory = dependencies.serviceFactory;
    this._console = dependencies.console;
    this._taskUtils = dependencies.taskUtils;
  }
  
  /**
   * Execute the ps command
   * @param {Array} args - Command line arguments
   * @returns {Promise<void>}
   */
  async execute(args) {
    try {
      // Parse and validate arguments
      let options = this._taskUtils.parseCliArguments(args);
      verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
      this._taskUtils.testOption(["raw", "table"].includes(options.codec), "Incorrect codec value.");
      
      let present = this._taskUtils.loadPresent(options);
      options = this._taskUtils.mergeWithConfig(options, present);
      
      if (!present || !present.mocks || !present.mocks.getAppDeploymentList) {
        this._taskUtils.testOption(options.resourcePool,
            "Resource pool must be either specified as option, using uucloud use or present with mock response to getAppDeploymentList must be loaded.");
      }

      // Get resource pool from options
      // If it's not an array yet, make it an array for consistency
      if (options.resourcePool && !Array.isArray(options.resourcePool)) {
        options.resourcePool = [options.resourcePool];
      }
      
      // Execute the command
      await this._getResourcePoolInfo(options, present);
    } catch (error) {
      this._console.error(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get and display resource pool information
   * @param {Object} options - Command options
   * @param {Object} present - Present configuration
   * @returns {Promise<void>}
   * @private
   */
  async _getResourcePoolInfo(options, present) {
    let deployList;
    
    if (present?.mocks?.getAppDeploymentList) {
      deployList = present.mocks.getAppDeploymentList;
      deployList.forEach(app => app.source = app.source || 'resource-pool-mock');
    } else {
      const oidcToken = await this._tokenProvider.getToken(options);
      
      // Create the cloud client using CloudClient interface
      const uuCloud = this._serviceFactory('CloudClient', oidcToken, options);
      
      deployList = await uuCloud.getAppDeploymentList(options.resourcePool);
    }
    
    if (options.codec === "table") {
      this._printTable(deployList, options.apps);
    } else if (options.codec === "raw") {
      this._printRaw(deployList, options.apps);
    }
  }

  /**
   * Print raw JSON output
   * @param {Array} deployList - List of deployments
   * @param {Array} apps - Filter for applications
   * @private
   */
  _printRaw(deployList, apps) {
    let filteredPageEntries;
    
    if (apps) {
      filteredPageEntries = filterAppDeployments(deployList, apps);
    } else {
      filteredPageEntries = deployList;
    }
    
    filteredPageEntries = filteredPageEntries.map(item => item.data);
    this._console.log(JSON.stringify({itemList: filteredPageEntries}, null, 2));
  }

  /**
   * Print formatted table output
   * @param {Array} deployList - List of deployments
   * @param {Array} apps - Filter for applications
   * @private
   */
  _printTable(deployList, apps) {
    // Get terminal width and calculate column widths
    const terminalWidth = process.stdout.columns || 80;
    const tableConfig = this._calculateTableConfig(terminalWidth);

    let table = new Table(tableConfig);
    
    let itemList = deployList;
    let filteredPageEntries = filterAppDeployments(deployList, apps);
    let filteredRecords = filteredPageEntries;
    let allRecords = itemList;
    
    let totalFiltered = this._countTotal(filteredRecords, "Total filtered");
    let totalAll = this._countTotal(allRecords, "Total");
    
    if (totalAll.nodeCount != totalFiltered.nodeCount) {
      filteredRecords.push(totalFiltered);
    }
    
    filteredRecords.push(totalAll);

    filteredRecords.forEach(record => 
      table.push([
        record.asid, 
        record.code, 
        record.version, 
        record.tags, 
        record.nodeSize, 
        record.nodeCount, 
        record.cpu, 
        record.memory, 
        record.state
      ])
    );
    
    this._console.log(table.toString());
  }

  /**
   * Calculate table configuration based on terminal width
   * @param {number} terminalWidth - Available terminal width
   * @returns {Object} - Table configuration object
   * @private
   */
  _calculateTableConfig(terminalWidth) {
    // Account for table borders and padding (3 chars per column + 1 for final border)
    const tableOverhead = (9 * 3) + 1;
    const availableWidth = Math.max(terminalWidth - tableOverhead, 100);
    
    // Define proportional weights for each column (higher = more space)
    const columnWeights = [34, 50, 20, 20, 12, 13, 10, 10, 12]; // Original widths as weights
    const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0);
    
    // Calculate proportional widths based on available space
    const colWidths = columnWeights.map(weight => {
      const proportionalWidth = Math.floor((weight / totalWeight) * availableWidth);
      return Math.max(proportionalWidth, 3); // Minimum 3 chars per column
    });
    
    // Choose headers based on terminal width
    let headers = ["asid", "App", "Version", "Tags", "Size", "Count", "CPU", "Mem", "State"];

    return {
      head: headers,
      colWidths: colWidths
    };
  }

  /**
   * Calculate totals for the deployment records
   * @param {Array} filteredRecords - List of filtered deployment records
   * @param {string} label - Label for the total
   * @returns {Object} - Total record
   * @private
   */
  _countTotal(filteredRecords, label) {
    return filteredRecords.reduce((t, r) => {
          t.nodeCount += r.nodeCount;
          t.cpu += r.cpu;
          t.memory += r.memory;
          return t;
        },
        {
          asid: label,
          code: "",
          version: "",
          tags: "",
          nodeSize: "",
          nodeCount: 0,
          cpu: 0,
          memory: 0,
          state: ""
        }
    );
  }


}

// Set static properties
PsCommand.optionsDefinitions = optionsDefinitions;
PsCommand.help = help;

module.exports = PsCommand; 