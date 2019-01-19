const OidcToken = require("uu_appg01_core-npm/src/scripts/uu_cloud/oidc-token");
const homedir = require("os").homedir();
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");



class OidcTokenProvider {
  getToken(uuIdentity){
    let workDir = path.join(homedir, ".uucloud-cli","work");
    if(!fs.existsSync(workDir)){
      mkdirp.sync(workDir);
    }
    return new OidcToken(path.join(homedir, ".uucloud-cli","work"));
  }
}

module.exports = OidcTokenProvider;