const UuCloudDeployListTask = require("uu_appg01_core-npm/src/scripts/uu_cloud/task-deploy-list");

class UuCloud {
  constructor(config) {
    this._config = config;
  }

  async getAppDeploymentList(resourcePoolUri) {
    let config = {
      oidcToken: this._config.oidcToken,
      resourcePoolUri
    };
    let deployListTask = new UuCloudDeployListTask(config);
    let deployList = await deployListTask._getExport();
    return deployList;
  }

}

module.exports = UuCloud;
