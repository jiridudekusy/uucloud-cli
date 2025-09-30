const CmdHelper = require("./cmd-helper.js");
const AppClient = require("./app-client.js");
const DEFAULT_CMD_BASE_PATH = "Log/getRecordList/exec";
const DEFAULT_G02_CMD_BASE_PATH = "log/getRecordList";
const {LoggerFactory} = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("UuLogStore");
const moment = require("moment");
const correctJson = require("../misc/uulogs-json-corrector");

const HEADERS = {
    "Accept": "application/json",
    "Content-type": "application/json"
};

class UuLogStore {

    constructor(config) {
        this._config = config;
        this._appClient = new AppClient(config.oidcToken);
        if (!this._config.logStoreUri) {
            this._config.logStoreUri = this._appClient.logstoreBaseUri + "/uu-logstore/";
        }
        if (!this._config.logStoreUri.endsWith("/")) {
            this._config.logStoreUri += "/";
        }
        if (this._config.logStoreUri.includes("uu-cloudlogstore-maing02")) {
            this._config.logStoreg02 = true;
        }
    }

    _buildExportCmdUri(appDeploymentUri) {
        if (this._config.logStoreg02) {
            return `${this._config.logStoreUri}${DEFAULT_G02_CMD_BASE_PATH}`;
        } else {
            return `${this._config.logStoreUri}${DEFAULT_CMD_BASE_PATH}`;
        }
    }

    async tailLogs(appDeploymentUrisOrApps, criteria, callback) {
        if (appDeploymentUrisOrApps.length > 0 && typeof appDeploymentUrisOrApps[0] === 'string') {
            return this._tailLogsForUris(appDeploymentUrisOrApps, criteria, callback);
        }

        const resourcePoolUris = [];
        const businessTerritoryPromises = [];
        
        for (const app of appDeploymentUrisOrApps) {
            if (app.awscs?.length > 0) {
                const awscsWithLogs = app.awscs.filter(awsc => awsc.logDataUri);
                for (const awsc of awscsWithLogs) {
                    const config = this._createAwscLogStoreConfig(awsc);
                    const btLogStore = new UuLogStore(config);
                    const appCriteria = this._mergeAwscCriteria(criteria, awsc);
                    const deploymentUri = awsc.uuAppWorkspaceUri || app.appDeploymentUri;
                    
                    const tailPromise = btLogStore.tailLogs([deploymentUri], appCriteria, callback);
                    businessTerritoryPromises.push(tailPromise);
                }
            } else {
                resourcePoolUris.push(app.appDeploymentUri);
            }
        }

        if (resourcePoolUris.length > 0) {
            const resourcePoolPromise = this._tailLogsForUris(resourcePoolUris, criteria, callback);
            businessTerritoryPromises.push(resourcePoolPromise);
        }
        
        await Promise.all(businessTerritoryPromises);
    }

    _tailLogsForUris(appDeploymentUris, criteria, callback) {
        let appsToWatch = appDeploymentUris.reduce((acc, appDeploymentUri) => {
            acc[appDeploymentUri] = {
                appDeploymentUri,
                processedIds: {},
                from: new Date(0)
            };
            return acc;
        }, {});
        this._tailLogInternal(appsToWatch, criteria, callback);
    }

    _tailLogInternal(appsToWatch, criteria, callback) {
        let to = new Date();
        let promises = Object.values(appsToWatch).map(app => this._getLogs(app.appDeploymentUri, app.from, to, criteria, app.processedIds));
        Promise.all(promises).then(results => {
            results.forEach(result => {
                let app = appsToWatch[result.appDeploymentUri];
                let newFrom = app.from;
                if (result.logs.length > 0) {
                    newFrom = result.logs[0][criteria.timeWindowType || "timestamp"];
                }
                app.processedIds = result.processedIds;
                app.from = newFrom;
            });
            let logs = results.reduce((acc, result) => acc.concat(result.logs), []);
            logs = logs.sort(this._logRecordsSortFunction)
            callback(logs.reverse());
            setTimeout(() => {
                this._tailLogInternal(appsToWatch, criteria, callback)
            }, 5000);
        });
    }

