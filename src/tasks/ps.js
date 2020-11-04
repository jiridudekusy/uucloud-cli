const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const {commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent} = require("../misc/common-tasks-option");
const {filterAppDeployments} = require("../uucloud/uucloud-utils");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");

const optionsDefinitions = [
  ...commonOptionsDefinitionsWithPresentAndApps,
  {
    name: "codec",
    type: String,
    description: `Format od result. Supported values : "table"(default) or "raw"(JSON received from command call. It can be filtered using "apps" option.)`,
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
      this._printTable(deployList, options.apps);
    } else if (options.codec === "raw") {
      this._printRaw(deployList, options.apps);
    }
  }

  _printRaw(deployList, apps) {
    let filteredPageEntries;
    if (apps) {
      filteredPageEntries = filterAppDeployments(deployList, apps);
    } else {
      filteredPageEntries = deployList;
    }
    console.log(JSON.stringify(filteredPageEntries, null, 2));
  }

  _printTable(deployList, apps) {
    let table = new Table({
      head: ["asid", "uuSubApp", "Version", "Tags", "Node size", "Node Count", "CPU", "Memory"],
      colWidths: [34, 50, 20, 20, 12, 13, 10, 10]
    });
    // let pageEntries
    let pageEntries = deployList.pageEntries;
    let filteredPageEntries = filterAppDeployments(deployList, apps);
    let filteredRecords = filteredPageEntries.map(this._transformDeploymentEntry);
    let allRecords = pageEntries.map(this._transformDeploymentEntry);
    let totalFiltered = this._countTotal(filteredRecords, "Total filtered");
    let totalAll = this._countTotal(allRecords, "Total");
    if (totalAll.nodeCount != totalFiltered.nodeCount) {
      filteredRecords.push(totalFiltered);
    }
    filteredRecords.push(totalAll);

    filteredRecords.forEach(
        record => table.push([record.asid, record.code, record.version, record.tags, record.nodeSize, record.nodeCount, record.cpu, record.memory]));
    console.log(table.toString());
  }

  _countTotal(filteredRecords, label) {
    return filteredRecords.reduce((t, r) => {
          t.nodeCount += r.nodeCount;
          t.cpu += r.cpu;
          t.memory += r.memory;
          return t;
        },
        {
          asid: label,
          code: "",
          version: "",
          nodeSize: "",
          nodeCount: 0,
          tags: "",
          cpu: 0,
          memory: 0
        }
    );
  }

  _transformDeploymentEntry(entry) {
    let record = {};
    record.code = entry.code;
    record.asid = entry.asid;
    record.version = entry.version;
    //FIXME: asi jich muze byt vice, nebo zadna
    if (entry.config && entry.config.deployUnits && entry.config.deployUnits[0]) {
      record.nodeSize = entry.config.deployUnits[0].nodeSize;
    } else {
      record.nodeSize = "";
    }
    record.nodeCount = 0;
    if (entry.nodeSets) {
      record.nodeCount = entry.nodeSets.reduce((count, nodeSet) => count + nodeSet.nodeCount, 0);
    }

    record.tags = "";
    if (entry.config.deploymentTimeConfig && entry.config.deploymentTimeConfig.tags) {
      record.tags = entry.config.deploymentTimeConfig.tags;
    }
    record.cpu = 0;
    record.memory = 0;
    if (entry.allocatedCapacity) {
      record.cpu = entry.allocatedCapacity.cpu;
      record.memory = entry.allocatedCapacity.mem;
    }
    return record;
  }
}

module.exports = PsTask;
