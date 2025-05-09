const Command = require("../interfaces/Command");
const { commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent } = require("../misc/common-tasks-option");
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("ExecuteCommand");
const { searchPrompt } = require("../misc/prompt-utils");
const { AppClient } = require("uu_appg01_core-appclient");
const { Uri } = require("uu_appg01_core-uri");
const { filterAppDeployments } = require("../uucloud/uucloud-utils");
const OidcTokenProvider = require("../oidc-token-provider");

// Define command-specific options
const optionsDefinitions = [
  ...commonOptionsDefinitionsWithPresentAndApps,
  {
    name: "command-path",
    alias: "c",
    type: String,
    description: "The command path to execute"
  },
  {
    name: "dtoIn",
    alias: "d",
    type: String,
    description: "JSON string containing the dtoIn data",
    defaultValue: "{}"
  },
  {
    name: "awid",        
    type: String,
    description: "Application workspace ID (AWID)"
  },
  {
    name: "interactive",
    alias: "i",
    type: Boolean,
    description: "Use interactive mode to select application and/or AWID if not provided",
    defaultValue: false
  }
];

const help = [
  {
    header: "execute command",
    content: "Execute a command with the given command path and dtoIn."
  },
  {
    header: "Synopsis",
    content: "$ uucloud execute -c {underline command-path} -d {underline dtoIn} [-i] [-a {underline awid}] [{underline app-filter}...]"
  },
  {
    header: "Options",
    optionList: optionsDefinitions
  },
  {
    header: "Examples",
    content: [
      {
        example: "uucloud execute -c \"sys/uuAppWorkspace/create\" -d \"\\{\\\"name\\\":\\\"Test\\\"\\}\" myApp",
        description: "Execute command on app with code/tag containing \"myApp\""
      },
      {
        example: "uucloud execute -c \"sys/uuAppWorkspace/create\" -d \"\\{\\\"name\\\":\\\"Test\\\"\\}\" -a 123456789 ues:ABC:DEF:GHI",
        description: "Execute command on app with deployment URI \"ues:ABC:DEF:GHI\" and AWID \"123456789\""
      },
      {
        example: "uucloud execute -i -c \"sys/uuAppWorkspace/create\" -d \"\\{\\\"name\\\":\\\"Test\\\"\\}\"",
        description: "Execute command and interactively select the application and AWID"
      }
    ]
  }
];

/**
 * Command implementation for executing commands
 */
