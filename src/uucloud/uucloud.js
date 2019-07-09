const UuCloudDeployListTask = require("uu_appg01_core-npm/src/scripts/uu_cloud/task-deploy-list");
const fs = require("fs-extra");
const Utils = require("../misc/utils");
const path = require("path");

const UuCloudConfig = require("uu_appg01_devkit/src/scripts/uu_cloud/uu-cloud-config.js");
const UuCloudDeploy = require("uu_appg01_devkit/src/scripts/uu_cloud/task-deploy");

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

  async deploy(appdef, cloudedef) {
    let tmpdir = Utils.createTempDir();
    try {
      let uuappPath = path.join(tmpdir, "uuapp.json");
      fs.copySync(appdef, uuappPath);
      let uuappConfig = JSON.parse(fs.readFileSync(uuappPath));
      let projects = Object.keys(uuappConfig).filter(key => key.endsWith("-server"));
      if (projects.length != 1) {
        throw new Error("uuapp.json must have exactly one project.");
      }
      let baseProjectName = projects[0];
      let projectPath = path.join(tmpdir, baseProjectName);
      fs.mkdirpSync(path.join(projectPath, "env"));
      let uuCloudConfigBaseName = path.basename(cloudedef);
      fs.copySync(cloudedef, path.join(projectPath, "env", uuCloudConfigBaseName));
      let env = uuCloudConfigBaseName.match(/^uucloud-(.*)\.json$/)[1];

      let targetDir = path.join(tmpdir, "target");
      let buildConfig = {
        getMode: function () {
          return env;
        },
        getBuildTimestamp: function () {
          return null;
        },
        get: function () {
          return null;
        }
      };
      let uuCloudConfig = new UuCloudConfig(projectPath, baseProjectName, uuappConfig.version, targetDir, buildConfig);
      uuCloudConfig.oidcToken = this._config.oidcToken;
      await new UuCloudDeploy(uuCloudConfig).process();
    } finally {
      fs.removeSync(tmpdir);
    }

  }

}

module.exports = UuCloud;