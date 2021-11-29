const OidcToken = require("uu_appg01_devkit-common/src/scripts/oidc-token");
const BasicAuth = require("uu_appg01_devkit-common/src/scripts/basic-auth");
const homedir = require("os").homedir();
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const {promisify} = require('util');
const read = promisify(require("read"));
const secureStore = require("oidc-plus4u-vault/lib/securestore");
const propertiesReader = require("properties-reader");

let oidcTokenCache;

class CustomOidcToken extends OidcToken {
  async refresh() {
    if (this.token) {
      let tokenToVerify = this.token.substr("Bearer ".length);
      if ((await this._verifyTokenExpiration(tokenToVerify))) {
        return this.token;
      }
    }
    if (this.token || !(await this._loadTokenFromFile())) {
      console.error("Auth: refresh token.");
      if (this._ac1) {
        console.error("Auth: refresh token using access codes.");
        await this._login(this._ac1, this._ac2)
      } else {
        await this._interactiveLogin();
      }
    }
    return this.token;
  }

  async _login(accessCode1, accessCode2) {
    let res = super._login(accessCode1, accessCode2);
    if (res) {
      this._ac1 = accessCode1;
      this._ac2 = accessCode2;
    }
    return res;
  }
}

class CustomBasicAuth extends BasicAuth {
  async _login(ac1, ac2) {
    let token = Buffer.from(ac1 + ":" + ac2).toString('base64');
    this._setToken(token);
    return true;
  }

  async refresh() {
    return this.token;
  }
}

class OidcTokenProvider {
  async getToken(options) {
    if (oidcTokenCache) {
      return oidcTokenCache;
    }
    let mode;
    if (options) {
      mode = options.authentication;
    }
    if (!mode) {
      mode = "browser";
    }
    let type;
    if (options) {
      type = options.authenticationType;
    }
    if (!type) {
      type = "oidc";
    }

    let workDir = path.join(homedir, ".uucloud-cli", "work");
    if (!fs.existsSync(workDir)) {
      mkdirp.sync(workDir);
    }
    let oidcToken;
    if (type === "oidc") {
      oidcToken = new CustomOidcToken(path.join(homedir, ".uucloud-cli", "work"));
    } else {
      oidcToken = new CustomBasicAuth();
    }
    if (mode === "interactive") {
      let login = false;
      while (!login) {
        let ac1 = await read({prompt: `Access code 1 for ${options.user} : `, silent: true, output: process.stderr});
        let ac2 = await read({prompt: `Access code 2 for ${options.user} : `, silent: true, output: process.stderr});
        login = await oidcToken._login(ac1, ac2);
        if (!login) {
          console.error("Login not successful.");
        } else {
          console.error("Login successful.");
        }
      }
    } else if (mode === "vault") {
      if (!secureStore.exists()) {
        console.error("oidc-plus4u-vault does not exists.");
        process.exit(3);
      }
      let password = await read({prompt: `Secure store password : `, silent: true, output: process.stderr});
      let secureStoreContent;
      try {
        secureStoreContent = secureStore.read(password);
      } catch (e) {
        console.error("oidc-plus4u-vault cannot be read nand decrypted. Probably invalid password or malformed file.");
        process.exit(4);    
      }
      if (!secureStoreContent[options.user]) {
        console.error(`oidc-plus4u-vault does not contains credentials for user ${options.user}`);
        process.exit(4);
      }
      let login = await oidcToken._login(secureStoreContent[options.user].ac1, secureStoreContent[options.user].ac2);
      if (!login) {
        console.error(`Login not successful. oidc-plus4u-vault probably contains invalid credentials for user ${options.user}`);
        process.exit(4);
      } else {
        console.error("Login successful.");
      }
    }else if (mode === "passwordFile") {
      const props = propertiesReader(options.passwordFile, "utf-8"); 
      let ac1 = props.get("accessCode1");
      let ac2 = props.get("accessCode2");
      if(!ac1 || !ac2){
        console.error(`Password file does not contain accessCode1 and/or accessCode2.`);
        process.exit(4)
      }       
      let login = oidcToken._login(ac1, ac2);
      if (!login) {
        console.error("Login not successful.");
        process.exit(4);
      } else {
        console.error("Login successful.");
      }
    }
    oidcTokenCache = oidcToken;
    return oidcToken;
  }
}

module.exports = OidcTokenProvider;