class ExecuteCommand extends Command {
  /**
   * Create a new ExecuteCommand instance
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
   * Execute the command
   * @param {Array} args - Command line arguments
   * @returns {Promise<void>}
   */
  async execute(args) {
    try {
      // Parse and validate arguments
      let options = this._taskUtils.parseCliArguments(args);
      verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
      
      // Check if required parameters are provided
      if (!options.commandPath) {
        throw new Error("Command path is required. Use -c or --command-path to specify the command path.");
      }
      
      // Check if apps parameter is provided or interactive mode is enabled
      if (!options.interactive && (!options.apps || options.apps.length === 0)) {
        throw new Error("Application identifier is required. Specify an application or use -i to enable interactive mode.");
      }
      
      // Load present configuration and merge with options
      let present = this._taskUtils.loadPresent(options);
      options = this._taskUtils.mergeWithConfig(options, present);
      
      // Create the cloud client for retrieving app deployments
      // Get token for resource pool operations
      const initialToken = await this._tokenProvider.getToken(options);
      const uuCloud = this._serviceFactory("CloudClient", initialToken, options);
      
      // Get app deployment list
      let deployList = await uuCloud.getAppDeploymentList(options.resourcePool);
      this._universeClient = await uuCloud.getUniverseClient();
                
      // First filter applications if filter criteria are provided
      let filteredApps = deployList;
      if (options.apps && options.apps.length > 0) {
        filteredApps = filterAppDeployments(deployList, options.apps);
        
        if (filteredApps.length === 0) {
          throw new Error(`No applications found matching the specified filter: ${options.apps.join(", ")}`);
        }
      }
      
      // Handle application selection
      let selectedSubapp;
      let subAppDeployment;
      
      if (filteredApps.length === 1) {
        // Only one app matches, use it automatically
        selectedSubapp = filteredApps[0].asid;
        subAppDeployment = filteredApps[0];
        logger.info(`Single application match, automatically selecting: ${filteredApps[0].code}`);
      } else if (options.interactive) {
        // Interactive mode with multiple matches - show filtered prompt
        const filteredOptions = filteredApps.map(item => ({
          name: `${item.code} - v${item.version}${item.tags ? " - [" + item.tags + "]" : ""} - ${item.asid}`,
          value: item.asid
        }));
        selectedSubapp = await searchPrompt("Select application:", filteredOptions);
        subAppDeployment = deployList.find(item => item.asid === selectedSubapp);
      } else {
        // Non-interactive mode with multiple matches - error
        this._console.error(`Multiple applications match your filter criteria:`);
        filteredApps.forEach(app => {
          this._console.error(` - ${app.code} (${app.asid})`);
        });
        throw new Error("Multiple applications found. Please refine your filter criteria or use -i for interactive mode.");
      }
      
      logger.info(`Selected subapp: ${selectedSubapp}`);
      
      // Get AWIDs for the selected subapp deployment
      let awids = await uuCloud.getAwids(subAppDeployment);
      let selectedAwid;
      
      if (awids.length === 0) {
        throw new Error("No AWIDs found for the selected uuSubApp.");
      }
      
      // Handle AWID selection
      if (options.awid) {
        // Use the provided AWID if it exists
        const matchingAwid = awids.find(awid => awid.targetAwid === options.awid);
        if (!matchingAwid) {
          throw new Error(`Specified AWID '${options.awid}' does not exist for the selected uuSubApp.`);
        }
        selectedAwid = matchingAwid;
        logger.info(`Using specified AWID: ${selectedAwid.awid}`);
      } else if (awids.length === 1) {
        // If only one AWID exists, use it automatically
        selectedAwid = awids[0];
        logger.info(`Single AWID found, automatically selecting: ${selectedAwid.awid}`);
      } else if (options.interactive) {
        // Interactive selection of AWID if multiple exist and in interactive mode
        const awidOptions = awids.map(item => ({
          name: item.targetAwid,
          value: item
        }));
        selectedAwid = await searchPrompt("Select AWID:", awidOptions);
      } else {
        // Multiple AWIDs exist but not in interactive mode, display error with available AWIDs
        this._console.error(`Multiple AWIDs found for application ${subAppDeployment.code}:`);
        awids.forEach(awid => {
          this._console.error(` - ${awid.targetAwid}`);
        });
        throw new Error("Multiple AWIDs found. Please specify an AWID using -a or --awid, or use -i to enable interactive mode.");
      }
      
      logger.info(`Using AWID: ${selectedAwid.awid}`);
      
      // Parse dtoIn from JSON string
      let dtoIn;
      try {
        dtoIn = JSON.parse(options.dtoIn);
      } catch (error) {
        throw new Error(`Failed to parse dtoIn as JSON: ${error.message}`);
      }
      
      // Execute the command
      logger.info(`Executing command: ${options.commandPath}`);
      logger.info(`Application: ${subAppDeployment.code} (${selectedSubapp})`);
      logger.info(`With AWID: ${selectedAwid.awid}`);
      logger.info(`dtoIn: ${JSON.stringify(dtoIn, null, 2)}`);
      
      // Get application-specific token using the OIDC URI from the app deployment
      const oidcUri = this.getAppConfig(subAppDeployment, "uu_app_oidc_providers_oidcg02_uri", "uu.app.oidc.providers.oidcg02.uri");
      if (!oidcUri) {
        throw new Error("Cannot find OIDC URI in deployment configuration");
      }
      
      logger.info(`OIDC URI of uuSubApp: ${oidcUri}`);
      const oidcToken = await new OidcTokenProvider().getToken({
        authentication: "oidc",
        oidcUri: oidcUri,
        tokenAlias: Uri.parse(oidcUri).awid
      });
      
      // Build the command URI using Uri builder
      const uriBuilder = Uri.createBuilder().parse(selectedAwid.awidUri);
      uriBuilder.setUseCase(options.commandPath);
      const commandUri = uriBuilder.toUri().toString();
      
      // Set headers with the application-specific token
      const headers = { Authorization: `${await oidcToken.get()}` };
      
      // Execute the command using AppClient directly
      let result;
      try {
        result = await AppClient.get(commandUri, dtoIn, { headers });
      } catch (e) {
        if (e.dtoOut) {
          this._console.error(JSON.stringify(e.dtoOut, null, 2));
        }
        throw e;
      }
      
      // Display ONLY the result on stdout
      this._console.log(JSON.stringify(result.data, null, 2));
      
    } catch (error) {
      this._console.error(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a configuration value from an application deployment
   * @param {Object} subAppDeployment - The application deployment object
   * @param {...string} keys - Keys to look up in the configuration
   * @returns {*} - The configuration value
   */
  getAppConfig(subAppDeployment, ...keys) {
    const config = subAppDeployment.uuAppServerEnvironment;
    let value;
    for (const key of keys) {
      if (value === undefined || value === null) {
        value = config[key];
      }
    }
    return value;
  }
}

// Set static properties
ExecuteCommand.optionsDefinitions = optionsDefinitions;
ExecuteCommand.help = help;

module.exports = ExecuteCommand;