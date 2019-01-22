const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const {commonOptionsDefinitionsWithResourcePool, verifyCommonOptionsDefinitionsWithResourcePool} = require("../misc/common-tasks-option");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");

const optionsDefinitions = commonOptionsDefinitionsWithResourcePool;

const help = [
  {
    header: "ps command",
    content: "Displays list of deployed uuApps."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud ps -r {underline uri}'
  },
  {
    header: 'Options',
    optionList: optionsDefinitions
  }
];

class PsTask {

  constructor() {
    this._taskUtils = new TaskUtils(optionsDefinitions, help);
  }

  async execute(cliArgs) {
    let options = this._taskUtils.parseCliArguments(cliArgs);
    verifyCommonOptionsDefinitionsWithResourcePool(options, this._taskUtils);
    options = this._taskUtils.mergeWithConfig(options);
    this._taskUtils.testOption(options.resourcePool, "Resource pool must be either specified as option or using uucloud use");
    await this.getResourcePoolInfo(options.resourcePool, options);
  }

  async getResourcePoolInfo(resourcePoolUri, options) {
    let oidcToken = await new OidcTokenProvider().getToken(options);

    let uuCloud = new UuCloud({oidcToken});
    let deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);

    let table = new Table({
      head: ["asid", "uuSubApp", "Tags", "Node size", "Node Count"],
      colWidths: [36, 50, 20, 12, 13]
    });

    deployList.pageEntries.forEach(entry => {
      let record = {};
      record.code = entry.code;
      record.asid = entry.asid;
      //FIXME: asi jich muze byt vice, nebo zadna
      record.nodeSize = entry.config.deployUnits[0].nodeSize;
      record.nodeCount = 0;
      if (entry.nodeSets && entry.nodeSets[0]) {
        record.nodeCount = entry.nodeSets[0].nodeCount;
      }
      record.tags = "";
      if (entry.config.deploymentTimeConfig && entry.config.deploymentTimeConfig.tags) {
        record.tags = entry.config.deploymentTimeConfig.tags;
      }
      table.push([record.asid, record.code, record.tags, record.nodeSize, record.nodeCount]);
    });

    console.log(table.toString());
  }
}

module.exports = PsTask;