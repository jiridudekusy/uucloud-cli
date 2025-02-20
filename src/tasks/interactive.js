const prompts = require('@inquirer/prompts');
const TaskUtils = require("../misc/task-utils");
const {commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent} = require("../misc/common-tasks-option");
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloudClient = require("../uucloud/uucloud-client");
const LogsTask = require("./logs");
const {LoggerFactory} = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("InteractiveTask");


const optionsDefinitions = [
    ...commonOptionsDefinitionsWithPresentAndApps
];

const subbAppMenu = [
    {
        name: "Follow logs",
        value: "followLogs"
    },
    {
        name: "Show configuration",
        value: "showConfig"
    },
    {
        name: "Show appstatus",
        value: "showAppstatus"
    },
]

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
        }
        let selectedSubapp = await this.#search("Select uuSubApp deployment:", deployListOptions);
        logger.info(`Selected subapp: ${selectedSubapp}`);
        let subAppDeployment = deployList.find(item => item.asid === selectedSubapp);

        await this.#search("Select action:", subbAppMenu).then(async (answer) => {
            if(answer === "followLogs"){
                await this.#followLogs(options, selectedSubapp, subAppDeployment, deployList);
            } else if(answer === "showConfig"){
                await this.#showConfig(options, selectedSubapp, subAppDeployment, deployList);
            } else if(answer === "showAppstatus"){
                await this.#showAppStatus(options, selectedSubapp, subAppDeployment, deployList);
            }
        })

        // await this.#followLogs(options, selectedSubapp, subAppDeployment, deployList);
    }


    async #showConfig(options, selectedSubapp, subAppDeployment, deployList) {
        console.log(JSON.stringify(subAppDeployment.data, null, 2));
    }

    async #showAppStatus(options, selectedSubapp, subAppDeployment, deployList) {
        let oidcUri = this.getAppConfig(subAppDeployment, "uu_app_oidc_providers_oidcg02_uri", "uu.app.oidc.providers.oidcg02.uri");
        logger.info(`OIDC URI of uuSubApp : ${oidcUri}`);

    }

    getAppConfig(subAppDeployment, ...keys) {
        let config = subAppDeployment.data.uuAppServerEnvironment;
        let value;
        for (const key of keys) {
            if(value === undefined || value === null){
                value = config[key];
            }

        }
        return value;
    }

    async #followLogs(options, selectedSubapp, subAppDeployment, deployList) {
        let logsOptions = {
            ...options,
            apps: [selectedSubapp],
            codec: "formatted",
            "resourcePool": subAppDeployment.data.uuAppResourcePoolOid,
            "follow": true
        };
        if (!options["log-store-uri"]) {
            let logstoreUri = await this.#discoverLogStore(subAppDeployment, deployList);
            logger.info(`Discovered logstore: ${logstoreUri}`);
            logsOptions["log-store-uri"] = logstoreUri;
        }
        let logsTask = new LogsTask(this._opts);
        await logsTask.execute(logsOptions, true);
    }

    async #discoverLogStore(uuSubAppDeployment, deployList){
        let logStore = deployList.find(item => item.code === "uu-cloudlogstore-maing02" && item.data.uuAppResourcePoolOid === uuSubAppDeployment.data.uuAppResourcePoolOid);
        let awidCards = await this._universeClient.getAwidCards(logStore);
        if(awidCards.length !== 1){
            throw new Error(`Logstore discovery failed. There is not single awidCard(${awidCards.length} found)  for logstore ${logStore.asid}. Please specify logstore uri manually.`);
        }
        return awidCards[0].awidUri;
    }

    async #search(question, options) {
        const rows = process.stdout.rows;
        const answer = await prompts.search({
            message: question,
            pageSize: rows - 2,
            source: async (input, {signal}) => {
                return options.filter(option => {
                    let terms = (input || "").split(" ");
                    return terms.every(term => option.name.includes(term))
                });
            },
        });

        return answer
    };
}

module.exports = InteractiveTask;