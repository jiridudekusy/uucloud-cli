const UuLogStore = require("../uucloud/uulog-store");
const dateUtils = require('date-and-time');
const chalk = require('chalk');
const OidcTokenProvider = require("../oidc-token-provider");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const UuCloud = require("../uucloud/uucloud");
const UESUri = require("../misc/ues-uri");
const parseRelativeDateTime = require("../misc/relative-date-parser");
const {
    commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent
} = require("../misc/common-tasks-option");
const Config = require("../misc/config");
const TaskUtils = require("../misc/task-utils");
const {filterAppDeployments} = require("../uucloud/uucloud-utils");
const {promisify} = require('util');
const mkdirp = promisify(require('mkdirp'));
const path = require("path");
const fs = require("fs");
const {compileExpression} = require("filtrex");
const readLastLines = require('read-last-lines');
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

const DEFAULT_LOG_FORMAT = `{{subAppCode log.appDeploymentUri}} {{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.recordType}} [{{log.threadName}}] {{logLevel log.logLevel}} {{log.logger}} - {{log.message}} {{log.stackTrace}}`;
const DEFAULT_LOG_FILE_FORMAT = `{{date log.eventTime "YYYY-MM-DD HH:mm:ss,SSS"}} {{log.recordType}} [{{log.threadName}}] {{logLevel log.logLevel}} {{log.logger}} - {{log.message}} {{log.stackTrace}}`;

const APPLICATION_COLORS = [chalk.green, chalk.magenta, chalk.cyan, chalk.greenBright, chalk.magentaBright, chalk.cyanBright];

