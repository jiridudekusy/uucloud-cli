const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const {commonOptionsDefinitionsAuthentication, verifyCommonOptionsDefinitionsAuthentication} = require("../misc/common-tasks-option");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");
const path = require("path");
const fs = require("fs");

const optionsDefinitions = [
  {
    name: "appDef",
    type: String,
    description: "uuapp.json file location. Absolute or relative path."
  },
  {
    name: "cloudDef",
    type: String,
    description: "uucloud-*.json file location. Absolute or relative path."
  },
  ...commonOptionsDefinitionsAuthentication];

const help = [
  {
    header: "deploy command",
    content: "Deploy uuSubApp to uuCloud using devkit descriptor."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud deploy --appDef {underline uuapp.json} --cloudDef {underline uucloud-*.json}'
  },
  {
    header: 'Options',
    optionList: optionsDefinitions
  }
];

class DeployTask {

  constructor(opts) {
    this._taskUtils = new TaskUtils(optionsDefinitions, help);
    this._opts = opts;
  }

  async execute(cliArgs) {
    let options = this._taskUtils.parseCliArguments(cliArgs);
    verifyCommonOptionsDefinitionsAuthentication(options, this._taskUtils);
    this._taskUtils.testOption(options.appDef, "You must specify appDef.");
    this._taskUtils.testOption(options.cloudDef, "You must specify cloudDef.");

    options.appDef = path.resolve(this._opts.currentDir, options.appDef);
    options.cloudDef = path.resolve(this._opts.currentDir, options.cloudDef);

    this._taskUtils.testOption(this._fileExist(options.appDef), "uuapp definition file must exist.");
    this._taskUtils.testOption(this._fileExist(options.cloudDef), "uucloud definition file must exist.");

    await this.deploy(options);
  }

  async deploy(options) {

      let oidcToken = await new OidcTokenProvider().getToken(options);
      let uuCloud = new UuCloud({oidcToken});
      await uuCloud.deploy(options.appDef, options.cloudDef);
  }

  _fileExist(file){
    if(fs.existsSync(file)){
      let stats = fs.statSync(file);
      return stats.isFile();
    }
    return false;
  }
}

module.exports = DeployTask;