const UuCloudDeployListTask = require("uu_appg01_core-npm/src/scripts/uu_cloud/task-deploy-list");
const UuAppBoxTask = require("uu_appg01_core-npm/src/scripts/uu_cloud/task-app-box");
const UESUri = require("../misc/ues-uri");
const path = require("path");
const fs = require("fs");


const APP_BOX_MAR_CODE = "UU.OS/RUNTIME/APP_BOX";
const homedir = require("os").homedir();

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

  async appbox(opts) {
    let workDir = path.join(homedir, ".uucloud-cli", "work");
    if (!fs.existsSync(workDir)) {
      mkdirp.sync(workDir);
    }
    opts.appbox = this.fixUesUri(opts.appbox);
    opts.location = this.fixUesUri(opts.location);
    let appBoxUri = UESUri.parse(opts.appbox);
    let uuCloudDescriptor = JSON.parse(fs.readFileSync(opts.descriptor)).data;
    let appPackageCode = uuCloudDescriptor.packs[0].code;
    let uuAppBoxTask = new UuAppBoxTask({
      appBoxUriBuilded: opts.appbox,
      oidcToken: this._config.oidcToken,
      appBoxName:opts.name,
      version: opts.version,
      appBoxLocationUri: opts.location,
      appBoxCode: appBoxUri.artifact.code,
      appBoxMarUri: `ues:${appBoxUri.territory.code}:${APP_BOX_MAR_CODE}`,
      //TODO load from uucloud_descriptor
      appBoxAttachmentCodePrefix:uuCloudDescriptor.code,
      uuCloudDescriptorCode: uuCloudDescriptor.code + "/UUAPP-DEPLOY",
      uuCloudDescriptorPath: opts.descriptor,
      uuCloudDescriptorTargetPath: path.join(workDir, `uucloud_descriptor-${Date.now()}.json`),
      useUniqueVersion: false,
      readmeCode: uuCloudDescriptor.code + "/README",
      readmePath: opts.readme,
      appPackageCode,
      appPackagePath: opts.file
    });
    await uuAppBoxTask.process();
  }

  fixUesUri(uri){
    if(uri.startsWith("ues:")){
      return uri;
    }
    return "ues:"+uri;
  }
}

module.exports = UuCloud;