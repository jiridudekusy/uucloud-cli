const UuLogStore = require("../uucloud/uulog-store");
const dateUtils = require('date-and-time');
const chalk = require('chalk');
const OidcTokenProvider = require("../oidc-token-provider");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const UuCloud = require("../uucloud/uucloud");
const UESUri = require("../misc/ues-uri");
const parseRelativeDateTime = require("../misc/relative-date-parser");

const APPLICATION_COLORS = [chalk.green, chalk.magenta, chalk.cyan, chalk.greenBright, chalk.magentaBright, chalk.cyanBright];

const logsTaskDefinitions = [
  {
    name: "follow",
    alias: "f",
    type: Boolean,
    description: "Follow log output. Cannot be used together with since, tail or until."
  },
  {
    name: "since",
    type: String,
    description: "Show logs since timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes or 2h for 2 hours)."
  },
  //TODO not supported yet
  // {
  //   name: "tail",
  //   type: Number,
  //   description: "Number of lines to show from the end of the logs (default 2000)."
  // },
  {
    name: "until",
    type: String,
    description: "Show logs before a timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes or 2h for 2 hours)."
  },
  {
    name: "resourcePool",
    alias: "r",
    type: String,
    description: "uuCloud Resource pool uri."
  },
  {
    name: "disable-resolving",
    alias: "n",
    type: Boolean,
    description: "Do not use uuCloud uuCmd getAppDeploymentList to resolve apps codes, asids and tags. With this option you can use only appDeploymentUri in apps."
  },
  {
    name: "help",
    type: Boolean,
    description: "Print this guide."
  },
  {
    name: 'apps',
    defaultOption: true,
    multiple: true,
    description: "Definition of apps. It can be either complete appDeploymentUri(one or more), tags (one or more), asid(one or more) or start of it or any combination."
  }
];

const sections = [
  {
    header: "logs command",
    content: "Displays list of deployed uuApps."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud logs [-r {underline uri}] [-f] {underline apps} ...'
  },
  {
    header: 'Options',
    optionList: logsTaskDefinitions
  },
  {
    header: "Examples",
    content: [
      {
        example: "uucloud -f ues:ABC:DEF:GHI",
        description: "Prints last logs of uuApp with deployment uri \"ues:ABC:DEF:GHI\" and follows the logs."
      },
      {
        example: "uucloud -f ues:ABC:DEF:GHI ues:ASD:QWE:RTE",
        description: "Prints last logs of uuApps with deployment uri \"ues:ABC:DEF:GHI\" and \"ues:ASD:QWE:RTE\"and follows the logs."
      },
      {
        example: "uucloud -r ues:123:456 -f as t81a b66",
        description: "Prints last logs of uuApps with asid that starts with \"as\", \"t81a\" or \"b66\" and follows the logs."
      },
      {
        example: "uucloud --since 24h ues:ABC:DEF:GHI",
        description: "Prints logs fol last 24 hours of uuApp with deployment uri \"ues:ABC:DEF:GHI\"."
      },
    ]
  },
  {
    header: "How does apps selection Work ?",
    content: `Apps selection works using 3 mechanisms. You can combine all of them together.
              1) {bold Specify uuAppDeploymentUri}
              In this mode you identify uuApps by specifying their full deployment uri. You can obtain the uri from deployment configuration of the application. Only this mode works with -n.
              2) {bold Specify asid or part of it}
              This mode works very similar to docker command but instead of container id you are using asid. You can find asid in output of uucloud ps. It is not required to specify full asid. It is enough to write just few starting characters. 
              
              3) {bold Specify tags}
              This is most comfortable way how to specify uuApps, but it requires changes in deployment configuration. Any app can have in ints deployment configuration following property :
              tags:"<tag1>,<tag2>,<tag3>" 
              
              Any number of tags can be specified, however thay have to be alphanumeric and separated by comma. 
              
              In uucloud ps  you can see tags assigned to the application and you can use them to query the logs using following principles. 
              * comma means and
              * space means or
              
              {underline Examples}:
              {bold dev1} = All uuApps in resource pool with tag dev1.
              {bold dev1 dev2} = All uuApps in resource pool with tag dev1 OR dev2.
              {bold dev1,odm dev1,control} = All uuApps in resource pool with tags (dev1 AND odm) OR (dev1 AND control).`
  }
];

class LogsTask {

  async execute(cliArgs) {

    let options = commandLineArgs(logsTaskDefinitions, {argv: cliArgs});

    if (options.help) {
      this._printHelp();
      process.exit(0);
    }
    if (!options.apps || options.apps.length === 0) {
      this._optionsError("You must specify at least 1 app.");
      process.exit(2);
    }
    if (options.follow && (options.since || options.tail || options.until)) {
      this._optionsError("You can either use follow or other options");
      process.exit(2);
    }
    let apps;
    if (!options["disable-resolving"]) {
      if (!options.resourcePool) {
        this._optionsError("You must specify resource pool if you want to resolve uuApps deployment using getAppDeploymentList.")
        return;
      }
      apps = await this._getAppsFromAppDeploymentList(options.apps, options.resourcePool);
    } else {
      apps = this._getAppsFromParams(options.apps);
    }
    if (options.follow) {
      console.log(apps.map(app => "Following logs for application : " + app.appDeploymentUri).join("\n"));
      await this.followLog(apps);
    } else {
      let from;
      let now = new Date();
      if (options.since) {
        from = parseRelativeDateTime(options.since, now);
        if (!from) {
          this._optionsError("Cannot parse since.");
          process.exit(2);
        }
      }
      let to;
      if (options.until) {
        to = parseRelativeDateTime(options.until, now);
        if (!to) {
          this._optionsError("Cannot parse until.");
          process.exit(2);
        }
      }
      if (to && !from) {
        this._optionsError("If you specify since, you must also specify until.");
        return;
      }
      if (from && !to) {
        to = now;
      }
      console.log(apps.map(app => "Getting logs for application : " + app.appDeploymentUri).join("\n"));
      if (apps.length != 1) {
        this._optionsError("You can follow logs up to 10 applications, but you can list history logs only for 1.");
        process.exit(2);
      }
      await this.getLog(apps, from, to);
    }
  }

