const commandLineUsage = require("command-line-usage");
const commandLineArgs = require("command-line-args");
const Config = require("../misc/config");

/**
 * Convert camelCase to kebab-case
 * @param {string} str - The camelCase string to convert
 * @returns {string} The kebab-case version
 */
function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 * @param {string} str - The kebab-case string to convert
 * @returns {string} The camelCase version
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Convert any camelCase CLI arguments to kebab-case
 * @param {Array} cliArgs - Command line arguments
 * @returns {Array} - Normalized arguments
 */
function normalizeArguments(cliArgs) {
  return cliArgs.map(arg => {
    if (arg.startsWith('--')) {
      const optionName = arg.substring(2);
      // If it contains uppercase letters (camelCase), convert to kebab-case
      if (/[A-Z]/.test(optionName)) {
        return '--' + camelToKebab(optionName);
      }
    }
    return arg;
  });
}

/**
 * Normalize keys to camelCase
 * @param {object} obj - The object to normalize
 * @returns {object} A new object with camelCase keys
 */
function normalizeToCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const normalized = {};
  
  Object.keys(obj).forEach(key => {
    // Skip non-string keys and special properties
    if (typeof key !== 'string' || key === '_unknown' || key === '_none') {
      normalized[key] = obj[key];
      return;
    }
    
    // Convert kebab-case to camelCase
    if (key.includes('-')) {
      const camelKey = kebabToCamel(key);
      normalized[camelKey] = obj[key];
    } else {
      normalized[key] = obj[key];
    }
  });
  
  return normalized;
}

class TaskUtils {

  constructor(optionsDefinition, help){
    this._optionsDefinition = optionsDefinition;
    this._help = help;
  }

  parseCliArguments(cliArgs) {
    // Normalize any camelCase options in command line to kebab-case
    const normalizedArgs = normalizeArguments(cliArgs);
    
    // Parse arguments using the original option definitions (no duplication)
    let options = commandLineArgs(this._optionsDefinition, {argv: normalizedArgs});
    
    // Convert all kebab-case keys to camelCase for internal use
    options = normalizeToCamelCase(options);
    
    if (options.help) {
      this.printHelpAndExit();
    }
    
    return options;
  }

  mergeWithConfig(options, present) {
    // Options are already in camelCase from parseCliArguments
    
    let res;
    if(present) {
      // Present is already normalized to camelCase by loadPresent
      let presentClone = Object.assign({}, present);
      delete presentClone.mocks;
      res = Object.assign(presentClone, options);
    } else {
      // Normalize config keys to camelCase
      let cfgClone = Object.assign({}, Config.all);
      delete cfgClone.presents;
      
      // Convert any kebab-case keys in config to camelCase
      const normalizedConfig = {};
      Object.keys(cfgClone).forEach(key => {
        if (key.includes('-')) {
          const camelKey = kebabToCamel(key);
          normalizedConfig[camelKey] = cfgClone[key];
        } else {
          normalizedConfig[key] = cfgClone[key];
        }
      });
      
      res = Object.assign(normalizedConfig, options);
    }
    
    // Special handling for resourcePool to ensure it's always an array
    if (res.resourcePool && !Array.isArray(res.resourcePool)) {
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

  loadPresent(options) {
    if(options.present){
      if(Config.all.presents && Config.all.presents[options.present]){
        // Get the preset and normalize its keys to camelCase
        const present = Config.all.presents[options.present];
        // Ensure we normalize from both kebab-case and camelCase to camelCase
        const normalizedPresent = {};
        
        Object.keys(present).forEach(key => {
          if (key.includes('-')) {
            // Convert kebab-case to camelCase
            const camelKey = kebabToCamel(key);
            normalizedPresent[camelKey] = present[key];
          } else {
            // Keep camelCase as is
            normalizedPresent[key] = present[key];
          }
        });
        
        return normalizedPresent;
      }
      this.printOtionsErrorAndExit(`Present "${options.present}" has not been found`);
    }
    return null;
  }
}

// Export helper functions to use elsewhere in the codebase
TaskUtils.camelToKebab = camelToKebab;
TaskUtils.kebabToCamel = kebabToCamel;
TaskUtils.normalizeToCamelCase = normalizeToCamelCase;
TaskUtils.normalizeArguments = normalizeArguments;

module.exports = TaskUtils;