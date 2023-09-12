const commandLineUsage = require("command-line-usage");
const commandLineArgs = require("command-line-args");
const Config = require("../misc/config");

class TaskUtils {

  constructor(optionsDefinition, help){
    this._optionsDefinition = optionsDefinition;
    this._help = help;
  }

  parseCliArguments(cliArgs) {
    let options = commandLineArgs(this._optionsDefinition, {argv: cliArgs});
    if (options.help) {
      this.printHelpAndExit();
    }
    return options;
  }

  mergeWithConfig(options, present){
    let res;
    if(present) {
      let presentClone = Object.assign({}, present);
      delete presentClone.mocks;
      res = Object.assign(presentClone, options);
    } else {
      let cfgClone = Object.assign({}, Config.all);
      delete cfgClone.presents;
      res = Object.assign(cfgClone, options);
    }
    if (!Array.isArray(res.resourcePool)) {
      res.resourcePool = [res.resourcePool];
    }
    return res;
  }

  printHelpAndExit(exitCode = 0, full = true) {
    let usage;
    if(full){
      usage = commandLineUsage(this._help);
    } else {
      usage = `Run command with -help to get all options.`;
    }
    console.error(usage);
    process.exit(exitCode);
  }

  testOption(test, errorMessage){
    if(!test){
      this.printOtionsErrorAndExit(errorMessage, false);
    }
  }

  printOtionsErrorAndExit(errorMessage, full = false){
    console.error(errorMessage);
    this.printHelpAndExit(2, full);
  }

  loadPresent(options){
    if(options.present){
      if(Config.all.presents && Config.all.presents[options.present]){
        return Config.all.presents[options.present];
      }
      this.printOtionsErrorAndExit(`Present "${options.present}" has not been found`);
    }
    return null;
  }
}

module.exports = TaskUtils;