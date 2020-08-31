const UuLogStore = require("../uucloud/uulog-store");
const dateUtils = require('date-and-time');
const chalk = require('chalk');
const OidcTokenProvider = require("../oidc-token-provider");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const UuCloud = require("../uucloud/uucloud");
const UESUri = require("../misc/ues-uri");
const parseRelativeDateTime = require("../misc/relative-date-parser");
const {commonOptionsDefinitionsWithPresent, verifyCommonOptionsDefinitionsWithPresent} = require("../misc/common-tasks-option");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");
const {promisify} = require('util');
const mkdirp = promisify(require('mkdirp'));
const path = require("path");
const fs = require("fs");
const {compileExpression} = require("filtrex");
const Handlebars = require("handlebars");
const helpers = require("handlebars-helpers")({
  handlebars: Handlebars
});

Handlebars.registerHelper("subAppCode", (appDeploymentUri, options) => {
  if (options.data.root._appsFormat[appDeploymentUri]) {
    return options.data.root._appsFormat[appDeploymentUri].code;
  } else {
    return "UNKNOWN.APP |";
  }
});

Handlebars.registerHelper("logLevel", (logLevel, options) => {
  if (!options.data.root.withColour) {
    return logLevel;
  } else {
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
});

const DEFAULT_LOG_FORMAT = `{{subAppCode log.appDeploymentUri}} {{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.recordType}} [{{log.threadName}}] {{logLevel log.logLevel}} {{log.logger}} - {{log.message}} {{log.stackStrace}}`;
const DEFAULT_LOG_FILE_FORMAT = `{{date log.eventTime "YYYY-MM-DD HH:mm:ss,SSS"}} {{log.recordType}} [{{log.threadName}}] {{logLevel log.logLevel}} {{log.logger}} - {{log.message}} {{log.stackStrace}}`;


const APPLICATION_COLORS = [chalk.green, chalk.magenta, chalk.cyan, chalk.greenBright, chalk.magentaBright, chalk.cyanBright];

function escapeChalk(text){
  return text.replace(/([\\{}"])/g, "\\$1")
}

const optionsDefinitions = [
  {
    name: "follow",
    alias: "f",
    type: Boolean,
    description: "Follow log output. Cannot be used together with since, tail or until."
  },
  {
    name: "output",
    alias: "o",
    type: String,
    description: "Output directory for logs. Can be used only without \"follow\". With this option it is possible to get logs of multiple apps (each saved in separate file)."
  },
  {
    name: "since",
    type: String,
    description: "Show logs since timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes or 2h for 2 hours)."
  },
  {
    name: "until",
    type: String,
    description: "Show logs before a timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes or 2h for 2 hours)."
  },
  {
    name: "disable-resolving",
    alias: "n",
    type: Boolean,
    description: "Do not use uuCloud uuCmd getAppDeploymentList to resolve apps codes, asids and tags. With this option you can use only appDeploymentUri in apps."
  },
  {
    name: "log-store-uri",
    type: String,
    description: "Use different uuLostoreBaseUri than default."
  },
  {
    name: "format",
    type: String,
    description: "Format of log message as handlebars expression."
  },
  {
    name: "codec",
    type: String,
    description: "Format od result. Supported values : \"json\" or \"formatted\"(default)",
    defaultValue: "formatted"
  },
  {
    name: "filter",
    type: String,
    description: "Filter log records."
  },
  ...commonOptionsDefinitionsWithPresent,
  {
    name: 'apps',
    defaultOption: true,
    multiple: true,
    description: "Definition of apps. It can be either complete appDeploymentUri(one or more), tags (one or more), asid(one or more) or start of it or any combination."
  }
];

const help = [
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
    optionList: optionsDefinitions
  },
  {
    header: "Examples",
    content: [
      {
        example: "uucloud logs -f ues:ABC:DEF:GHI",
        description: "Prints last logs of uuApp with deployment uri \"ues:ABC:DEF:GHI\" and follows the logs."
      },
      {
        example: "uucloud logs -f ues:ABC:DEF:GHI ues:ASD:QWE:RTE",
        description: "Prints last logs of uuApps with deployment uri \"ues:ABC:DEF:GHI\" and \"ues:ASD:QWE:RTE\"and follows the logs."
      },
      {
        example: "uucloud logs -r ues:123:456 -f as t81a b66",
        description: "Prints last logs of uuApps with asid that starts with \"as\", \"t81a\" or \"b66\" and follows the logs."
      },
      {
        example: "uucloud logs --since 24h ues:ABC:DEF:GHI",
        description: "Prints logs fol last 24 hours of uuApp with deployment uri \"ues:ABC:DEF:GHI\"."
      },
      {
        example: "uucloud logs --since 24h -o logs dev1",
        description: "Gets logs of all applications with tag \"dev1\" and saves them to directoey \"logs\"."
      },
    ]
  },
  {
    header: "How does formatting work ?",
    content: `In case that you are not satisfied with default log record print format, you can specify custom format using option --format.
              The formatting of log records is done using Handlebars with following extensions:
              * inclusion of handlebars-helpers (https://github.com/helpers/handlebars-helpers)
              * 2 custom helpers
                * loglevel - provides color formatting of log level
                * subAppCode - provides formatting of appDeploymentUri to colorized sub application code  
              
              Each log record has following fields which you can use in format:
              
              Common fields
              * appVersion - version of subApp
              * runtimeStackCode - code of runtime stack
              * UUCloudResourcePoolUri - uri of resource pool
              * resourceGroupCode - name of resource group
              * hostName - name of host
              * appDeploymentUri - uri of application deployment. Most likely you will use this with subAppCode handlebars helper
              * eventTime - time of event as JS date. Most likely you will use this with date handlebars helper
              * id - id of log record
              * nodeImageName
              * traceId - id of request from http header X-Request-ID, calls from subApp to another subApp usually has same traceId so it can be used to trace 
                          the request though multiple subApps
              * logLevel - level o log record. Most likely you will use this with logLevel handlebars helper
              * nodeName - uuNode name
              * message - log message
              * recordType - type of log record usually ACCESS_LOG or TRACE_LOG        
              
              TRACE_LOG fields
              * logger - name of logger
              * threadId - id of thread
              * threadName - name of thread
              * processId
              * clientId - oidc client id (btw. this is usually awid/asid code)
              * resourceUri - path of command
              * sessionId
              * identityId - uid of logged identity
              
                            
              ACCESS_LOG fields
              * remoteIpAddress - ip address of source (however it seems as internal ip of uucloud)                    
              * requestLine - information about request (method, path) - only NodeJS
              * urlPath - request path - only Java
              * requestMethod - request http method - only Java
              * requestSize - size of request - only Java
              * responseSize - size of response 
              * responseTime - response time of request - only Java              * 
              * userAgent - http client user agent
              * responseStatus - status of http response`

  },
  {
    header: "Format examples",
    content: [
      {
        example: escapeChalk(`uucloud logs -f ues:ABC:DEF:GHI --format "${DEFAULT_LOG_FORMAT}"`),
        description: "Default format."
      }
    ]
  },
  {
    header: "How does filtering work ?",
    content: `In case that you need to find some specific set of log records, you can use --filter option.
    Filtering is realized using filtrex (https://www.npmjs.com/package/filtrex) and you can use all documented functions to filter log records.

    To get list of all log record fields please log in section "How does formatting work ?". For filtering you should not use "log." as prefix before field.

    Please note that filtering is not function of uuLogStore, but it is done on your machine. This means tha if you are trying to find one specific record
    in logs for the whole week, all those logs must be fetched from uuLogStore and filtered on your machine and it could take some time.`
  },
  {
    header: "Format and filtering examples",
    content: [
      {
        example: escapeChalk(String.raw`uucloud logs -f ues:ABC:DEF:GHI --filter "recordType == \"ACCESS_LOG\"" --format "{{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.requestLine}}"`),
        description: "Print all access log reqcords (works for nodejs only)."
      },
      {
        example: escapeChalk(String.raw`uucloud logs -f ues:ABC:DEF:GHI --filter "recordType == \"ACCESS_LOG\" and responseTime > 1000" --format "{{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.urlPath}} {{log.responseTime}}"`),
        description: "Print all access log records with responseTime > 1000ms (works for Java only)."
      },
      {
        example: escapeChalk(String.raw`uucloud logs -f ues:ABC:DEF:GHI --filter "logLevel == \"ERROR\""`),
        description: "Print all ERRORS."
      }
    ]
  },
  {
    header: "How does apps selection work ?",
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
  },
];

class LogsTask {

  constructor(opts) {
    this._taskUtils = new TaskUtils(optionsDefinitions, help);
    this._opts = opts;
  }

  async execute(cliArgs) {

    let options = this._taskUtils.parseCliArguments(cliArgs);
    verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
    this._taskUtils.testOption(options.apps && options.apps.length > 0, "You must specify at least 1 app.");
    if (options.follow && (options.since || options.tail || options.until)) {
      this._taskUtils.printOtionsErrorAndExit("You can either use follow or other options");
    }
    this._taskUtils.testOption(["json", "formatted"].indexOf(options.codec) > -1, "Invalid codec.");
    let present = this._taskUtils.loadPresent(options);
    let apps;
    options = this._taskUtils.mergeWithConfig(options, present);
    if (!options["disable-resolving"]) {
      if (!present || !present.mocks || !present.mocks.getAppDeploymentList) {
        this._taskUtils.testOption(options.resourcePool,
            "You must specify resource pool(in arguments, using uucloud use or use present with mock response to getAppDeploymentList) if you want to resolve uuApps deployment using getAppDeploymentList.")
      }
      apps = await this._getAppsFromAppDeploymentList(options.apps, options.resourcePool, options, present);
    } else {
      apps = this._getAppsFromParams(options.apps);
    }
    let filterFn = () => true;
    if (options.filter) {
      filterFn = compileExpression(options.filter);
    }
    if (options.follow) {
      this._taskUtils.testOption(!options.output, "You cannot uses output together with follow.");
      console.log(apps.map(app => "Following logs for application : " + app.appDeploymentUri).join("\n"));
      await this.followLog(apps, filterFn, options);
    } else {
      let from;
      let now = new Date();
      if (options.since) {
        from = parseRelativeDateTime(options.since, now);
        this._taskUtils.testOption(from, "Cannot parse since.");
      }
      let to;
      if (options.until) {
        to = parseRelativeDateTime(options.until, now);
        this._taskUtils.testOption(to, "Cannot parse until.");
      }
      if (to && !from) {
        this._taskUtils.printOtionsErrorAndExit("If you specify since, you must also specify until.");
      }
      if (from && !to) {
        to = now;
      }
      if (from) {
        console.log(`Getting logs since : ${from.toISOString()} until: ${to.toISOString()}`);
      }
      console.log(apps.map(app => "Getting logs for application : " + app.appDeploymentUri).join("\n"));
      if (!options.output) {
        this._taskUtils.testOption(apps.length === 1, "You can follow logs up to 10 applications, but you can list history logs only for 1.");
      }
      await this.getLog(apps, from, to, filterFn, options);
    }
  }

  async _getAppsFromAppDeploymentList(appsIdentifiers, resourcePoolUri, options, present) {
    let deployList;
    if (present && present.mocks && present.mocks.getAppDeploymentList) {
      deployList = present.mocks.getAppDeploymentList;
    } else {
      let oidcToken = await new OidcTokenProvider().getToken(options);
      let uuCloud = new UuCloud({oidcToken});
      deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);
    }
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
        this._taskUtils.printOtionsErrorAndExit(`"${appId}" is not valid deployment uri.`);
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

  async followLog(apps, filterFn, options) {
    let token = await new OidcTokenProvider().getToken(options);

    let config = {
      oidcToken: token
    };
    if (options["log-store-uri"]) {
      config.logStoreUri = options["log-store-uri"];
    }
    let uuLogStore = new UuLogStore(config);
    let appDeploymentUris = apps.map(app => app.appDeploymentUri);
    //tail logs cannot be with --output
    let appsFormat = this._prepareApplicationFormat(apps, true);
    // let logs = await uuLogStore.getLogs(appDeploymentUri, from,null, logs => logs.forEach(formatLogRecord));
    await uuLogStore.tailLogs(appDeploymentUris, (logs) => this._printLogs(logs.filter(filterFn), appsFormat, options.codec, options.format));
  }

  async getLog(apps, from, to, filterFn, options) {
    let token = await new OidcTokenProvider().getToken(options);

    let config = {
      oidcToken: token
    };
    if (options["log-store-uri"]) {
      config.logStoreUri = options["log-store-uri"];
    }
    let uuLogStore = new UuLogStore(config);
    let appsFormat = this._prepareApplicationFormat(apps, !!options.output);
    if (options.output) {
      let outputDir = path.resolve(this._opts.currentDir, options.output);
      await mkdirp(outputDir);
      let promises = apps.map(
          (app) => uuLogStore.getLogs(app.appDeploymentUri, from, to, (logs) => this._storeLogs(outputDir, app, appsFormat, options.codec, options.format, logs.filter(filterFn))));
      await Promise.all(promises);
      console.log(`All logs has been exported to ${outputDir}`);
    } else {
      let appDeploymentUris = apps.map(app => app.appDeploymentUri);
      // let logs = await uuLogStore.getLogs(appDeploymentUri, from,null, logs => logs.forEach(formatLogRecord));
      await uuLogStore.getLogs(appDeploymentUris[0], from, to, (logs) => this._printLogs(logs.filter(filterFn), appsFormat, options.codec, options.format));
    }
  }

  _storeLogs(output, app, appsFormat, codec, format, logs) {
    let uesUri = UESUri.parse(app.appDeploymentUri);
    let filename = `${uesUri.object.code || ""}-${uesUri.object.id}.log`;
    let file = path.resolve(output, filename);
    console.debug(`Storing ${logs.length} for app ${uesUri.object.code} into file ${file}`);
    fs.appendFileSync(file, logs.map(logRecord => this._formatLogRecordForFile(logRecord, appsFormat, format)).join("\n").trim(), "utf8");
  }

  _prepareApplicationFormat(apps, withColour) {
    let maxLength = apps.reduce((acc, app) => app.code.length > acc ? app.code.length : acc, 0);
    apps = apps.map((app, index) => {
      app.code = app.code.padEnd(maxLength, " ");
      if (withColour) {
        app.code = APPLICATION_COLORS[index % APPLICATION_COLORS.length](app.code + " |");
      } else {
        app.code = app.code + " |";
      }
      return app;
    });
    apps = apps.reduce((acc, app) => {
      acc[app.appDeploymentUri] = app;
      return acc;
    }, {});
    return apps;
  }

  _formatLogRecordForFile(r, appsFormat, codec, format) {
    return this._formatLogRecordInternal(r, appsFormat, {withColour: true, defaultFormat: DEFAULT_LOG_FILE_FORMAT, format, codec});
  }

  _formatLogRecord(r, apps, codec, format) {
    return this._formatLogRecordInternal(r, apps, {withColour: true, defaultFormat: DEFAULT_LOG_FORMAT, format, codec});
  }

  _formatLogRecordInternal(r, apps, {withColour, format, defaultFormat, codec}){
    if(codec === "json") {
      return JSON.stringify(r, null, 2)+",";
    }
    let context = {
      _appsFormat: apps,
      withColour,
      log: r
    };
    let pattern = format || defaultFormat;
    let template = Handlebars.compile(pattern, {noEscape: true});
    return template(context);
  }

  _printLogs(logs, apps, codec, format) {
    logs.length > 0 && console.log(logs.map(logRecord => this._formatLogRecord(logRecord, apps, codec, format)).join("\n").trim());
  }
}

module.exports = LogsTask;
