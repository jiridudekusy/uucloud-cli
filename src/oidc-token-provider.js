const OidcToken = require("uu_appg01_core-npm/src/scripts/uu_cloud/oidc-token");
const homedir = require("os").homedir();
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const {promisify} = require('util');
const read = promisify(require("read"));
const secureStore = require("oidc-plus4u-vault/lib/securestore");

let oidcTokenCache;

class OidcTokenProvider {
  async getToken(options) {
    if(oidcTokenCache){
      return oidcTokenCache;
    }
    let mode;
    if(options){
      mode = options.authentication;
    }
    if (!mode) {
      mode = "browser";
    }
    let workDir = path.join(homedir, ".uucloud-cli", "work");
    if (!fs.existsSync(workDir)) {
      mkdirp.sync(workDir);
    }
    let oidcToken = new OidcToken(path.join(homedir, ".uucloud-cli", "work"));
    if (mode === "interactive") {
      let login = false;
      while(!login) {
        let ac1 = await read({prompt: `Access code 1 for ${options.user} : `, silent: true});
        let ac2 = await read({prompt: `Access code 2 for ${options.user} : `, silent: true});
        login = await oidcToken._login(ac1, ac2);
        if(!login){
          console.error("Login not successful.");
        }else{
          console.error("Login successful.");
        }
      }
    } else if(mode === "vault"){
      if(!secureStore.exists()){
        console.error("oidc-plus4u-vault does not exists.");
        process.exit(3);
      }
      let password = await read({prompt: `Secure store password : `, silent: true});
      let secureStoreContent;
      try {
         secureStoreContent = secureStore.read(password);
      } catch (e) {
        console.error("oidc-plus4u-vault cannot be read nand decrypted. Probably invalid password or malformed file.");
        process.exit(4);
      }
      if(!secureStoreContent[options.user]){
        console.error(`oidc-plus4u-vault does not contains credentials for user ${options.user}`);
        process.exit(4);
      }
      let login = await oidcToken._login(secureStoreContent[options.user].ac1, secureStoreContent[options.user].ac2);
      if(!login){
        console.error(`Login not successful. oidc-plus4u-vault probably contains credentials for user ${options.user}`);
        process.exit(4)
      }else{
        console.error("Login successful.");
      }
    }
    oidcTokenCache = oidcToken;
    return oidcToken;
  }
}

module.exports = OidcTokenProvider;