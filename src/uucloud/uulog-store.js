const CmdHelper = require("uu_appg01_core-npm/src/scripts/uu_cloud/misc/cmd-helper.js");
const AppClient = require("uu_appg01_core-npm/src/scripts/uu_cloud/misc/app-client.js");
const dateUtils = require("date-and-time");
const DEFAULT_CMD_BASE_PATH = "uu-logstore/Log/getRecordList/exec";
const {LoggerFactory} = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("UuLogStore");
const moment = require("moment");

const HEADERS = {
  "Accept": "application/json",
  "Content-type": "application/json"
};

class UuLogStore {

  constructor(config) {
    this._config = config;
    this._appClient = new AppClient(config.oidcToken);
  }

  _buildExportCmdUri(appDeploymentUri) {
    return `${this._appClient.logstoreBaseUri}/${DEFAULT_CMD_BASE_PATH}`
  }

  async tailLogs(appDeploymentUris, callback) {
    let appsToWatch = appDeploymentUris.reduce((acc, appDeploymentUri) => {
      acc[appDeploymentUri] = {
        appDeploymentUri,
        processedIds: {},
        from: new Date(0)
      };
      return acc;
    }, {});
    this._tailLogInternal(appsToWatch, callback);
  }

  _tailLogInternal(appsToWatch, callback) {
    let to = new Date();
    let promises = Object.values(appsToWatch).map(app => this._getLogs(app.appDeploymentUri, app.from, to, app.processedIds));
    Promise.all(promises).then(results => {
      results.forEach(result => {
        let app = appsToWatch[result.appDeploymentUri];
        let newFrom = app.from;
        if (result.logs.length > 0) {
          newFrom = result.logs[0].time;
        }
        app.processedIds = result.processedIds;
        app.from = newFrom;
      });
      let logs = results.reduce((acc, result) => acc.concat(result.logs), []);
      logs = logs.sort(this._logRecordsSortFunction)
      callback(logs.reverse());
      setTimeout(() => {
        this._tailLogInternal(appsToWatch, callback)
      }, 5000);
    });
  }

  async getLogs(appDeploymentUri, from, to, callback) {
    let response;
    let result = [];
    let processedIds = {};
    if (from && !to) {
      to = new Date();
    }
    do {
      response = await this._getLogs(appDeploymentUri, from, to, processedIds);
      processedIds = response.processedIds;
      if (callback) {
        callback(response.logs);
      } else {
        result = result.concat(result, response.logs);
      }
      if (to && response.logs && response.logs.length > 0) {
        to = new Date(response.logs[0].time);
      }
    } while (response.totalSize === 2000 && to);
    return result;
  }

  async _getLogs(appDeploymentUri, from, to, filterIds) {
    if (from && to) {
      logger.debug(`Fetching log records ${from} - ${to}`);
    }
    let query = new Map();
    from && query.set("from", from.toISOString());
    to && query.set("to", to.toISOString());
    let exportCmdUri = this._buildExportCmdUri(appDeploymentUri);

    let result = await this._executeCommand(
        CmdHelper.buildCmd2Url(exportCmdUri, appDeploymentUri, query),
        "get",
        null,
        HEADERS
    );

    let response = JSON.parse(result.body);
    let logs = response.pageEntries;
    let processedIds = {};
    logs = logs.filter(logRecord => {
      // filter out all records from privous run, also filter out all duplicate records in the results
      let filtered = !filterIds[logRecord.id] && !processedIds[logRecord.id];
      processedIds[logRecord.id] = true;
      return filtered;
    });
    logs = this._correlateLogRecords(logs);
    logs = logs.map(this._transformTimeAttribute).map(logRecord => {
      logRecord.appDeploymentUri = appDeploymentUri;
      return logRecord
    }).sort(this._logRecordsSortFunction);
    return {totalSize: response.totalSize, logs, processedIds, appDeploymentUri};
  }

  _transformTimeAttribute(logRecord) {
    logRecord.time = new Date(logRecord.time);
    if (!logRecord.eventTime) {
      logRecord.eventTime = logRecord.time;
    } else if (logRecord.eventTime.startsWith("[")) {
      //tomcat access logs has following format : [18/Jan/2019:09:55:40 +0100]
      try {
        logRecord.eventTime = moment(logRecord.eventTime.replace("[", "").replace("]", ""), "DD/MMM/YYYY:HH:mm:ss Z").toDate();
      } catch (e) {
        logRecord.eventTime = new Date(logRecord.time);
      }
    } else {
      //logRecord.eventTime format is 2019-01-19T12:10:06,734
      try {
        logRecord.eventTime = moment(logRecord.eventTime, "YYYY-MM-DDTHH:mm:ss,SSS").toDate();
      } catch (e) {
        logRecord.eventTime = new Date(logRecord.time);
      }
    }
    return logRecord;
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
      if (tryNumber > 3) {
        throw err;
      }
      if (err.code === "UU.LOGSTORE/E010-NOT_AUTHORIZED") {
        return await this._executeCommand(url, method, params, headers, tryNumber++);
      }
      throw err;
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
          let correlatedLogRecordSource = JSON.parse(correlatedLogRecord.message);
          correlatedLogRecord = Object.assign(correlatedLogRecord, correlatedLogRecordSource);
          correlatedLogRecord.message += correlatedLogRecord.stackTrace;
        } catch (e) {
          correlatedLogRecord.message = "This correlated record is probably not complete, or its message is not valid JSON : " + correlatedLogRecord.message;
        }
        return correlatedLogRecord;
      }
    });
    return resultLogs;
  }

}

module.exports = UuLogStore;