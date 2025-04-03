const Command = require('../interfaces/Command');
const dateUtils = require('date-and-time');
const chalk = require('chalk');
const UESUri = require("../misc/ues-uri");
const parseRelativeDateTime = require("../misc/relative-date-parser");
const {
    commonOptionsDefinitionsWithPresentAndApps, verifyCommonOptionsDefinitionsWithPresent
} = require("../misc/common-tasks-option");
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
        return options.data.root._appsFormat[appDeploymentUri].fomattedCode;
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

// Use triple braces {{{ }}} for log messages to preserve special characters and formatting
const DEFAULT_LOG_FORMAT = `{{subAppCode log.appDeploymentUri}} {{date log.eventTime 'YYYY-MM-DD HH:mm:ss,SSS'}} {{log.recordType}} [{{log.threadName}}] {{logLevel log.logLevel}} {{log.logger}} - {{{log.message}}} {{log.stackTrace}}`;
const DEFAULT_LOG_FILE_FORMAT = `{{date log.eventTime "YYYY-MM-DD HH:mm:ss,SSS"}} {{log.recordType}} [{{log.threadName}}] {{logLevel log.logLevel}} {{log.logger}} - {{{log.message}}} {{log.stackTrace}}`;

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
}, {
    name: "color",
    type: String,
    description: "Control color output: \"auto\" (default, colorize output when stdout is a terminal), \"always\" (always use colors, even when piped), or \"never\" (never use colors).",
    defaultValue: "auto"
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
when you have no access list deployed applications in uuCloud resourcePool or when you are using uuCloudg02.
(uuCloudg02 is not yet integrated into uucloud-cli)
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

    Please note that filtering is not function of uuLogStore, but it is done on your machine. This means that if you are trying to find one specific record
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
    }, {
        example: escapeChalk(String.raw`uucloud logs -f --color=always ues:ABC:DEF:GHI | tee application-logs.txt`),
        description: "Follow logs and preserve colors even when piping to another command like tee."
    }]
}, {
    header: "How does apps selection work ?", content: `Apps selection works using 4 mechanisms. You can combine all of them together.
              1) {bold Specify uuAppDeploymentUri}
              In this mode you identify uuApps by specifying their full deployment uri. You can obtain the uri from deployment configuration of the application. Only this mode works with -n.
              2) {bold Specify asid or part of it}
              This mode works very similar to docker command but instead of container id you are using asid. You can find asid in output of uucloud ps. It is not required to specify full asid. It is enough to write just few starting characters.
              3) {bold Specify uuSubApp code or part of it}
              This is the comfortable way how to specify uuApps if you don't use tags. You can find uuSubApp code in output of uucloud ps. It is not required to specify full code. It is enough to write just any part of it. It even works in similar way to tags so comma means and, space means or.
              4) {bold Specify tags}
              This is the most comfortable way how to specify uuApps, but it requires changes in deployment configuration. Any app can have in ints deployment configuration following property :
              tags:"<tag1>,<tag2>,<tag3>"

              Any number of tags can be specified, however thay have to be alphanumeric and separated by comma.

              In uucloud ps you can see tags assigned to the application and you can use them to query the logs using following principles.
              * comma means and
              * space means or

              {underline Examples}:
              {bold dev1} = All uuApps in resource pool with tag dev1.
              {bold dev1 dev2} = All uuApps in resource pool with tag dev1 OR dev2.
              {bold dev1,odm dev1,control} = All uuApps in resource pool with tags (dev1 AND odm) OR (dev1 AND control).`
},];

/**
 * Command implementation for the 'logs' command
 */
class LogsCommand extends Command {
    /**
     * Create a new LogsCommand instance
     * @param {Object} dependencies - Injected dependencies
     */
    constructor(dependencies) {
        super(dependencies);
        
        // Extract dependencies
        this._tokenProvider = dependencies.tokenProvider;
        this._serviceFactory = dependencies.serviceFactory;
        this._console = dependencies.console;
        this._taskUtils = dependencies.taskUtils;
    }
    
