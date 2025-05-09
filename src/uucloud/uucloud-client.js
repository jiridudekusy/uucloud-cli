const UuUniverseClient = require("./uu-universe-client");
const UuCloud = require("./uucloud");

class UucloudClient {
    constructor(oidcToken, options = {}) {
        this.config = options || {};
        if (this.config.universeUri) {
            this.provider = new UuUniverseClient({oidcToken, universeUri: options.universeUri});
        } else {
            this.provider = new UuCloud({oidcToken, c3Uri: options.c3Uri || ""});
        }
    }

    async getAppDeploymentList(resourcePoolUri) {
        return this.provider.getAppDeploymentList(resourcePoolUri);
    }

    async getUniverseClient() {
        if (this.config.universeUri) {
            return this.provider;
        } else {
            return null;
        }
    }

    async getAwids(subAppDeployment) {
        return this.provider.getAwids(subAppDeployment);
    }
}

module.exports = UucloudClient;