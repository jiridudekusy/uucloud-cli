const UuUniverseClient = require("./uu-universe-client");
const UuCloud = require("./uucloud");
const BusinessTerritoryClient = require("./business-territory-client");

class UucloudClient {
    constructor(oidcToken, options = {}) {
        this.config = options || {};
        if (this.config.universeUri) {
            this.provider = new UuUniverseClient({oidcToken, universeUri: options.universeUri});
        } else {
            this.provider = new UuCloud({oidcToken, c3Uri: options.c3Uri || ""});
        }
        this.uuBtProvider = new BusinessTerritoryClient({oidcToken});
    }

    async getAppDeploymentList(resourcePoolUri) {
        const resourcePoolArray = Array.isArray(resourcePoolUri) ? resourcePoolUri : [resourcePoolUri];

        const businessTerritoryUris = resourcePoolArray.filter(uri => this._isBusinessTerritoryUri(uri));
        const regularResourcePools = resourcePoolArray.filter(uri => !this._isBusinessTerritoryUri(uri));

        let allApps = [];

        const rpApps = await this.provider.getAppDeploymentList(regularResourcePools);
        allApps.push(...rpApps);

        const resourcePoolAsids = allApps.map(app => app.asid);
        const btApps = await this.uuBtProvider.getAppDeploymentList(businessTerritoryUris, resourcePoolAsids);
        allApps.push(...btApps);

        return this._deduplicateApps(allApps);
    }

    /**
     * Deduplicate apps, prioritizing resource pool apps over business territory apps
     * @param {Array} apps - List of all apps
     * @returns {Array} - Deduplicated list of apps
     */
    _deduplicateApps(apps) {
        const seenAsids = new Set();
        const deduplicatedApps = [];

        apps.forEach(app => {
            if (app.sourceType === 'resource-pool') {
                seenAsids.add(app.asid);
                deduplicatedApps.push(app);
            }
        });

        apps.forEach(app => {
            if (app.sourceType === 'business-territory' && !seenAsids.has(app.asid)) {
                seenAsids.add(app.asid);
                deduplicatedApps.push(app);
            }
        });

        return deduplicatedApps;
    }

    async getUniverseClient() {
        if (this.config.universeUri) {
            return this.provider;
        } else {
            return null;
        }
    }

    async getAwids(subAppDeployment) {
        if (subAppDeployment.sourceType === 'business-territory') {
            return this.uuBtProvider.getAwids(subAppDeployment);
        } else {
            return this.provider.getAwids(subAppDeployment);
        }
    }

    /**
     * Check if a pool entry is a business territory URI
     * @param {string} poolEntry - The pool entry to check
     * @returns {boolean} - True if it's a business territory URI
     */
    _isBusinessTerritoryUri(poolEntry) {
        return typeof poolEntry === 'string' && (poolEntry.startsWith('http://') || poolEntry.startsWith('https://'));
    }
}

module.exports = UucloudClient;