    /**
     * Execute the logs command
     * @param {Array} args - Command line arguments
     * @returns {Promise<void>}
     */
    async execute(args) {
        try {
            let options;
            if (typeof args === 'object' && !Array.isArray(args) && args !== null) {
                // If args is an object (not an array), it's already parsed options
                options = args;
            } else {
                // Otherwise, parse the command line arguments
                options = this._taskUtils.parseCliArguments(args);
            }
            
            verifyCommonOptionsDefinitionsWithPresent(options, this._taskUtils);
            
            let present = this._taskUtils.loadPresent(options);
            options = this._taskUtils.mergeWithConfig(options, present);
            
            // Determine color mode based on options
            const shouldForceColor = options.color === "always";
            const shouldNeverColor = options.color === "never";
            
            // Set color level based on options
            if (shouldForceColor) {
                chalk.level = 2; // Force color level to 2 (full 256 colors)
            } else if (shouldNeverColor) {
                chalk.level = 0; // Disable colors completely
            }
            
            let filterFn = () => true;
            if (options.filter) {
                try {
                    let expression = compileExpression(options.filter);
                    filterFn = (log) => expression(log);
                } catch (e) {
                    throw new Error("Cannot parse filter expression: " + e.message);
                }
            }
    
            let criteria = {};
            if (options.criteria) {
                options.criteria.forEach(criterion => {
                    let parts = criterion.split(":");
                    if (parts.length != 2) {
                        throw new Error(`Invalid criterion ${criterion}. Format should be [key]:[value]`);
                    }
                    criteria[parts[0]] = parts[1];
                });
            }
    
            let apps;
            if (options.apps) {
                if (options["disable-resolving"]) {
                    apps = this._getAppsFromParams(options.apps);
                } else {
                    apps = await this._getAppsFromAppDeploymentList(options.apps, options.resourcePool, options, present);
                }
            } else {
                this._taskUtils.printOtionsErrorAndExit("At least one app must be specified.");
            }
    
            if (options.follow) {
                this._taskUtils.testOption(!options.since, "Follow cannot be used with since.");
                this._taskUtils.testOption(!options.until, "Follow cannot be used with until.");
                this._taskUtils.testOption(!options.output, "Follow cannot be used with output.");
                await this._followLog(apps, filterFn, criteria, options);
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
                    this._console.error(`Getting logs since : ${from.toISOString()} until: ${to.toISOString()}`);
                }
                this._console.error(apps.map(app => `Getting logs for application ${app.code}:` + app.appDeploymentUri).join("\n"));
                if (!options.output) {
                    this._taskUtils.testOption(apps.length === 1, "You can follow logs up to 10 applications, but you can list history logs only for 1.");
                }
                await this._getLog(apps, from, to, filterFn, criteria, options);
            }
        } catch (error) {
            this._console.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get applications from app deployment list
     * @param {Array} appsIdentifiers - App identifiers
     * @param {string} resourcePoolUri - Resource pool URI
     * @param {Object} options - Command options
     * @param {Object} present - Present configuration
     * @returns {Promise<Array>} - List of applications
     * @private
     */
    async _getAppsFromAppDeploymentList(appsIdentifiers, resourcePoolUri, options, present) {
        let deployList;
        if (present && present.mocks && present.mocks.getAppDeploymentList) {
            deployList = present.mocks.getAppDeploymentList;
        } else {
            const oidcToken = await this._tokenProvider.getToken(options);
            const uuCloud = this._serviceFactory('CloudClient', oidcToken, options);
            deployList = await uuCloud.getAppDeploymentList(resourcePoolUri);
        }
        
        let filteredApps = filterAppDeployments(deployList, appsIdentifiers);
        
        let apps = filteredApps.map(app => {
            return {
                code: app.code,
                appDeploymentUri: app.uri || app.asid,
                asid: app.asid
            };
        });
        
        return apps;
    }

    /**
     * Get applications from parameters
     * @param {Array} appsIdentifiers - App identifiers
     * @returns {Array} - List of applications
     * @private
     */
    _getAppsFromParams(appsIdentifiers) {
        return appsIdentifiers.map(appIdentifier => {
            if (appIdentifier.match(/[0-9a-f]{32}/)) {
                return {
                    code: "UNKNOWN",
                    appDeploymentUri: appIdentifier
                };
            } else {
                try {
                    let uesUri = UESUri.parse(appIdentifier);
                    if (!uesUri || (!uesUri.object.id && !uesUri.object.code)) {
                        this._taskUtils.printOtionsErrorAndExit(`"${appIdentifier}" is not valid deployment uri or asid.`, false);
                    }
                    let code = uesUri.object.code;
                    if (!code) {
                        code = appIdentifier;
                    }
                    return {
                        code, 
                        appDeploymentUri: appIdentifier
                    };
                } catch (e) {
                    // If URI parsing fails, just use the identifier as is
                    return {
                        code: appIdentifier,
                        appDeploymentUri: appIdentifier
                    };
                }
            }
        });
    }

    /**
     * Follow logs in real-time
     * @param {Array} apps - List of applications
     * @param {Function} filterFn - Filter function
     * @param {Object} criteria - Filter criteria
     * @param {Object} options - Command options
     * @returns {Promise<void>}
     * @private
     */
    async _followLog(apps, filterFn, criteria, options) {
        const token = await this._tokenProvider.getToken(options);

        let config = {
            oidcToken: token
        };
        if (options["log-store-uri"]) {
            config.logStoreUri = options["log-store-uri"];
        }
        
        const uuLogStore = this._serviceFactory('LogStore', config);
        const appDeploymentUris = apps.map(app => app.appDeploymentUri);
        
        // Determine color mode based on options
        const useColors = options.color === "always" || 
                          (options.color === "auto" && process.stdout.isTTY);
        
        const appsFormat = this._prepareApplicationFormat(apps, useColors);
        
        await uuLogStore.tailLogs(appDeploymentUris, criteria, (logs) => 
            this._printLogs(logs.filter(filterFn), appsFormat, options.codec, options.format)
        );
    }

    /**
     * Get historical logs
     * @param {Array} apps - List of applications
     * @param {Date} from - Start date
     * @param {Date} to - End date
     * @param {Function} filterFn - Filter function
     * @param {Object} criteria - Filter criteria
     * @param {Object} options - Command options
     * @returns {Promise<void>}
     * @private
     */
    async _getLog(apps, from, to, filterFn, criteria, options) {
        const token = await this._tokenProvider.getToken(options);

        let config = {
            oidcToken: token
        };
        if (options["log-store-uri"]) {
            config.logStoreUri = options["log-store-uri"];
        }
        
        const uuLogStore = this._serviceFactory('LogStore', config);
        
        // Determine color mode based on options
        // For output to file, don't use colors unless explicitly requested with color=always
        // For console output, use colors if output is to a TTY with color=auto or if color=always
        const useColors = options.output ? 
                          options.color === "always" : 
                          (options.color === "always" || 
                           (options.color === "auto" && process.stdout.isTTY));
        
        const appsFormat = this._prepareApplicationFormat(apps, useColors);
        
        if (options.output) {
            await mkdirp(options.output);
            
            for (let app of apps) {
                try {
                    // Handle log file recovery if needed
                    if (options.recover && options.codec == "jsonstream") {
                        let file = this._getLogFile(options.output, app);
                        if (fs.existsSync(file)) {
                            let lastLine = await readLastLines.read(file, 1);
                            let lastRecord = JSON.parse(lastLine);
                            from = new Date(lastRecord.eventTime);
                            this._console.log(`Last record in ${file} is from ${from}, continuing from there.`);
                        }
                    }
                    
                    // Get logs for this app
                    await uuLogStore.getLogs(app.appDeploymentUri, from, to, criteria, 
                        (logs) => this._storeLogs(options.output, app, appsFormat, options.codec, options.format, logs.filter(filterFn))
                    );
                } catch (e) {
                    this._console.error(`Error getting logs for ${app.code}: ${e.message}`);
                }
            }
        } else {
            let appDeploymentUris = apps.map(app => app.appDeploymentUri);
            await uuLogStore.getLogs(appDeploymentUris[0], from, to, criteria, 
                (logs) => this._printLogs(logs.filter(filterFn), appsFormat, options.codec, options.format)
            );
        }
    }

    /**
     * Get log file path
     * @param {string} output - Output directory
     * @param {Object} app - Application
     * @returns {string} - Log file path
     * @private
     */
    _getLogFile(output, app) {
        let filename;
        try {
            let uesUri = UESUri.parse(app.appDeploymentUri);
            filename = `${uesUri.object.code || ""}-${uesUri.object.id}.log`;
        } catch (e) {
            filename = `${app.code || ""}-${app.asid}.log`;
        }
        let file = path.resolve(output, filename);
        return file;
    }

    /**
     * Store logs to file
     * @param {string} output - Output directory
     * @param {Object} app - Application
     * @param {Object} appsFormat - Apps format
     * @param {string} codec - Output codec
     * @param {string} format - Output format
     * @param {Array} logs - Logs to store
     * @private
     */
    _storeLogs(output, app, appsFormat, codec, format, logs) {
        let file = this._getLogFile(output, app);
        this._console.error(`Storing ${logs.length} for app ${app.code} into file ${file}`);
        fs.appendFileSync(file, logs.map(logRecord => this._formatLogRecordForFile(logRecord, appsFormat, codec, format)).join("\n").trim(), "utf8");
    }

    /**
     * Prepare application format
     * @param {Array} apps - List of applications
     * @param {boolean} withColour - Whether to use color
     * @returns {Object} - Apps format
     * @private
     */
    _prepareApplicationFormat(apps, withColour) {
        let maxLength = apps.reduce((acc, app) => app.code ? Math.max(acc, app.code.length) : acc, 0);
        let formattedApps = apps.map((app, index) => {
            let code = app.code || "";
            let formattedCode = code.padEnd(maxLength, " ");
            
            if (withColour) {
                formattedCode = APPLICATION_COLORS[index % APPLICATION_COLORS.length](formattedCode + " |");
            } else {
                formattedCode = formattedCode + " |";
            }
            
            return {
                ...app,
                fomattedCode: formattedCode
            };
        });
        
        // Convert array to object with appDeploymentUri as keys
        return formattedApps.reduce((acc, app) => {
            acc[app.appDeploymentUri] = app;
            return acc;
        }, {});
    }

    /**
     * Format log record for file
     * @param {Object} r - Log record
     * @param {Object} appsFormat - Apps format
     * @param {string} codec - Output codec
     * @param {string} format - Output format
     * @returns {string} - Formatted log record
     * @private
     */
    _formatLogRecordForFile(r, appsFormat, codec, format) {
        return this._formatLogRecordInternal(r, appsFormat, {withColour: false, format, defaultFormat: DEFAULT_LOG_FILE_FORMAT, codec});
    }

    /**
     * Format log record
     * @param {Object} r - Log record
     * @param {Object} apps - Apps
     * @param {string} codec - Output codec
     * @param {string} format - Output format
     * @returns {string} - Formatted log record
     * @private
     */
    _formatLogRecord(r, apps, codec, format) {
        return this._formatLogRecordInternal(r, apps, {withColour: true, format, defaultFormat: DEFAULT_LOG_FORMAT, codec});
    }

    /**
     * Format log record internal implementation
     * @param {Object} r - Log record
     * @param {Object} apps - Apps
     * @param {Object} options - Format options
     * @returns {string} - Formatted log record
     * @private
     */
    _formatLogRecordInternal(r, apps, {withColour, format, defaultFormat, codec}) {
        if (codec === "json") {
            return JSON.stringify(r);
        } else if (codec === "jsonstream") {
            return JSON.stringify(r);
        } else {
            let template = format ? Handlebars.compile(format) : Handlebars.compile(defaultFormat);
            return template({log: r, _appsFormat: apps, withColour});
        }
    }

    /**
     * Print logs to console
     * @param {Array} logs - Logs to print
     * @param {Object} apps - Apps
     * @param {string} codec - Output codec
     * @param {string} format - Output format
     * @private
     */
    _printLogs(logs, apps, codec, format) {
        logs.length > 0 && this._console.log(logs.map(logRecord => this._formatLogRecord(logRecord, apps, codec, format)).join("\n").trim());
    }
}

// Set static properties
LogsCommand.optionsDefinitions = optionsDefinitions;
LogsCommand.help = help;

module.exports = LogsCommand; 