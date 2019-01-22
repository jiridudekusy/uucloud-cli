const Configstore = require("configstore");
const pkg = require('../../package.json');
const homedir = require("os").homedir();
const path = require("path");
const config = new Configstore(pkg.name, {}, {configPath: path.join(homedir, ".uucloud-cli", "config.json")});

module.exports = config;