    async getLogs(appDeploymentUriOrApp, from, to, criteria, callback) {
        if (typeof appDeploymentUriOrApp === 'string') {
            return this._getLogsForUri(appDeploymentUriOrApp, from, to, criteria, callback);
        }
        
        const app = appDeploymentUriOrApp;

        if (app.awscs?.length > 0) {
            const awscsWithLogs = app.awscs.filter(awsc => awsc.logDataUri);
            
            for (const awsc of awscsWithLogs) {
                const config = this._createAwscLogStoreConfig(awsc);
                const btLogStore = new UuLogStore(config);
                
                const appCriteria = this._mergeAwscCriteria(criteria, awsc);
                const deploymentUri = awsc.uuAppWorkspaceUri || app.appDeploymentUri;
                await btLogStore.getLogs(deploymentUri, from, to, appCriteria, callback);
            }
        } else {
            return this._getLogsForUri(app.appDeploymentUri, from, to, criteria, callback);
        }
    }

    async _getLogsForUri(appDeploymentUri, from, to, criteria, callback) {
        let response;
        let result = [];
        let processedIds = {};
        if (from && !to) {
            to = new Date();
        }
        do {
            response = await this._getLogs(appDeploymentUri, from, to, criteria, processedIds);
            processedIds = response.processedIds;
            if (callback) {
                callback(response.logs);
            } else {
                result = result.concat(result, response.logs);
            }
            if (to && response.logs && response.logs.length > 0) {
                to = new Date(response.logs[0][criteria.timeWindowType || "timestamp"]);
                //Hotfix : remove UuC3::Helper::ProgressMonitor logs from calculation of ne "to" timestamp, since it is in wgonr timezone.
                to = response.logs.filter(r => r.logger != "UuC3::Helper::ProgressMonitor").reduce((newTo, r) => {
                    let rTime = new Date(r.time)
                    if (rTime < newTo) {
                        return rTime;
                    }
                    return newTo;
                }, to);
            } else {
                to = null;
            }
        } while ((response.total > 0) && to && to > from);
        return result;
    }

    async _getLogs(appDeploymentUri, from, to, criteria, filterIds) {
        if (from && to) {
            logger.debug(`Fetching log records ${from.toISOString()} - ${to.toISOString()}`);
        }
        let query = new Map();
        from && query.set("from", from.toISOString());
        to && query.set("to", to.toISOString());
        if (criteria) {
            Object.entries(criteria).forEach(([key, value]) => query.set(key, value));
        }
        
        let requestUrl;
        
        if (this._config.useDirectLogDataUri && this._config.directLogDataUri) {
            const logDataUrl = new URL(this._config.directLogDataUri);
            
            if (query.size > 0) {
                query.forEach((value, key) => {
                    logDataUrl.searchParams.set(key, value);
                });
            }
            
            requestUrl = logDataUrl.toString();
        } else {
            let exportCmdUri = this._buildExportCmdUri(appDeploymentUri);
            requestUrl = this._buildCmd2Url(exportCmdUri, appDeploymentUri, query);
        }

        let result = await this._executeCommand(
            requestUrl,
            "get",
            null,
            HEADERS
        );

        let response = JSON.parse(result.body);
        let logs;
        let total;
        if (this._config.logStoreg02) {
            logs = response.itemList;
            logs.forEach(this._fixLogRecordg02);
            total = response.pageInfo.total;
        } else {
            logs = response.pageEntries;
            total = response.totalSize;
        }

        let processedIds = {};
        logs = logs.filter(logRecord => {
            if(!logRecord.id){
                //uuCloudg02 records does not have id
                return true;
            }
            // filter out all records from privous run, also filter out all duplicate records in the results
            let filtered = !filterIds[logRecord.id] && !processedIds[logRecord.id];
            processedIds[logRecord.id] = true;
            return filtered;
        });
        logs = this._correlateLogRecords(logs);
        logs = this._fixLogRecords(logs);
        logs = logs.map(this._transformTimeAttribute).map(logRecord => {
            logRecord.appDeploymentUri = appDeploymentUri;
            return logRecord
        }).sort(this._logRecordsSortFunction);
        return { total, logs, processedIds, appDeploymentUri };
    }

