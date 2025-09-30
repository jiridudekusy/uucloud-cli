/**
 * App Client
 * Replicated from uu_appg01_core-npm/src/scripts/uu_cloud/misc/app-client
 */
const Got = require("got");
const ConfigHelper = require("../devkit/config-helper.js");

const RETRY_LIMIT = 3;
const DEFAULT_HEADERS = {
  "Accept": "application/json"
};

const DEFAULT_OS8_BASE_URI = 'https://api.plus4u.net/ues/wcp';
const DEFAULT_C3_BASE_URI = 'https://sys.plus4u.net';
const DEFAULT_LOGSTORE_BASE_URI = 'https://cmd.plus4u.net';

class AppClient {
  constructor(token) {
    this.token = token;
    this.os8BaseUri = ConfigHelper.getConfigParam('uu_os8_server_uri') || DEFAULT_OS8_BASE_URI;
    this.c3BaseUri =  ConfigHelper.getConfigParam('uu_c3_server_uri') || DEFAULT_C3_BASE_URI;
    this.logstoreBaseUri =  ConfigHelper.getConfigParam('uu_logstore_server_uri') || DEFAULT_LOGSTORE_BASE_URI;
  }

  async exchange(url, method, params, headers = DEFAULT_HEADERS, tryNumber = 0) {
    headers["Authorization"] = await this.token.get();

    let result;
    try {
      result = await Got(url, {
        headers: headers,
        method: method,
        body: params
      });
    } catch (e) {
      if (tryNumber > RETRY_LIMIT) {
        throw new Error("AppClient error:" + this._transformError(e));
      }

      if (e.statusCode == 401 || (e.response && e.response.body.toString().indexOf("UU.OS.APPLICATION/E003-NOT_AUTHENTICATED") > 0)) {
        headers["Authorization"] = await this.token.refresh();
        return await this.exchange(url, method, params, headers, ++tryNumber);
      } else if (e.response && e.response.body.toString().indexOf("UU.OS/E05R03.M05") > 0) {
        return await this.exchange(url, method, params, headers, ++tryNumber);
      } else {
        throw this._transformError(e);
      }
    }

    return result;
  }

  _transformError(e) {
    try {
      let attrs = JSON.parse(e.response.body);
      e.code = attrs.code;
      e.msg = attrs.message || attrs.errorMessages[0].localizedMessage;
      e.message = `\nERROR_CODE: ${e.code}\nMESSAGE: ${e.msg}\nERROR_ATTRS: ${JSON.stringify(e)}`;
    } catch (err) {
      // original error is thrown
    }
    return e;
  }

}

module.exports = AppClient;
