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
    if(present) {
      let presentClone = Object.assign({}, present);
      delete presentClone.mocks;
      return Object.assign(presentClone, options);
    } else {
      let cfgClone = Object.assign({}, Config.all);
      delete cfgClone.presents;
      return Object.assign(cfgClone, options);
    }
  }

  printHelpAndExit(exitCode = 0) {
    let usage = commandLineUsage(this._help);
    console.log(usage);
    process.exit(exitCode);
  }

  testOption(test, errorMessage){
    if(!test){
      this.printOtionsErrorAndExit(errorMessage);
    }
  }

  printOtionsErrorAndExit(errorMessage){
    console.error(errorMessage);
    this.printHelpAndExit(2);
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