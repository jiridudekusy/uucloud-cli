const BaseActionHandler = require('../base-action-handler');
const { LoggerFactory } = require("uu_appg01_core-logging");
const logger = LoggerFactory.get("DemoAppHandler");
const { searchPrompt } = require("../../misc/prompt-utils");

/**
 * Custom handler for uu-demoappg01
 * This demonstrates how to extend the base handler with app-specific actions
 */
class DemoAppHandler extends BaseActionHandler {
  constructor(opts) {
    super(opts);
    
    // Add custom actions to the menu
    this._actionMenu.push(
      {
        name: "Generate test data",
        value: "generateTestData" 
      },
      {
        name: "Cleanup database",
        value: "cleanupDatabase"
      }
    );
  }

  // Override processAction to handle custom actions
  async processAction(action, options, selectedSubapp, subAppDeployment, deployList) {
    if (action === 'generateTestData') {
      await this.generateTestData(options, selectedSubapp, subAppDeployment, deployList);
    } else if (action === 'cleanupDatabase') {
      await this.cleanupDatabase(options, selectedSubapp, subAppDeployment, deployList);
    } else {
      // Call the base class for standard actions
      await super.processAction(action, options, selectedSubapp, subAppDeployment, deployList);
    }
  }

  // Custom action implementation
  async generateTestData(options, selectedSubapp, subAppDeployment, deployList) {
    logger.info('Generating test data for Demo App');
    
    // Get the awid
    const awid = await this.getAwid(options, selectedSubapp, subAppDeployment, deployList);
    const oidcToken = await this.getAppDeploymentOidcToken(subAppDeployment);
    
    // Example of using searchPrompt to get user input for test data options
    const dataOptions = [
      { name: "Small dataset (10 records)", value: "small" },
      { name: "Medium dataset (100 records)", value: "medium" },
      { name: "Large dataset (1000 records)", value: "large" }
    ];
    
    const dataSize = await searchPrompt("Select test data size:", dataOptions);
    
    console.log('Generating test data for Demo App...');
    console.log(`App URL: ${awid.awidUri}`);
    console.log(`Selected data size: ${dataSize}`);
    console.log('This is a custom action for the Demo App that would generate test data');
    
    // In a real implementation, you might call a server API to generate test data
    console.log('Test data generation completed');
  }

  // Another custom action implementation
  async cleanupDatabase(options, selectedSubapp, subAppDeployment, deployList) {
    logger.info('Cleaning up database for Demo App');
    
    // Get the awid
    const awid = await this.getAwid(options, selectedSubapp, subAppDeployment, deployList);
    
    console.log('Cleaning up database for Demo App...');
    console.log(`App URL: ${awid.awidUri}`);
    console.log('This is a custom action for the Demo App that would clean up the database');
    
    // In a real implementation, you might call a server API to clean up the database
    console.log('Database cleanup completed');
  }
}

module.exports = DemoAppHandler;