const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const {commonOptionsDefinitionsWithPresent, verifyCommonOptionsDefinitionsWithPresent} = require("../misc/common-tasks-option");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");

const optionsDefinitions = [
  ...commonOptionsDefinitionsWithPresent,
  {
    name: "codec",
    type: String,
    description: "Format od result. Supported values : \"raw\"(JSON received from command call) or \"table\"(default)",
    defaultValue: "table"
  }
];

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
    verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
    this._taskUtils.testOption(["raw", "table"].includes(options.codec), "Incorrect codec value.");
    let present = this._taskUtils.loadPresent(options);
    options = this._taskUtils.mergeWithConfig(options, present);
    if (!present || !present.mocks || !present.mocks.getAppDeploymentList) {
      this._taskUtils.testOption(options.resourcePool,
          "Resource pool must be either specified as option, using uucloud use or present with mock response to getAppDeploymentList must be loaded.");
    }

    await this.getResourcePoolInfo(options.resourcePool, options, present);
  }

  async getResourcePoolInfo(resourcePoolUri, options, present) {
    let deployList;
    if (present && present.mocks && present.mocks.getAppDeploymentList) {
      deployList = present.mocks.getAppDeploymentList;
    } else {
      let oidcToken = await new OidcTokenProvider().getToken(options);
      let uuCloud = new UuCloud({oidcToken});
      deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);
    }
    if (options.codec === "table") {
      this._printTable(deployList);
    } else if (options.codec === "raw") {
      this._printRaw(deployList);
    }
  }

  _printRaw(deployList) {
    console.log(JSON.stringify(deployList, null, 2));
  }

  _printTable(deployList) {
    let table = new Table({
      head: ["asid", "uuSubApp", "Tags", "Node size", "Node Count"],
      colWidths: [36, 50, 20, 12, 13]
    });

    deployList.pageEntries.forEach(entry => {
      let record = {};
      record.code = entry.code;
      record.asid = entry.asid;
      //FIXME: asi jich muze byt vice, nebo zadna
      if (entry.config && entry.config.deployUnits && entry.config.deployUnits[0]) {
        record.nodeSize = entry.config.deployUnits[0].nodeSize;
      } else {
        record.nodeSize = "";
      }
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