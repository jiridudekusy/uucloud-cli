const Command = require('../interfaces/Command');
const { commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent } = require("../misc/common-tasks-option");
const { searchPrompt } = require("../misc/prompt-utils");
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("InteractiveCommand");
const actionHandlerFactory = require("../actions/action-handler-factory");

const optionsDefinitions = [
    ...commonOptionsDefinitionsWithPresentAndApps
];

const help = [
    {
        header: "interactive command",
        content: "Interactive command-line interface for uuCloud operations."
    },
    {
        header: 'Synopsis',
        content: '$ uucloud i [-r {underline uri}]'
    },
    {
        header: 'Options',
        optionList: optionsDefinitions
    }
];

/**
 * Command implementation for the interactive mode
 */
class InteractiveCommand extends Command {
    /**
     * Create a new InteractiveCommand instance
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
     * Execute the interactive command
     * @param {Array} args - Command line arguments
     * @returns {Promise<void>}
     */
    async execute(args) {
        try {
            // Parse and validate arguments
            let options = this._taskUtils.parseCliArguments(args);
            verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
            
            let present = this._taskUtils.loadPresent(options);
            options = this._taskUtils.mergeWithConfig(options, present);
            
            let oidcToken = await this._tokenProvider.getToken(options);
            
            // Create the cloud client using CloudClient interface
            const uuCloud = this._serviceFactory('CloudClient', oidcToken, options);
            
            let deployList = await uuCloud.getAppDeploymentList(options.resourcePool);
            this._universeClient = await uuCloud.getUniverseClient();
            
            let deployListOptions;
            if (this._universeClient) {
                let uuAppResourcePoolOids = deployList.map(item => item.data.uuAppResourcePoolOid);
                uuAppResourcePoolOids = [...new Set(uuAppResourcePoolOids)];
                let uuAppResourcePools = {};
                for (const uuAppResourcePoolOid of uuAppResourcePoolOids) {
                    uuAppResourcePools[uuAppResourcePoolOid] = await this._universeClient.getUuAppResourcePool(uuAppResourcePoolOid);
                }
                deployListOptions = deployList.map(item => ({
                    name: `${uuAppResourcePools[item.data.uuAppResourcePoolOid].uuAppResourcePool.name} - ${item.code} - v${item.version}${item.tags ? ' - [' + item.tags + ']' : ''} - ${item.asid}`,
                    value: item.asid
                }));
            } else {
                deployListOptions = deployList.map(item => {
                    return {
                        name: `${item.code} - v${item.version}${item.tags ? ' - [' + item.tags + ']' : ''} - ${item.asid}`,
                        value: item.asid
                    }
                });
            }
            
            let selectedSubapp = await searchPrompt("Select uuSubApp deployment:", deployListOptions);
            logger.info(`Selected subapp: ${selectedSubapp}`);
            let subAppDeployment = deployList.find(item => item.asid === selectedSubapp);
            
            // Initialize the handler with appropriate options
            const handlerOpts = {
                cloudClient: uuCloud  // Pass the cloud client to the handler
            };
            
            // Get the proper action handler for this subapp code
            const handler = actionHandlerFactory.getHandler(subAppDeployment.code, handlerOpts);
            
            // Get the action menu organized by groups from the handler
            const actionGroups = await handler.getGroupedActionMenu(subAppDeployment.code, options, selectedSubapp, subAppDeployment, deployList);
            
            // Show the action menu and process the selected action
            const selectedAction = await searchPrompt("Select action:", actionGroups);
            await handler.processAction(selectedAction, options, selectedSubapp, subAppDeployment, deployList);
        } catch (error) {
            this._console.error(`Error: ${error.message}`);
            throw error;
        }
    }
}

// Set static properties
InteractiveCommand.optionsDefinitions = optionsDefinitions;
InteractiveCommand.help = help;

module.exports = InteractiveCommand; 