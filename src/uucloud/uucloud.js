const UuCloudDeployListTask = require("uu_appg01_core-npm/src/scripts/uu_cloud/task-deploy-list");
const CmdHelper = require("uu_appg01_core-npm/src/scripts/uu_cloud/misc/cmd-helper.js");
const AppClient = require("uu_appg01_core-npm/src/scripts/uu_cloud/misc/app-client.js");
const { LoggerFactory } = require("uu_appg01_core-logging");
const UESUri = require("../misc/ues-uri");
const { Uri } = require("uu_appg01_core-uri");
const logger = LoggerFactory.get("UuCloud");

const DEPLOY_LIST_URI = "uu-c3/AppDeployment/getAppDeploymentList/exec";
const GET_APP_SHARE_LIST_URI = "uu-c3/AppDeployment/getAppShareList/exec";
const GET_APP_DEPLOYMENT_URI = "uu-c3/AppDeployment/getAppDeployment/exec";

const HEADERS = {
    "Accept": "application/json",
    "Content-type": "application/json"
};

class UuCloud {
    constructor(config = {}) {
        this._config = config || {};
        this._appClient = new AppClient(config.oidcToken || "");
        if (!this._config.c3Uri) {
            this._config.c3Uri = this._appClient.c3BaseUri || "";
        }
        if (this._config.c3Uri && !this._config.c3Uri.endsWith("/")) {
            this._config.c3Uri += "/";
        }
    }

    _buildGetAppDeploymentListCmdUri(appDeploymentUri) {
        return `${this._config.c3Uri}${DEPLOY_LIST_URI}`
    }

    _buildGetAppShareListCmdUri() {
        return `${this._config.c3Uri}${GET_APP_SHARE_LIST_URI}`
    }

    _buildGetAppDeploymentCmdUri() {
        return `${this._config.c3Uri}${GET_APP_DEPLOYMENT_URI}`
    }

    getAppConfig(deployment, ...keys) {
        let config = deployment.config?.deploymentTimeConfig;
        if (!config) return null;

        let value;
        for (const key of keys) {
            if (value === undefined || value === null) {
                value = config[key];
            }
        }
        return value;
    }

    async getAppDeploymentList(resourcePoolUri) {
        let deployList;
        for (let rp of resourcePoolUri) {
            //FIXME: CmdHelper.buildCmd2Url does not encode  appDeploymentUri
            let result = await this._executeCommand(CmdHelper.buildCmd2Url(this._buildGetAppDeploymentListCmdUri(), encodeURIComponent(rp)), "get", null, {}, HEADERS);
            result = JSON.parse(result.body);
            if (!deployList) {
                deployList = result;
            } else {
                deployList.pageEntries.push(...result.pageEntries);
                deployList.totalSize += result.totalSize;
            }
        }
        return deployList.pageEntries.map(item => {
            let record = {};
            record.uri = item.uri;
            record.code = item.code;
            record.asid = item.asid;
            record.version = item.version;
            //FIXME: asi jich muze byt vice, nebo zadna
            if (item.config && item.config.deployUnits && item.config.deployUnits[0]) {
                record.nodeSize = item.config.deployUnits[0].nodeSize;
            } else {
                record.nodeSize = "";
            }
            record.nodeCount = 0;
            if (item.nodeSets) {
                record.nodeCount = item.nodeSets.reduce((count, nodeSet) => count + nodeSet.nodeCount, 0);
            }

            record.tags = "";
            if (item.config.deploymentTimeConfig && item.config.deploymentTimeConfig.tags) {
                record.tags = item.config.deploymentTimeConfig.tags;
            }
            record.cpu = 0;
            record.memory = 0;
            if (item.allocatedCapacity) {
                record.cpu = item.allocatedCapacity.cpu;
                record.memory = item.allocatedCapacity.mem;
            }
            record.state = item.state;
            record.data = item;
            record.uuAppServerEnvironment = item.config.deploymentTimeConfig;
            return record;
        });
        return deployList;
    }

    async getAwids(subAppDeployment) {
        try {
            // Cloud g01 dont have appicatiuon uri in application deployyment, use OIDC uri to creaft application uri
            //Get OIDC URI directly from the subAppDeployment
            const oidcUri = this.getAppConfig(
                subAppDeployment.data,
                "uu_app_oidc_providers_oidcg02_uri",
                "uu.app.oidc.providers.oidcg02.uri"
            );

            if (!oidcUri) {
                throw new Error("Cannot find OIDC URI in deployment configuration");
            }

            logger.debug(`OIDC URI of uuSubApp: ${oidcUri}`);

            // Now get the app share list
            const url = this._buildGetAppShareListCmdUri();
            const fullUrl = `${url}?uuUri=${encodeURIComponent(subAppDeployment.uri)}`;
            const result = await this._executeCommand(fullUrl, "get", null, {}, HEADERS);
            const response = JSON.parse(result.body);

            // Add debug logging for the share list results
            logger.debug(`GetAppShareList response for ${subAppDeployment.uri}:`, JSON.stringify(response, null, 2));

            // If no AWIDs found, return empty array (no default)
            if (!response.pageEntries || response.pageEntries.length === 0) {
                logger.info('No AWIDs found in app share list');
                return [];
            }

            return response.pageEntries.map(item => {

                // Parse URI using UESUri class
                const uesUri = UESUri.parse(item.territoryUri);

                // Extract AWID from artifact.code
                let awid = "";

                if (uesUri && uesUri.artifact && uesUri.artifact.id) {
                    // Get the artifact code
                    const artifactId = uesUri.artifact.id;

                    // When using territoryUri, the AWID is directly in the artifact.id
                    awid = artifactId;
                } else {
                    // Fallback to item code
                    awid = item.code || '';
                    logger.warn(`Could not find artifact.code, using fallback: ${awid}`);
                }

                // Set the app path using item's urlPath or code
                const appPath = (item.urlPath || item.code || "").replace("/", "-").toLowerCase();

                // Create and configure Uri builder
                const uriBuilder = Uri.createBuilder().parse(oidcUri);
                uriBuilder.setProduct(appPath);
                uriBuilder.setUseCase("");

                if (awid) {
                    uriBuilder.setAwid(awid);
                }

                // Get AWID URI from builder
                const awidUri = uriBuilder.toUri().toString();

                return {
                    ...item,
                    awid,     // Just show AWID code as display name
                    targetAwid: awid,      // The actual AWID value
                    awidUri: awidUri       // URI built with the builder
                };

            }).filter(item => item.targetAwid !== subAppDeployment.asid); // Filter out entries where AWID equals ASID
        } catch (error) {
            logger.error(`Error in getAwids: ${error.message}`);
            throw error;
        }
    }

    async _executeCommand(url, method, params, options, headers, tryNumber = 0) {
        try {
            return await this._appClient.exchange(url, method, params, options, headers);
        } catch (err) {
            if (tryNumber > 10) {
                logger.error(`All retries has failed.`, err);
                throw err;
            }
            logger.warn(`Request failed retrying #${tryNumber + 1}....`)
            return await this._executeCommand(url, method, params, options, headers, ++tryNumber);
        }
    }

}

module.exports = UuCloud;
