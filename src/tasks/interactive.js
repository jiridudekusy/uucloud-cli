const prompts = require('@inquirer/prompts');
const TaskUtils = require("../misc/task-utils");
const { commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent } = require("../misc/common-tasks-option");
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloudClient = require("../uucloud/uucloud-client");
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("InteractiveTask");
const actionHandlerFactory = require("../actions/action-handler-factory");
const { searchPrompt } = require("../misc/prompt-utils");

const optionsDefinitions = [
    ...commonOptionsDefinitionsWithPresentAndApps
];

const help = [];

class InteractiveTask {

    constructor(opts) {
        this._taskUtils = new TaskUtils(optionsDefinitions, help);
        this._opts = opts;
    }

    async execute(cliArgs) {
        let options = this._taskUtils.parseCliArguments(cliArgs);
        verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
        let present = this._taskUtils.loadPresent(options);
        options = this._taskUtils.mergeWithConfig(options, present);

        let oidcToken = await new OidcTokenProvider().getToken(options);
        let uuCloud = new UuCloudClient(oidcToken, options);
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
                name: `${uuAppResourcePools[item.data.uuAppResourcePoolOid].uuAppResourcePool.name} - ${item.code} - ${item.asid}`,
                value: item.asid
            }));
        } else {
            deployListOptions = deployList.map(item => {
                return {
                    name: `${item.code} - ${item.asid}`,
                    value: item.asid
                }
            });
        }
        
        let selectedSubapp = await searchPrompt("Select uuSubApp deployment:", deployListOptions);
        logger.info(`Selected subapp: ${selectedSubapp}`);
        let subAppDeployment = deployList.find(item => item.asid === selectedSubapp);
        
        // Initialize the handler with appropriate options
        const handlerOpts = {
            ...this._opts,
            universeClient: this._universeClient
        };
        
        // Get the proper action handler for this subapp code
        const handler = actionHandlerFactory.getHandler(subAppDeployment.code, handlerOpts);
        
        // Get the action menu organized by groups from the handler
        const actionGroups = await handler.getGroupedActionMenu(subAppDeployment.code, options, selectedSubapp, subAppDeployment, deployList);
        
        // Show the action menu and process the selected action
        const selectedAction = await searchPrompt("Select action:", actionGroups);
        await handler.processAction(selectedAction, options, selectedSubapp, subAppDeployment, deployList);
    }
}

module.exports = InteractiveTask;