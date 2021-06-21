const UuCloudDeployListTask = require("uu_appg01_core-npm/src/scripts/uu_cloud/task-deploy-list");
const CmdHelper = require("uu_appg01_core-npm/src/scripts/uu_cloud/misc/cmd-helper.js");
const AppClient = require("uu_appg01_core-npm/src/scripts/uu_cloud/misc/app-client.js");
const {LoggerFactory} = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("UuCloud");

const DEPLOY_LIST_URI = "uu-c3/AppDeployment/getAppDeploymentList/exec";

const HEADERS = {
  "Accept": "application/json",
  "Content-type": "application/json"
};

class UuCloud {
  constructor(config) {
    this._config = config;
    this._appClient = new AppClient(config.oidcToken);
    if (!this._config.c3Uri) {
      this._config.c3Uri = this._appClient.c3BaseUri;
    }
    if (!this._config.c3Uri.endsWith("/")) {
      this._config.c3Uri += "/";
    }
  }

  _buildGetAppDeploymentListCmdUri(appDeploymentUri) {
    return `${this._config.c3Uri}${DEPLOY_LIST_URI}`
  }

  async getAppDeploymentList(resourcePoolUri) {

    let result = await this._executeCommand(CmdHelper.buildCmd2Url(this._buildGetAppDeploymentListCmdUri(), resourcePoolUri), "get", null, HEADERS);

    let deployList = JSON.parse(result.body)

    return deployList;
  }

  async _executeCommand(url, method, params, headers, tryNumber = 0) {
    try {
      return await this._appClient.exchange(url, method, params, headers);
    } catch (err) {
      if (tryNumber > 10) {
        logger.error(`All retries has failed.`, err);
        throw err;
      }
      logger.warn(`Request failed retrying #${tryNumber + 1}....`)
      return await this._executeCommand(url, method, params, headers, ++tryNumber);
    }
  }

}

module.exports = UuCloud;