  async _getAppsFromAppDeploymentList(appsIdentifiers, resourcePoolUri) {
    let oidcToken = new OidcTokenProvider().getToken();
    let uuCloud = new UuCloud({oidcToken});
    let deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);
    let filteredApps = deployList.pageEntries.filter(app => {
      //if user specified whole deployment uri
      if (appsIdentifiers.indexOf(app.uri) > -1) {
        return true;
      }
      if (app.asid && appsIdentifiers.filter(appId => app.asid.startsWith(appId)).length > 0) {
        return true;
      }
      if (app.config.deploymentTimeConfig && app.config.deploymentTimeConfig.tags) {
        let appTags = app.config.deploymentTimeConfig.tags.split(",");
        let matchedIdentifiers = appsIdentifiers.map(id => id.split(",")).filter(tags => {
          for (let tag of tags) {
            if (!appTags.includes(tag)) {
              return false;
            }
          }
          return true;
        });
        if (matchedIdentifiers.length > 0) {
          return true;
        }
      }
      return false;
    });

    let apps = filteredApps.map(app => {
      return {
        code: app.code,
        appDeploymentUri: app.uri
      }
    });
    return apps;
  }

  _getAppsFromParams(appsIdentifiers) {
    let apps = appsIdentifiers.map(appId => {
      let uesUri = UESUri.parse(appId);
      if (!uesUri || (!uesUri.object.id && !uesUri.object.code)) {
        this._optionsError(`"${appId}" is not valid deployment uri.`);
        process.exit(2);
      }
      let code = uesUri.object.code;
      if (!code) {
        code = appId;
      }
      return {
        code,
        appDeploymentUri: appId
      }
    });
    return apps;
  }

  async followLog(apps) {
    let token = new OidcTokenProvider().getToken();

    let config = {
      oidcToken: token
    };

    let uuLogStore = new UuLogStore(config);
    let appDeploymentUris = apps.map(app => app.appDeploymentUri);
    let appsFormat = this._prepareApplicationFormat(apps);
    // let logs = await uuLogStore.getLogs(appDeploymentUri, from,null, logs => logs.forEach(formatLogRecord));
    await uuLogStore.tailLogs(appDeploymentUris, (logs) => this._printLogs(logs, appsFormat));
  }

  async getLog(apps, from, to) {
    let token = new OidcTokenProvider().getToken();

    let config = {
      oidcToken: token
    };

    let uuLogStore = new UuLogStore(config);
    let appDeploymentUris = apps.map(app => app.appDeploymentUri);
    let appsFormat = this._prepareApplicationFormat(apps);
    // let logs = await uuLogStore.getLogs(appDeploymentUri, from,null, logs => logs.forEach(formatLogRecord));
    await uuLogStore.getLogs(appDeploymentUris[0], from, to, (logs) => this._printLogs(logs, appsFormat));
  }

  _formatLogLevel(logLevel) {
    switch (logLevel) {
      case "ERROR":
        return chalk.red(logLevel);
      case "WARNING":
        return chalk.yellow(logLevel);
      case "INFO":
        return chalk.cyan(logLevel);
      default:
        return logLevel;
    }
  }

  _formatApplication(r, apps) {
    if (apps[r.appDeploymentUri]) {
      return apps[r.appDeploymentUri].code;
    } else {
      return "UNKNOWN.APP | ";
    }
  }

  _prepareApplicationFormat(apps) {
    let maxLength = apps.reduce((acc, app) => app.code.length > acc ? app.code.length : acc, 0);
    apps = apps.map((app, index) => {
      app.code = app.code.padEnd(maxLength, " ");
      app.code = APPLICATION_COLORS[index % APPLICATION_COLORS.length](app.code + " | ");
      return app;
    });
    apps = apps.reduce((acc, app) => {
      acc[app.appDeploymentUri] = app;
      return acc;
    }, {});
    return apps;
  }

  _formatLogRecord(r, apps) {
    //20:49:42.221 [main] DEBUG usy.libra.dataflowgw.SubAppRunner - Running with Spring Boot v1.5.7.RELEASE, Spring v4.3.11.RELEASE
    //@formatter:off
    return `${this._formatApplication(r, apps)}${dateUtils.format(r.eventTime, "YYYY-MM-DD HH:mm:ss.SSS")} ${r.recordType} [${r.threadName}] ${this._formatLogLevel(r.logLevel)} ${r.logger} - ${r.message}`;
    //@formatter:on
  }

  _printLogs(logs, apps) {
    logs.length > 0 && console.log(logs.map(logRecord => this._formatLogRecord(logRecord, apps)).join("\n").trim());
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

module.exports = LogsTask;