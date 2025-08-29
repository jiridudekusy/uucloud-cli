const Command = require('../interfaces/Command');
const { commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent } = require("../misc/common-tasks-option");
const { searchPrompt } = require("../misc/prompt-utils");
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("InteractiveCommand");
const actionHandlerFactory = require("../actions/action-handler-factory");
const Config = require('../misc/config');

const optionsDefinitions = [
    ...commonOptionsDefinitionsWithPresentAndApps,
    {
        name: "select-preset",
        alias: "s",
        type: Boolean,
        description: "Interactively select from available presets before proceeding."
    }
];

const help = [
    {
        header: "interactive command",
        content: "Interactive command-line interface for uuCloud operations."
    },
    {
        header: 'Synopsis',
        content: '$ uucloud i -s'
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
            
            // Handle preset selection if requested
            if (options.selectPreset) {
                await this._handlePresetSelection(options);
            }
            
            let present = this._taskUtils.loadPresent(options);
            options = this._taskUtils.mergeWithConfig(options, present);
            
            let oidcToken = await this._tokenProvider.getToken(options);
            
            // Create the cloud client using CloudClient interface
            const uuCloud = this._serviceFactory('CloudClient', oidcToken, options);
            
            let deployList = await uuCloud.getAppDeploymentList(options.resourcePool);
            this._universeClient = await uuCloud.getUniverseClient();
            
            let deployListOptions;
            if (this._universeClient) {
                let uuAppResourcePoolOids = deployList.map(item => item.data?.uuAppResourcePoolOid).filter(Boolean);
                uuAppResourcePoolOids = [...new Set(uuAppResourcePoolOids)];
                let uuAppResourcePools = {};
                for (const uuAppResourcePoolOid of uuAppResourcePoolOids) {
                    uuAppResourcePools[uuAppResourcePoolOid] = await this._universeClient.getUuAppResourcePool(uuAppResourcePoolOid);
                }
                deployListOptions = deployList.map(item => {
                    if (item.sourceType === 'business-territory') {
                        const unitName = item.awscs?.[0]?.unitName || 'Unknown Unit';
                        return {
                            name: `${unitName} - ${item.code} - v${item.version || 'N/A'}${item.tags ? ' - [' + item.tags + ']' : ''} - ${item.asid}`,
                            value: item.asid
                        };
                    } else {
                        const poolName = item.data?.uuAppResourcePoolOid && uuAppResourcePools[item.data.uuAppResourcePoolOid] ?
                            uuAppResourcePools[item.data.uuAppResourcePoolOid].uuAppResourcePool.name :
                            'Unknown Pool';
                        return {
                            name: `${poolName} - ${item.code} - v${item.version}${item.tags ? ' - [' + item.tags + ']' : ''} - ${item.asid}`,
                            value: item.asid
                        };
                    }
                });
            } else {
                deployListOptions = deployList.map(item => {
                    const prefix = item.sourceType === 'business-territory' ? 
                        (item.awscs?.[0]?.unitName || 'Unknown Unit') : 
                        'Resource Pool';
                    return {
                        name: `${prefix} - ${item.code} - v${item.version || 'N/A'}${item.tags ? ' - [' + item.tags + ']' : ''} - ${item.asid}`,
                        value: item.asid
                    };
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

    /**
     * Handle preset selection when --select-preset flag is used
     * @param {Object} options - Command options (modified in place)
     * @returns {Promise<void>}
     * @private
     */
    async _handlePresetSelection(options) {
        const presets = Config.get('presents') || {};
        const presetNames = Object.keys(presets);
        
        if (presetNames.length === 0) {
            this._console.error('No presets available. You can create presets in your ~/.uucloud-cli/config.json file.');
            return;
        }
        
        // Create preset options for the prompt
        const presetOptions = [
            {
                name: '[No preset - continue with current options]',
                value: null
            },
            ...presetNames.map(name => ({
                name: name,
                value: name
            }))
        ];
        
        const selectedPreset = await searchPrompt("Select a preset:", presetOptions);
        
        if (selectedPreset) {
            this._console.error(`Using preset: ${selectedPreset}`);
            options.present = selectedPreset;
        } else {
            this._console.error('Continuing without preset...');
        }
    }



}

// Set static properties
InteractiveCommand.optionsDefinitions = optionsDefinitions;
InteractiveCommand.help = help;

module.exports = InteractiveCommand; 
