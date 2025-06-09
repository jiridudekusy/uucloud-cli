const { AppClient } = require("uu_appg01_core-appclient");
const { getLogAccessAttributes, extractLogCriteriaFromUri } = require('../misc/log-utils');
const { Uri } = require("uu_appg01_core-uri");

/**
 * Business Territory provider that implements the same interface as UuUniverseClient and UuCloud
 */
class BusinessTerritoryClient {
    constructor(config) {
        this.config = config;
        this.token = config.oidcToken;
    }

    async getAppDeploymentList(businessTerritoryUris, skipAsids = []) {
        let allApps = [];

        for (const businessTerritoryUri of businessTerritoryUris) {
            const btApps = await this._getAppsFromBusinessTerritory(businessTerritoryUri, skipAsids);
            allApps.push(...btApps);
        }

        return allApps;
    }

    async getAwids(subAppDeployment) {
        return subAppDeployment.awscs.map(awsc => {
            const extractedAwid = this._extractAwidFromUri(awsc.uuAppWorkspaceUri) || awsc.awid;
            return {
                awid: extractedAwid,
                targetAwid: extractedAwid,
                awidUri: awsc.uuAppWorkspaceUri
            };
        });

    }

    /**
     * List installed uuApps from business territory
     * @param {string} businessTerritoryUri - Business territory URI
     * @returns {Promise<Array>} - List of installed uuApps
     */
    async listInstalledUuApps(businessTerritoryUri) {
        try {
            const commandUri = Uri.createBuilder().parse(businessTerritoryUri)
                .setUseCase("listInstalledUuApps")
                .clearParameters().toUri();
            const headers = { Authorization: `${await this.token.refresh()}` };

            const result = await AppClient.get(commandUri.toString(), {}, { headers });
            return (result.data && result.data.installedUuApps) || [];
        } catch (error) {
            if (error.dtoOut) {
                console.error(JSON.stringify(error.dtoOut, null, 2));
            }
            console.error(`Failed to list installed uuApps: ${error.message}`);
            throw error;
        }
    }

    /**
     * List app AWCSs from business territory
     * @param {string} businessTerritoryUri - Business territory URI
     * @param {Array|string} appCodeList - List of app codes or single app code
     * @returns {Promise<Object|Array>} - AWCSs data
     */
    async listAppAwscs(businessTerritoryUri, appCodeList) {
        try {
            const commandUri = Uri.createBuilder().parse(businessTerritoryUri)
                .setUseCase("listAppAwscs")
                .clearParameters().toUri();
            const headers = { Authorization: `${await this.token.refresh()}` };

            const dtoIn = Array.isArray(appCodeList) ? { appCodeList } : { appCodeList: [appCodeList] };

            const result = await AppClient.get(commandUri.toString(), dtoIn, { headers });
            const awscs = (result.data && result.data.awscs) || {};

            if (!Array.isArray(appCodeList)) {
                return awscs[appCodeList] || [];
            }

            return awscs;
        } catch (error) {
            if (error.dtoOut) {
                console.error(JSON.stringify(error.dtoOut, null, 2));
            }
            console.error(`Failed to list awscs for apps: ${error.message}`);
            return Array.isArray(appCodeList) ? {} : [];
        }
    }