    _buildCmd2Url(url, mainEntity, query = null) {
        let mainPart;
        if (this._config.logStoreg02) {
            if (!mainEntity.startsWith("ues:")) {
                //select logs by asid
                mainPart = `asid=${encodeURIComponent(mainEntity)}`
            } else {
                mainPart = `uuUri=${encodeURIComponent(mainEntity)}`
            }
        } else {
            mainPart = `uuUri=${encodeURIComponent(mainEntity)}`
        }
        url = `${url}?${mainPart}`;
        if (query) {
            query.forEach((value, key) => {
                url = url + `&${key}=${value}`;
            });
        }

        return url;
    }

    /**
     * Tries to fix log records if the message contains invalid JSON.
     * @param logRecords
     * @private
     */
    _fixLogRecords(logRecords) {
        return logRecords.map(logRecord => {
            if (logRecord.recordType === "TRACE_LOG" && !logRecord.logger) {
                let message = logRecord.message;
                message = correctJson(message, "message", "traceId");
                message = correctJson(message, "stackTrace");
                try {
                    let messageObj;
                    //Hotfix for uuCloud@Amprion...message ends with "\n"
                    if (message.endsWith("\\n")) {
                        messageObj = JSON.parse(message.slice(0, -2));
                    } else {
                        messageObj = JSON.parse(message.trim());
                    }
                    Object.assign(logRecord, messageObj);
                } catch (e) {
                }
            }
            return logRecord;
        });
    }

    _transformTimeAttribute(logRecord) {
        logRecord.time = new Date(logRecord.time);
        logRecord.timestamp = new Date(logRecord.timestamp);
        //add timeStamp attribute due to that the dtoIn attribute timeWidowType is using timeStamp instead of timestamp
        logRecord.timeStamp = logRecord.timestamp;
        if (!logRecord.eventTime) {
            logRecord.eventTime = logRecord.time;
        } else if (logRecord.eventTime.startsWith("[")) {
            //tomcat access logs has following format : [18/Jan/2019:09:55:40 +0100]
            try {
                logRecord.eventTime = moment(logRecord.eventTime.replace("[", "").replace("]", ""), "DD/MMM/YYYY:HH:mm:ss Z").toDate();
            } catch (e) {
                logRecord.eventTime = new Date(logRecord.time);
            }
        } else if (logRecord.eventTime.endsWith("Z")) {
            logRecord.eventTime = new Date(logRecord.eventTime);
        } else {
            //logRecord.eventTime format is 2019-01-19T12:10:06,734
            try {
                logRecord.eventTime = moment(logRecord.eventTime, "YYYY-MM-DDTHH:mm:ss,SSSZ").toDate();
            } catch (e) {
                logRecord.eventTime = new Date(logRecord.time);
            }
        }
        return logRecord;
    }

    _fixLogRecordg02(log) {
        const attributesToFix = {
            "log_level": "logLevel",
            "app_version": "appVersion",
            "runtime_stack_code": "runtimeStackCode",
            "app_deployment_uri": "appDeploymentUri",
            "node_image_name": "nodeImageName",
            "node_name": "nodeName",
            "host_name": "hostName",
            "record_type": "recordType",
            "correlation_id": "correlationId"
        }
        Object.keys(attributesToFix).forEach(a => {
            if (log[a] !== undefined) {
                log[attributesToFix[a]] = log[a];
            }
        })
    }

