/**
 * Configuration helper
 * Replicated from uu_appg01_devkit-common/src/scripts/misc/config-helper
 */
let Config = null;
try {
  Config = require("uu_appg01_core-utils").Config;
} catch (e) {
}

class ConfigHelper {
  static getConfigParam(key) {
    if (Config) {
      return Config.get(key);
    } else {
      let value = process.env[key.toUpperCase()] || process.env[key.toLowerCase()];
      let serverCfg;
      if (value == null && (serverCfg = process.env["SERVER_CFG"])) {
        value = JSON.parse(serverCfg)[key];
      }
      return value;
    }
  }
}

module.exports = ConfigHelper;