    /**
     * Get applications from business territory
     * @param {string} businessTerritoryUri - Business territory URI
     * @param {Array} skipAsids - ASIDs to skip (already exist in resource pool)
     * @returns {Promise<Array>} - List of applications from business territory
     */
    async _getAppsFromBusinessTerritory(businessTerritoryUri, skipAsids = []) {
        const normalizedUri = businessTerritoryUri.endsWith("/") ? businessTerritoryUri.slice(0, -1) : businessTerritoryUri;

        const installedAppsResult = await this.listInstalledUuApps(normalizedUri);
        if (!installedAppsResult?.length) return [];

        const appCodeList = installedAppsResult.map(app => app.code);

        // Batch requests to handle API limit of 10 elements
        const awscsResult = {};
        const batchSize = 10;
        for (let i = 0; i < appCodeList.length; i += batchSize) {
            const batch = appCodeList.slice(i, i + batchSize);
            const batchResult = await this.listAppAwscs(normalizedUri, batch);
            Object.assign(awscsResult, batchResult);
        }

        const btApps = [];

        for (const [appCode, appInstances] of Object.entries(awscsResult)) {
            if (!appInstances?.length) continue;

            const appInstallInfo = installedAppsResult.find(app => app.code === appCode);
            const awscs = await Promise.all(appInstances.map(async instance => {
                const awsc = {
                    awid: this._extractAwidFromUri(instance.uuAppWorkspaceUri, instance.awid || instance.oid),
                    uuAppWorkspaceUri: instance.uuAppWorkspaceUri,
                    oid: instance.oid,
                    state: instance.state,
                    unitName: instance.unitName
                };

                // Only call getLogAccessAttributes if this app is not already in resource pool
                const asid = this._extractAsidFromAppKey(instance.appKey, awsc.awid);
                if (!skipAsids.includes(asid)) {
                    const logAccessAttributes = await getLogAccessAttributes(instance.uuAppWorkspaceUri, this.token);
                    if (logAccessAttributes?.logDataUri) {
                        awsc.logDataUri = logAccessAttributes.logDataUri;
                        awsc.logCriteria = extractLogCriteriaFromUri(logAccessAttributes.logDataUri);
                    }
                }

                return awsc;
            }));

            appInstances.forEach(instance => {
                const awid = this._extractAwidFromUri(instance.uuAppWorkspaceUri, instance.awid || instance.oid);
                const asid = this._extractAsidFromAppKey(instance.appKey, awid);

                btApps.push({
                    asid: asid,
                    code: appCode,
                    version: appInstallInfo?.version || "N/A",
                    tags: "",
                    state: instance.state || "N/A",
                    uuAppWorkspaceUri: instance.uuAppWorkspaceUri || "N/A",
                    source: `Business Territory (${normalizedUri.split('/').pop()})`,
                    sourceType: 'business-territory',
                    awscs: awscs,
                    data: instance,
                    nodeSize: null,
                    nodeCount: null,
                    cpu: null,
                    memory: null,
                    originalAsid: instance.oid || instance.awid // Keep original ASID for internal use
                });
            });
        }

        return btApps;
    }

    /**
     * Extract ASID from appKey with fallback to AWID
     * @param {string} appKey - App key in format "appCode/asid-awid"
     * @param {string} fallbackAwid - Fallback AWID if extraction fails
     * @returns {string} - Extracted ASID or fallback AWID
     */
    _extractAsidFromAppKey(appKey, fallbackAwid) {
        if (appKey) {
            const appKeyParts = appKey.split('/');
            if (appKeyParts.length >= 2) {
                const asidAwid = appKeyParts[1];
                const asidPart = asidAwid.split('-')[0];
                if (asidPart && asidPart.length > 10) { // Basic validation for ASID format
                    return asidPart;
                }
            }
        }
        return fallbackAwid;
    }

    /**
     * Extract AWID from URI with fallback
     * @param {string} uuAppWorkspaceUri - URI to extract AWID from
     * @param {string} fallbackAwid - Fallback AWID if extraction fails
     * @returns {string} - Extracted or fallback AWID
     */
    _extractAwidFromUri(uuAppWorkspaceUri, fallbackAwid) {
        if (uuAppWorkspaceUri) {
            try {
                const parsedUri = Uri.parse(uuAppWorkspaceUri);
                if (parsedUri.awid) return parsedUri.awid;
            } catch (error) {
                // Ignore URI parsing errors
            }
        }
        return fallbackAwid || "N/A";
    }
}

module.exports = BusinessTerritoryClient;