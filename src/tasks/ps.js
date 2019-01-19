const Table = require('cli-table2');
const OidcTokenProvider = require("../oidc-token-provider");
const UuCloud = require("../uucloud/uucloud");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const psTaskDefinitions = [
  {
    name: "resourcePool",
    alias: "r",
    type: String,
    description: "uuCloud Resource pool uri."
  },
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Displays this help."
  }
];

const sections = [
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
    optionList: psTaskDefinitions
  }
];

class PsTask {

  async execute(cliArgs) {

    let options = commandLineArgs(psTaskDefinitions, {argv: cliArgs});

    if(options.help){
      this._printHelp();
      return;
    }

    if (!options.resourcePool) {
      this._optionsError("Resource pool must be specified.");
      return;
    }

    //FIXME read from configuration and params
    await this.getResourcePoolInfo(options.resourcePool);
  }

  async getResourcePoolInfo(resourcePoolUri) {
    let oidcToken = new OidcTokenProvider().getToken();

    let uuCloud = new UuCloud({oidcToken});
    let deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);

    let table = new Table({
      head: ["asid", "uuSubApp", "Node size", "Node Count"],
      colWidths: [36, 50, 10, 10]
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
      table.push([record.asid, record.code, record.nodeSize, record.nodeCount]);
    });

    console.log(table.toString());
  }

  _optionsError(message) {
    console.error(message);
    this._printHelp();
  }

  _printHelp() {
    let usage = commandLineUsage(sections);
    console.log(usage);
  }
}

module.exports = PsTask;