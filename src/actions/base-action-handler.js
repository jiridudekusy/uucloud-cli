const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("BaseActionHandler");
const OidcTokenProvider = require("../oidc-token-provider");
const { Uri } = require("uu_appg01_core-uri");
const LogsTask = require("../tasks/logs");
const ConsoleClient = require("../platform/console-client");
const AppServerAuditClient = require("../platform/appserver-audit-client");
const { searchPrompt } = require("../misc/prompt-utils");

class BaseActionHandler {
  constructor(opts) {
    this._opts = opts;
    this._universeClient = opts.universeClient;
    this._actionMenu = [
      {
        name: "Follow logs",
        value: "followLogs"
      },
      {
        name: "Show configuration",
        value: "showConfig"
      },
      {
        name: "Show audit",
        value: "showAudit"
      },
      {
        name: "Show appstatus",
        value: "showAppstatus"
      },
      {
        name: "Open API Console",
        value: "openApiConsole"
      },
      {
        name: "Open GUI",
        value: "openGui"
      }
    ];
  }

  // Return the action menu items for this action handler
  getActionMenu() {
    return this._actionMenu;
  }

  // Process the selected action
  async processAction(action, options, selectedSubapp, subAppDeployment, deployList) {
    if (action === "followLogs") {
      await this.followLogs(options, selectedSubapp, subAppDeployment, deployList);
    } else if (action === "showConfig") {
      await this.showConfig(options, selectedSubapp, subAppDeployment, deployList);
    } else if (action === "showAppstatus") {
      await this.showAppStatus(options, selectedSubapp, subAppDeployment, deployList);
    } else if (action === "showAudit") {
      await this.showAudit(options, selectedSubapp, subAppDeployment, deployList);
    } else if (action === "openApiConsole") {
      await this.openApiConsole(options, selectedSubapp, subAppDeployment, deployList);
    } else if (action === "openGui") {
      await this.openGui(options, selectedSubapp, subAppDeployment, deployList);
    } else {
      throw new Error(`Action ${action} not supported`);
    }
  }

  async getAwid(options, selectedSubapp, subAppDeployment, deployList) {
    let awidCards = await this._universeClient.getAwidCards(subAppDeployment);
    let awidOptions = awidCards.map(item => ({
      name: item.targetAwid,
      value: item
    }));
    if (awidOptions.length === 1) {
      return awidOptions[0].value;
    } else {
      // Use the imported searchPrompt function
      return await searchPrompt("Select awid:", awidOptions);
    }
  }

  async showAudit(options, selectedSubapp, subAppDeployment, deployList) {
    let awid = await this.getAwid(options, selectedSubapp, subAppDeployment, deployList);
    let oidcToken = await this.getAppDeploymentOidcToken(subAppDeployment);
    let appServerauditClient = new AppServerAuditClient({ baseUri: awid.awidUri, oidcToken });
    let logs = await appServerauditClient.getAuditLogs({});
    console.log(JSON.stringify(logs, null, 2));
  }

  async showConfig(options, selectedSubapp, subAppDeployment, deployList) {
    console.log(JSON.stringify(subAppDeployment.data, null, 2));
  }

  async showAppStatus(options, selectedSubapp, subAppDeployment, deployList) {
    let consoleUri = this.getAppConfig(subAppDeployment, "uu_app_status_progress_base_uri", "uuAppStatus.progressBaseUri");
    if (!consoleUri) {
      throw new Error("Console uri not found in subApp deployment data.");
    }
    let oidcToken = await this.getAppDeploymentOidcToken(subAppDeployment);

    let consoleClient = new ConsoleClient({ consoleUri: consoleUri, oidcToken });
    let status = await consoleClient.getAppStatus(subAppDeployment);
    console.log(JSON.stringify(status, null, 2));
  }

  async getAppDeploymentOidcToken(subAppDeployment) {
    let oidcUri = this.getAppConfig(subAppDeployment, "uu_app_oidc_providers_oidcg02_uri", "uu.app.oidc.providers.oidcg02.uri");
    logger.info(`OIDC URI of uuSubApp : ${oidcUri}`);
    let oidcToken = await new OidcTokenProvider().getToken({
      authentication: "oidc",
      "oidc-uri": oidcUri,
      "token-alias": Uri.parse(oidcUri).awid
    });
    return oidcToken;
  }

  getAppConfig(subAppDeployment, ...keys) {
    let config = subAppDeployment.uuAppServerEnvironment;
    let value;
    for (const key of keys) {
      if (value === undefined || value === null) {
        value = config[key];
      }
    }
    return value;
  }

  async followLogs(options, selectedSubapp, subAppDeployment, deployList) {
    let logsOptions = {
      ...options,
      apps: [selectedSubapp],
      codec: "formatted",
      "follow": true
    };
    let resourcePool = subAppDeployment.data.uuAppResourcePoolOid;
    if (resourcePool) {
      logsOptions.resourcePool = resourcePool;
    }
    if (!options["log-store-uri"]) {
      let logstoreUri = await this.discoverLogStore(subAppDeployment, deployList);
      logger.info(`Discovered logstore: ${logstoreUri}`);
      logsOptions["log-store-uri"] = logstoreUri;
    }
    let logsTask = new LogsTask(this._opts);
    await logsTask.execute(logsOptions, true);
  }

  async discoverLogStore(uuSubAppDeployment, deployList) {
    let logStore = deployList.find(
      item => item.code === "uu-cloudlogstore-maing02" && 
      item.data.uuAppResourcePoolOid === uuSubAppDeployment.data.uuAppResourcePoolOid
    );
    let awidCards = await this._universeClient.getAwidCards(logStore);
    if (awidCards.length !== 1) {
      throw new Error(`Logstore discovery failed. There is not single awidCard(${awidCards.length} found) for logstore ${logStore.asid}. Please specify logstore uri manually.`);
    }
    return awidCards[0].awidUri;
  }

  async openGui(options, selectedSubapp, subAppDeployment, deployList) {
    let awid = await this.getAwid(options, selectedSubapp, subAppDeployment, deployList);
    
    // Simply open the awid URI without asking for a path
    let url = awid.awidUri;
    
    logger.info(`Opening GUI: ${url}`);
    
    // Use dynamic import for the open module
    const openModule = await import('open');
    await openModule.default(url);
    
    console.log(`GUI opened at: ${url}`);
  }

  async openApiConsole(options, selectedSubapp, subAppDeployment, deployList) {
    let awid = await this.getAwid(options, selectedSubapp, subAppDeployment, deployList);
    let apiConsoleUrl = `${awid.awidUri}/sys/uuAppWorkspace/apiConsole`;
    logger.info(`Opening API Console: ${apiConsoleUrl}`);
    // Use dynamic import
    const openModule = await import('open');
    await openModule.default(apiConsoleUrl);
    console.log(`API Console opened at: ${apiConsoleUrl}`);
  }
}

module.exports = BaseActionHandler;