    /**
     * Sort log records using time and eventTime attribute.
     * @param logs records to sort
     * @returns {this} sorted reords
     * @private
     */
    _logRecordsSortFunction(a, b) {
        return b.eventTime - a.eventTime;
    }

    async _executeCommand(url, method, params, headers, tryNumber = 0) {
        try {
            return await this._appClient.exchange(url, method, params, headers);
        } catch (err) {
            if (tryNumber > 10) {
                logger.error(`All retries has failed.`, err);
                throw err;
            }
            logger.warn(`Request failed retrying #${tryNumber + 1}....`)
            // Log API response body for detailed error diagnosis
            // Extract the response body from error objects, which contains valuable debugging information            
            if(err.response && err.response.body){
                let body;
                try {
                    // Parse and format JSON response bodies to make error messages more readable            
                    body = JSON.stringify(JSON.parse(err.response.body), null, 2);
                } catch (e) {
                    body = err.response.body;
                }
                logger.debug(`Response body ${body  }`)
            }
            return await this._executeCommand(url, method, params, headers, ++tryNumber);
        }
    }

    _correlateLogRecords(logs) {
        let msgCorrelations = {};

        //put correlated records into single record, pass through not correlated records
        let resultLogs = logs.reduce((acc, logRecord) => {
            if (!logRecord.correlationId) {
                acc.push({type: "STANDARD", value: logRecord});
            } else {
                let [correlationId, index] = logRecord.correlationId.split("-");
                if (!msgCorrelations[correlationId]) {
                    msgCorrelations[correlationId] = {};
                    acc.push({type: "CORRELATED", value: msgCorrelations[correlationId]});
                }
                msgCorrelations[correlationId][index] = logRecord;
            }
            return acc;
        }, []);

        //merge correlated records together
        resultLogs = resultLogs.map(logRecord => {
            if (logRecord.type === "STANDARD") {
                return logRecord.value;
            } else {
                let correlatedLogRecord = Object.keys(logRecord.value).sort().map(key => logRecord.value[key]).reduce((acc, logRecordPart) => {
                    acc.message += logRecordPart.message;
                    return acc;
                });
                try {
                    let correlatedLogRecordSource = this._parseJson(correlatedLogRecord.message);
                    correlatedLogRecord = Object.assign(correlatedLogRecord, correlatedLogRecordSource);
                } catch (e) {
                    correlatedLogRecord.message = "This correlated record is probably not complete, or its message is not valid JSON : " + correlatedLogRecord.message;
                }
                return correlatedLogRecord;
            }
        });
        return resultLogs;
    }

    _parseJson(message) {
        try {
            return JSON.parse(message);
        } catch (e) {
            message = correctJson(message, "message", "traceId");
            message = correctJson(message, "stackTrace");
            message = message.replace(/\n/g, "\\n");
            return JSON.parse(message);
        }
    }

    /**
     * Create log store configuration for business territory AWSC
     * @param {Object} awsc - AWSC object with log configuration
     * @returns {Object} - Log store configuration
     * @private
     */
    _createAwscLogStoreConfig(awsc) {
        // Use the existing configuration as base and only override what's needed
        return {
            ...this._config,
            useDirectLogDataUri: true,
            directLogDataUri: awsc.logDataUri
        };
    }

    /**
     * Merge base criteria with AWSC-specific criteria
     * @param {Object} baseCriteria - Base filter criteria
     * @param {Object} awsc - AWSC object with log criteria
     * @returns {Object} - Merged criteria
     * @private
     */
    _mergeAwscCriteria(baseCriteria, awsc) {
        const appCriteria = {...baseCriteria};
        if (awsc.logCriteria) {
            Object.assign(appCriteria, awsc.logCriteria);
        }
        return appCriteria;
    }

}

module.exports = UuLogStore;
