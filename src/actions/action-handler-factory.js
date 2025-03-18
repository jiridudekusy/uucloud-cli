const path = require('path');
const fs = require('fs');
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("ActionHandlerFactory");
const BaseActionHandler = require('./base-action-handler');

class ActionHandlerFactory {
  constructor() {
    this._handlerCache = {};
    // Default to project's action handlers directory
    this._customHandlerDirectory = path.join(__dirname, 'custom');
    
    // Also check for user's custom handlers directory
    const homedir = require('os').homedir();
    this._userHandlerDirectory = path.join(homedir, '.uucloud-cli', 'actions');
  }

  /**
   * Get an action handler for a given subapp code
   * 
   * @param {string} subappCode - Code of the subapp
   * @param {object} opts - Options to pass to the handler
   * @returns {BaseActionHandler} - Action handler instance
   */
  getHandler(subappCode, opts) {
    // Return from cache if exists
    if (this._handlerCache[subappCode]) {
      return this._handlerCache[subappCode];
    }

    // Try to load custom handler
    const normalizedCode = this._normalizeCode(subappCode);
    let handler = this._tryLoadHandler(normalizedCode, opts);
    
    // If no custom handler, use base handler
    if (!handler) {
      logger.debug(`No custom handler found for ${subappCode}, using base handler`);
      handler = new BaseActionHandler(opts);
    }

    // Cache the handler
    this._handlerCache[subappCode] = handler;
    return handler;
  }

  /**
   * Normalize a subapp code to make it usable as a filename
   * 
   * @param {string} code - Code of the subapp
   * @returns {string} - Normalized code for file naming
   */
  _normalizeCode(code) {
    // Remove any version suffix (e.g., -1.0.0)
    code = code.replace(/-\d+(\.\d+)*$/, '');
    
    // Replace special characters with dashes
    return code.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Try to load a custom handler from disk
   * 
   * @param {string} normalizedCode - Normalized subapp code
   * @param {object} opts - Options to pass to the handler
   * @returns {BaseActionHandler|null} - Action handler instance or null if not found
   */
  _tryLoadHandler(normalizedCode, opts) {
    // Check project's action handlers directory
    let handlerPath = path.join(this._customHandlerDirectory, `${normalizedCode}-handler.js`);
    
    if (fs.existsSync(handlerPath)) {
      try {
        const HandlerClass = require(handlerPath);
        logger.info(`Loaded custom handler from ${handlerPath}`);
        return new HandlerClass(opts);
      } catch (error) {
        logger.error(`Error loading handler from ${handlerPath}:`, error);
      }
    }
    
    // Check user's custom handlers directory
    handlerPath = path.join(this._userHandlerDirectory, `${normalizedCode}-handler.js`);
    
    if (fs.existsSync(handlerPath)) {
      try {
        const HandlerClass = require(handlerPath);
        logger.info(`Loaded custom handler from user directory: ${handlerPath}`);
        return new HandlerClass(opts);
      } catch (error) {
        logger.error(`Error loading handler from ${handlerPath}:`, error);
      }
    }
    
    return null;
  }
}

module.exports = new ActionHandlerFactory(); // Export a singleton instance