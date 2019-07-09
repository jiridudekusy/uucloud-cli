const uuidv4 = require("uuid/v4");
const fs = require("fs-extra");
const path = require("path");
const homedir = require("os").homedir();

class Utils {
  static createTempDir(name) {
    if (!name) {
      name = uuidv4();
    }
    let tmpkDir = path.join(homedir, ".uucloud-cli", "tmp", name);
    fs.mkdirpSync(tmpkDir);
    return tmpkDir;
  }
}

module.exports = Utils;