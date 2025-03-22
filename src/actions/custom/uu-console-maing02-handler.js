const BaseActionHandler = require('../base-action-handler');
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("ConsoleHandler");
const { searchPrompt } = require("../../misc/prompt-utils");
const ConsoleClient = require("../../platform/console-client");
const fs = require('fs');
const path = require('path');
const os = require('os');

class ConsoleMainG02Handler extends BaseActionHandler {
  constructor(opts) {
    super(opts);
    
    // Add custom console actions using the new dynamic action structure
    this.addAppSpecificAction({
      name: "Show console",
      value: "showConsole",
      isAvailable: async (subAppDeployment, context = {}) => {
        // Always make console available for now - more reliable
        return true;
      },
      execute: this.showConsole.bind(this)
    });
  }

  // We don't need to override processAction anymore as the base class can handle it

  async showConsole(subAppDeployment, context = {}) {
    logger.info('Opening console');
    
    // Get the awid
    const awid = await this.getAwid(subAppDeployment);
    const oidcToken = await this.getAppDeploymentOidcToken(subAppDeployment);

    // Use ConsoleClient to list consoles
    const consoleClient = new ConsoleClient({ consoleUri: awid.awidUri, oidcToken });
    const result = await consoleClient.listConsoles();
    const consoles = result.itemList;
    
    // Let user choose a console if there are multiple
    let selectedConsole;
    if (consoles.length === 1) {
      selectedConsole = consoles[0];
    } else {
      const consoleOptions = consoles.map(console => ({
        name: `${console.name} (${console.code})`,
        value: console
      }));
      selectedConsole = await searchPrompt("Select console:", consoleOptions);
    }

    // Open the console in browser using the base handler helper
    const consoleUrl = `${awid.awidUri}/console?consoleCode=${selectedConsole.code}`;
    await this.openInBrowser(consoleUrl, 'Console');
  }
}

module.exports = ConsoleMainG02Handler;