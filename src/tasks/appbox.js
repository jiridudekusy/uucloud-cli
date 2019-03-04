const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const {commonOptionsDefinitionsAuthentication, verifyCommonOptionsDefinitionsAuthentication} = require("../misc/common-tasks-option");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");
const fs = require("fs");
const path = require("path");

const optionsDefinitions = [
  {
    name: "appbox",
    alias: "b",
    type: String,
    description: "Appbox UES uri in any form."
  },
  {
    name: "name",
    alias: "n",
    type: String,
    description: "Appbox name."
  },
  {
    name: "version",
    alias: "v",
    type: String,
    description: "Application version."
  },
  {
    name: "location",
    alias: "l",
    type: String,
    description: "Appbox location UES uri in any form."
  },
  {
    name: "file",
    alias: "f",
    type: String,
    description: "Application file (war in case of Java, zip in case of NodeJS) location. Absolute or relative path."
  },
  {
    name: "readme",
    alias: "r",
    type: String,
    description: "Readme file location. Absolute or relative path."
  },
  {
    name: "descriptor",
    alias: "d",
    type: String,
    description: "uuCloud descriptor file(uucloud_descriptor.json) file location. Absolute or relative path."
  },
  ...commonOptionsDefinitionsAuthentication
]
const help = [
  {
    header: "appbox command",
    content: "Creates or updates appbox."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud appbox -b {underline appbox uesuri} -n {underline appbox name} -v {underline version} -l {underline location uesuri} -f {underline application file} -r {underline README file} -d {underline uucloud descriptor}'
  },
  {
    header: 'Options',
    optionList: optionsDefinitions
  },
  {
    header: 'UES uri form',
    content: `Following form of ues uri is supported:
              - <territory code>:<artifact code>  (for example: DEV0174-BT:USYE.LIBRA)
              - ues:<territory code>:<artifact code> (for example: ues:DEV0174-BT:USYE.LIBRA)
              - ues:<territory code>[territory id]:<artifact code>[artifact id]  (for example: ues:DEV0174-BT[84723967990163610]:USY.LIBRA[5b56feca6386d0850abacb06] )`
  }
];

class AppboxTask {

  constructor(opts) {
    this._taskUtils = new TaskUtils(optionsDefinitions, help);
    this._opts = opts;
  }

  async execute(cliArgs) {
    let options = this._taskUtils.parseCliArguments(cliArgs);
    verifyCommonOptionsDefinitionsAuthentication(options, this._taskUtils);
    this._taskUtils.testOption(options.appbox, "You must specify appbox.");
    this._taskUtils.testOption(options.name, "You must specify appbox name.");
    this._taskUtils.testOption(options.version, "You must specify version.");
    this._taskUtils.testOption(options.location, "You must specify appbox location.");
    this._taskUtils.testOption(options.file, "You must specify application file.");
    this._taskUtils.testOption(options.readme, "You must specify readme file.");
    this._taskUtils.testOption(options.descriptor, "You must specify descriptor file.");

    options.file = path.resolve(this._opts.currentDir, options.file);
    options.readme = path.resolve(this._opts.currentDir, options.readme);
    options.descriptor = path.resolve(this._opts.currentDir, options.descriptor);

    this._taskUtils.testOption(this._fileExist(options.file), "Application file must exist.");
    this._taskUtils.testOption(this._fileExist(options.readme), "Readme file must exist.");
    this._taskUtils.testOption(this._fileExist(options.descriptor), "uuCloud descriptor file must exist.");
    // await this.getResourcePoolInfo(options.resourcePool, options, present);
    let oidcToken = await new OidcTokenProvider().getToken(options);
    let uuCloud = new UuCloud({oidcToken});
    let result = await uuCloud.appbox(options);
  }

  _fileExist(file){
    if(fs.existsSync(file)){
      let stats = fs.statSync(file);
      return stats.isFile();
    }
    return false;
  }
}

module.exports = AppboxTask;