function escapeChalk(text) {
    return text.replace(/([\\{}"])/g, "\\$1")
}

const optionsDefinitions = [{
    name: "follow",
    alias: "f",
    type: Boolean,
    description: "Follow log output. Cannot be used together with since, tail or until."
}, {
    name: "output",
    alias: "o",
    type: String,
    description: "Output directory for logs. Can be used only without \"follow\". With this option it is possible to get logs of multiple apps (each saved in separate file)."
}, {
    name: "recover",
    type: Boolean,
    description: "If codec = jsonstream and output and interval is specified, recover logs download."
}, {
    name: "since",
    type: String,
    description: "Show logs since timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes or 2h for 2 hours)."
}, {
    name: "until",
    type: String,
    description: "Show logs before a timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes or 2h for 2 hours)."
}, {
    name: "disable-resolving",
    alias: "n",
    type: Boolean,
    description: "Do not use uuCloud uuCmd getAppDeploymentList to resolve apps codes, asids and tags. With this option you can use only appDeploymentUri in apps."
}, {
    name: "log-store-uri", type: String, description: "Use different uuLostoreBaseUri than default."
}, {
    name: "format", type: String, description: "Format of log message as handlebars expression."
}, {
    name: "codec",
    type: String,
    description: "Format od result. Supported values : \"formatted\"(default), \"json\" or \"jsonstream\"(Line-delimited JSON)",
    defaultValue: "formatted"
}, {
    name: "filter", type: String, description: "Filter log records (on client side after records are downloaded)."
}, {
    name: "criteria",
    alias: "c",
    type: String,
    multiple: true,
    description: "Select log reccords based on criteria (server side). Format should be \"[key]:[value]\". Multiple criteria can be specificed."
}, {
    name: "timeWindowType",
    type: String,
    description: "Format od result. Supported values : \"timeStamp\"(default), \"time\", \"eventTime\""
}, ...commonOptionsDefinitionsWithPresentAndApps];

const help = [{
    header: "logs command", content: "Displays list of deployed uuApps."
}, {
    header: 'Synopsis', content: '$ uucloud logs [-r {underline uri}] [-f] {underline apps} ...'
}, {
    header: 'Options', optionList: optionsDefinitions
}, {
    header: "Examples", content: [{
        example: "uucloud logs -f ues:ABC:DEF:GHI",
        description: "Prints last logs of uuApp with deployment uri \"ues:ABC:DEF:GHI\" and follows the logs."
    }, {
        example: "uucloud logs -f ues:ABC:DEF:GHI ues:ASD:QWE:RTE",
        description: "Prints last logs of uuApps with deployment uri \"ues:ABC:DEF:GHI\" and \"ues:ASD:QWE:RTE\"and follows the logs."
    }, {
        example: "uucloud logs -r ues:123:456 -f as t81a b66",
        description: "Prints last logs of uuApps with asid that starts with \"as\", \"t81a\" or \"b66\" and follows the logs."
    }, {
        example: "uucloud logs --since 24h ues:ABC:DEF:GHI",
        description: "Prints logs fol last 24 hours of uuApp with deployment uri \"ues:ABC:DEF:GHI\"."
    }, {
        example: "uucloud logs --since 24h -o logs dev1",
        description: "Gets logs of all applications with tag \"dev1\" and saves them to directoey \"logs\"."
    },]
}, {
    header: "How to use uuCloudLogStoreg02 ?", content: [`${`uucloud-cli is able to work with both generations of uuCloudLogstore. The key difference is that uuCloudLogStoreg02 
has usually different uri for each resource pool. To use uuCloudLogStoreg02, it is sufficient just to specify 
its uri via {bold --log-store-uri} option. There are some minor differences in API and uucloud-cli decides
which version(g01 or g02) API will be uses according to uri. If uri contains uu-cloudlogstore-maing02 then
g02 API is used.`.replaceAll("\n", " ")} 
              
${`Another difference is possibility to get logs via ASID (this has been already possible in uucloud-cli 
but now it is also possible via uuCloudLogStoreg02 API. It might not seem useful, but it is really useful
when you have no access list deployed applications in uuCloud resourcePool or when you are using uuCloudg02.(uuCloudg02 is not yet integrated into uucloud-cli)
In case that you want get logs via asid just put it into command line on place where you put appDeploymentUri.`.replaceAll("\n", " ")}       
    `,]
}, {
    content: [{
        example: `uucloud logs -n --log-store-uri https://uuapp.plus4u.net/uu-cloudlogstore-maing02/c4d47fa2794e94324ad884463e28e235 95532238dd9ee74c60ea189ec00e8fc3`,
        description: "List logs for asid 95532238dd9ee74c60ea189ec00e8fc3 from specified logstore uri. Option -n disables listing of deployed applications."
    }]
}, {
    header: "How does formatting work ?", content: `In case that you are not satisfied with default log record print format, you can specify custom format using option --format.
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
              * responseTime - response time of request - only Java              
              * userAgent - http client user agent
              * responseStatus - status of http response`

}, {
    header: "Format examples", content: [{
        example: escapeChalk(`uucloud logs -f ues:ABC:DEF:GHI --format "${DEFAULT_LOG_FORMAT}"`),
        description: "Default format."
    }]
}, {
    header: "How does criteria works ?", content: `In case that you need to find some specific set of log records, you have 2 options.
    1) Server-side by using --criteria. (more efficient)
    2) Client-side by using --filter. (not efficient but poweful - described latter)

    By using criteria you are able to use any dtoIn parameter of uuCmd https://uuapp.plus4u.net/uu-bookkit-maing01/8e029f520c1747d3a6b5fa270fe04f15/book/page?code=getRecordList .
    `
}, {
    header: "How does filtering works ?", content: `In case that you need to find some specific set of log records, you can use --filter option.
    Filtering is realized using filtrex (https://www.npmjs.com/package/filtrex) and you can use all documented functions to filter log records.

    To get list of all log record fields please log in section "How does formatting work ?". For filtering you should not use "log." as prefix before field.

    Please note that filtering is not function of uuLogStore, but it is done on your machine. This means tha if you are trying to find one specific record
    in logs for the whole week, all those logs must be fetched from uuLogStore and filtered on your machine and it could take some time.`
}, {
    header: "Format and filtering examples", content: [{
        example: escapeChalk(String.raw`uucloud logs -f ues:ABC:DEF:GHI --filter "recordType == \"ACCESS_LOG\"" --format "{{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.requestLine}}"`),
        description: "Print all access log reqcords (works for nodejs only)."
    }, {
        example: escapeChalk(String.raw`uucloud logs -f ues:ABC:DEF:GHI --filter "recordType == \"ACCESS_LOG\" and responseTime > 1000" --format "{{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.urlPath}} {{log.responseTime}}"`),
        description: "Print all access log records with responseTime > 1000ms (works for Java only)."
    }, {
        example: escapeChalk(String.raw`uucloud logs -f ues:ABC:DEF:GHI --filter "logLevel == \"ERROR\""`),
        description: "Print all ERRORS."
    }]
}, {
    header: "How does apps selection work ?", content: `Apps selection works using 3 mechanisms. You can combine all of them together.
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
},];

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
        this._taskUtils.testOption(["json", "formatted", "jsonstream"].indexOf(options.codec) > -1, "Invalid codec.");
        let present = this._taskUtils.loadPresent(options);
        let apps;
        options = this._taskUtils.mergeWithConfig(options, present);
        if (!options["disable-resolving"]) {
            if (!present || !present.mocks || !present.mocks.getAppDeploymentList) {
                this._taskUtils.testOption(options.resourcePool, "You must specify resource pool(in arguments, using uucloud use or use present with mock response to getAppDeploymentList) if you want to resolve uuApps deployment using getAppDeploymentList.")
            }
            apps = await this._getAppsFromAppDeploymentList(options.apps, options.resourcePool, options, present);
        } else {
            apps = this._getAppsFromParams(options.apps);
        }
        let filterFn = () => true;
        if (options.filter) {
            filterFn = compileExpression(options.filter);
        }
        this._taskUtils.testOption(!(!options.stats && options.groupBy), "You cannot use groupBy without stats mode.");
        let criteria = {};
        if (options.criteria) {
            options.criteria.forEach(cv => {
                this._taskUtils.testOption(cv.includes(":"), "Critera value mus be in form [key]:[value]");
                let key = cv.slice(0, cv.indexOf(":"));
                let value = cv.slice(cv.indexOf(":") + 1);
                ;criteria[key] = value;
            });
        }
        if (options.timeWindowType) {
            this._taskUtils.testOption(["timeStamp", "time", "eventTime"].indexOf(options.timeWindowType) > -1, "Invalid timeWindowType.");
            criteria.timeWindowType = options.timeWindowType;
        }
        if (options.follow) {
            this._taskUtils.testOption(!options.output, "You cannot uses output together with follow.");
            console.error(apps.map(app => "Following logs for application : " + app.appDeploymentUri).join("\n"));
            await this.followLog(apps, filterFn, criteria, options);
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
                console.error(`Getting logs since : ${from.toISOString()} until: ${to.toISOString()}`);
            }
            console.error(apps.map(app => "Getting logs for application : " + app.appDeploymentUri).join("\n"));
            if (!options.output) {
                this._taskUtils.testOption(apps.length === 1, "You can follow logs up to 10 applications, but you can list history logs only for 1.");
            }
            await this.getLog(apps, from, to, filterFn, criteria, options);
        }
    }

    async _getAppsFromAppDeploymentList(appsIdentifiers, resourcePoolUri, options, present) {
        let deployList;
        if (present && present.mocks && present.mocks.getAppDeploymentList) {
            deployList = present.mocks.getAppDeploymentList;
        } else {
            let oidcToken = await new OidcTokenProvider().getToken(options);
            let uuCloud = new UuCloud({oidcToken, c3Uri: options["c3-uri"]});
            deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);
        }
        let filteredApps = filterAppDeployments(deployList, appsIdentifiers);

        let apps = filteredApps.map(app => {
            return {
                code: app.code, appDeploymentUri: app.uri
            }
        });
        return apps;
    }

    _getAppsFromParams(appsIdentifiers) {
        let apps = appsIdentifiers.map(appId => {
            if (appId.match(/[0-9a-f]{32}/)) {
                return {
                    code: "UNKNOWN",
                    appDeploymentUri: appId
                }
            } else {
                let uesUri = UESUri.parse(appId);
                if (!uesUri || (!uesUri.object.id && !uesUri.object.code)) {
                    this._taskUtils.printOtionsErrorAndExit(`"${appId}" is not valid deployment uri or asid.`, false);
                }
                let code = uesUri.object.code;
                if (!code) {
                    code = appId;
                }
                return {
                    code, appDeploymentUri: appId
                }
            }
        });
        return apps;
    }

    async followLog(apps, filterFn, criteria, options) {
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
        await uuLogStore.tailLogs(appDeploymentUris, criteria, (logs) => this._printLogs(logs.filter(filterFn), appsFormat, options.codec, options.format));
    }

    async getLog(apps, from, to, filterFn, criteria, options) {
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
            let promises = apps.map(async (app) => {
                if (options.recover && options.codec === "jsonstream" && to) {
                    let file = this._getLogFile(outputDir, app);
                    if (fs.existsSync(file)) {
                        try {
                            let lastLogString = await readLastLines.read(file, 1, "utf8");
                            let lastLog = JSON.parse(lastLogString);
                            let newTo = new Date(lastLog[criteria.timeWindowType || "timestamp"]);
                            to = newTo;
                            console.error(`Downloading logs for application ${app.appDeploymentUri} has been recovered. Interval since : ${from.toISOString()} until: ${to.toISOString()}`);
                        } catch (e) {
                            console.error(`Cannot recover logs dowload for application ${app.appDeploymentUri} continue with full interval. Error: ${e} `)
                        }
                    }
                }
                return uuLogStore.getLogs(app.appDeploymentUri, from, to, criteria, (logs) => this._storeLogs(outputDir, app, appsFormat, options.codec, options.format, logs.filter(filterFn)))
            });
            await Promise.all(promises);
            console.error(`All logs has been exported to ${outputDir}`);
        } else {
            let appDeploymentUris = apps.map(app => app.appDeploymentUri);
            // let logs = await uuLogStore.getLogs(appDeploymentUri, from,null, logs => logs.forEach(formatLogRecord));
            await uuLogStore.getLogs(appDeploymentUris[0], from, to, criteria, (logs) => this._printLogs(logs.filter(filterFn), appsFormat, options.codec, options.format));
        }
    }

    _getLogFile(output, app) {
        let uesUri = UESUri.parse(app.appDeploymentUri);
        let filename = `${uesUri.object.code || ""}-${uesUri.object.id}.log`;
        let file = path.resolve(output, filename);
        return file;
    }

    _storeLogs(output, app, appsFormat, codec, format, logs) {
        let uesUri = UESUri.parse(app.appDeploymentUri);
        let file = this._getLogFile(output, app);
        console.error(`Storing ${logs.length} for app ${uesUri.object.code} into file ${file}`);
        fs.appendFileSync(file, logs.map(logRecord => this._formatLogRecordForFile(logRecord, appsFormat, codec, format)).join("\n").trim(), "utf8");
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
        return this._formatLogRecordInternal(r, appsFormat, {
            withColour: true, defaultFormat: DEFAULT_LOG_FILE_FORMAT, format, codec
        });
    }

    _formatLogRecord(r, apps, codec, format) {
        return this._formatLogRecordInternal(r, apps, {
            withColour: true, defaultFormat: DEFAULT_LOG_FORMAT, format, codec
        });
    }

    _formatLogRecordInternal(r, apps, {withColour, format, defaultFormat, codec}) {
        if (codec === "json") {
            return JSON.stringify(r, null, 2) + ",";
        }
        if (codec === "jsonstream") {
            return JSON.stringify(r, null, 0);
        }
        let context = {
            _appsFormat: apps, withColour, log: r
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
