const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const TaskUtils = require("../misc/task-utils");
const Config = require("../misc/config");
const {commonOptionsDefinitionsWithResourcePool, verifyCommonOptionsDefinitionsWithResourcePool} = require("../misc/common-tasks-option");

const optionsDefinitions = commonOptionsDefinitionsWithResourcePool;

const help = [
  {
    header: "use command",
    content: "Sets up default parameter values. This paramter values be used as default by all other commands, if it is not overridden."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud use [-r {underline resource pool uri}] [-a {underline browser|vault|interactive}] [-u {underline user uid}]'
  },
  {
    header: 'Options',
    optionList: optionsDefinitions
  }
];

class UseTask {

  constructor() {
    this._taskUtils = new TaskUtils(optionsDefinitions, help);
  }

  async execute(cliArgs) {
    let options = this._taskUtils.parseCliArguments(cliArgs);
    verifyCommonOptionsDefinitionsWithResourcePool(options, this._taskUtils);
    Object.keys(options).forEach(key => Config.set(key, options[key]));
    console.log("Current configuration:");
    console.log(JSON.stringify(Config.all, null, 2));
  }
}

module.exports = UseTask;