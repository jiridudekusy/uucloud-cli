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
    this._standardActions = [
      {
        name: "Follow logs",
        value: "followLogs",
        isAvailable: async (subAppDeployment, context = {}) => true,
        execute: this.followLogs.bind(this)
      },
      {
        name: "Show configuration",
        value: "showConfig",
        isAvailable: async (subAppDeployment, context = {}) => true,
        execute: this.showConfig.bind(this)
      },
      {
        name: "Show audit",
        value: "showAudit",
        isAvailable: async (subAppDeployment, context = {}) => true,
        execute: this.showAudit.bind(this)
      },
      {
        name: "Show appstatus",
        value: "showAppstatus",
        isAvailable: async (subAppDeployment, context = {}) => true,
        execute: this.showAppStatus.bind(this)
      },
      {
        name: "Open API Console",
        value: "openApiConsole",
        isAvailable: async (subAppDeployment, context = {}) => true,
        execute: this.openApiConsole.bind(this)
      },
      {
        name: "Open GUI",
        value: "openGui",
        isAvailable: async (subAppDeployment, context = {}) => true,
        execute: this.openGui.bind(this)
      }
    ];
    this._appSpecificActions = [];
  }

  // Return the standard action menu items
  getStandardActions() {
    return this._standardActions;
  }
  
  // Return the app-specific action menu items
  getAppSpecificActions() {
    return this._appSpecificActions;
  }

  // Add an app-specific action to the menu
  addAppSpecificAction(action) {
    this._appSpecificActions.push(action);
  }

  // Return all action menu items for this action handler
  getActionMenu() {
    return [...this._standardActions, ...this._appSpecificActions];
  }

  // Return grouped actions (standard and app-specific)
  async getGroupedActionMenu(appCode, options, selectedSubapp, subAppDeployment, deployList) {
    const actionGroups = [];
    
    // Create context object with additional parameters
    const context = {
      options,
      selectedSubapp,
      deployList
    };
    
    // Add standard actions group if there are any
    if (this._standardActions.length > 0) {
      actionGroups.push({
        name: "Standard Actions",
        value: null,
        disabled: true
      });

      // Filter actions based on availability
      const availableStandardActions = [];
      for (const action of this._standardActions) {
        if (await action.isAvailable(subAppDeployment, context)) {
          availableStandardActions.push(action);
        }
      }
      
      actionGroups.push(...availableStandardActions);
    }
    
    // Add app-specific actions group if there are any
    if (this._appSpecificActions.length > 0) {
      // Use provided app code or fallback to constructor name
      const displayAppCode = appCode || this.constructor.name.replace('Handler', '');
      actionGroups.push({
        name: `${displayAppCode} Specific Actions`,
        value: null,
        disabled: true
      });
      
      // Filter actions based on availability
      const availableAppSpecificActions = [];
      for (const action of this._appSpecificActions) {
        if (await action.isAvailable(subAppDeployment, context)) {
          availableAppSpecificActions.push(action);
        }
      }
      
      actionGroups.push(...availableAppSpecificActions);
    }
    
    return actionGroups;
  }

  // Process the selected action
  async processAction(action, options, selectedSubapp, subAppDeployment, deployList) {
    // Find the action object from standard or app-specific actions
    const actionObj = [...this._standardActions, ...this._appSpecificActions].find(a => a.value === action);
    
    if (actionObj) {
      // Create a context object with additional parameters
      const context = {
        options,
        selectedSubapp,
        deployList
      };
      
      // Execute the action's execute method with the new parameter format
      await actionObj.execute(subAppDeployment, context);
    } else {
      throw new Error(`Action "${action}" not found in available actions`);
    }
  }

  async getAwid(subAppDeployment) {
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

  async showAudit(subAppDeployment, context = {}) {
    let awid = await this.getAwid(subAppDeployment);
    let oidcToken = await this.getAppDeploymentOidcToken(subAppDeployment);
    let appServerauditClient = new AppServerAuditClient({ baseUri: awid.awidUri, oidcToken });
    let logs = await appServerauditClient.getAuditLogs({});
    console.log(JSON.stringify(logs, null, 2));
  }

  async showConfig(subAppDeployment, context = {}) {
    console.log(JSON.stringify(subAppDeployment.data, null, 2));
  }

  async showAppStatus(subAppDeployment, context = {}) {
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

  async followLogs(subAppDeployment, context = {}) {
    const { options, selectedSubapp, deployList } = context;
    
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

  async openGui(subAppDeployment, context = {}) {
    let awid = await this.getAwid(subAppDeployment);
    let url = awid.awidUri;
    await this.openInBrowser(url, 'GUI');
  }

  async openApiConsole(subAppDeployment, context = {}) {
    let awid = await this.getAwid(subAppDeployment);
    let apiConsoleUrl = `${awid.awidUri}/sys/uuAppWorkspace/apiConsole`;
    await this.openInBrowser(apiConsoleUrl, 'API Console');
  }

  async openInBrowser(url, description = 'URL') {
    logger.info(`Opening ${description} at: ${url}`);
    const openModule = await import('open');
    await openModule.default(url);
    console.log(`${description} opened at: ${url}`);
  }
}

module.exports = BaseActionHandler;