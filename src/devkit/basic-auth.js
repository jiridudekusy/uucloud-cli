/**
 * Basic authentication base class
 * Replicated from uu_appg01_devkit-common/src/scripts/basic-auth
 */
const path = require("path");
const fs = require("fs");
const PropertiesReader = require("properties-reader");

class BasicAuth {
  constructor(basicAuthFile) {
    if (basicAuthFile) {
      this.tokenPath = this._resolveBasicAuthPath(basicAuthFile);
    }
  }

  async refresh() {
    if (this.token || !(await this._loadTokenFromFile())) {
      await this._interactiveLogin();
    }
    return this.token;
  }

  async get() {
    if (this.token == null) {
      await this.refresh();
    }
    return this.token;
  }

  _setToken(token) {
    this.token = "Basic " + token;
    return this.token;
  }

  async _loadTokenFromFile() {
    if (!fs.existsSync(this.tokenPath)) {
      return false;
    }

    let properties = PropertiesReader(this.tokenPath);
    if (properties.get("accessCode1") && properties.get("accessCode2")) {
      let ac1 = properties.get("accessCode1");
      let ac2 = properties.get("accessCode2")
      let token = Buffer.from(ac1 + ":" + ac2).toString('base64');
      this._setToken(token);
      return true;
    }

    return false;
  }

  async _interactiveLogin() {
    console.log("Auth: Starting interactive login process.");
    // TODO
    throw new Error("Password file not provided and interactive login is not implemented for Basic Auth.");
  }

  _resolveBasicAuthPath(basicAuthFile) {
    if (fs.existsSync(basicAuthFile)) {
      return basicAuthFile;
    }

    if (process.env.UU_HOME) {
      let p = path.join(process.env.UU_HOME, basicAuthFile);
      if (fs.existsSync(p)) {
        return p;
      }
    }

    if (process.env.HOME) {
      let p = path.join(process.env.HOME, ".uu", basicAuthFile);
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return basicAuthFile;
  }
}

module.exports = BasicAuth;