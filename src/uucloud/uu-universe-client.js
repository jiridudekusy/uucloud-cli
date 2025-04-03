const {AppClient} = require("uu_appg01_core-appclient");
const {Uri} = require("uu_appg01_core-uri");

class UuUniverseClient {
    constructor(config) {
        this.config = config;
        this.token = config.oidcToken;
    }

    async getAppDeploymentList(resourcePoolOid) {
        let deployList = [];
        for (let rp of resourcePoolOid) {
            let res = await this.#commandGet("uuSubAppInstanceWorkload/list", {uuAppResourcePoolOid: rp});
            deployList = deployList.concat(res.itemList);
        }
        deployList = deployList.map(item => {
            // Extract tags from uuAppServerEnvironment if available
            let tags = "";
            if (item.uuAppServerEnvironment && item.uuAppServerEnvironment.tags) {
                tags = item.uuAppServerEnvironment.tags;
            }
            
            return {
                //asid", "uuSubApp", "Version", "Tags", "Node size", "Node Count", "CPU", "Memory", "State"
                asid: item.asid,
                code: item.urlPath,
                version: item.version,
                tags: tags,
                nodeSize: null,
                nodeCount: null,
                cpu: null,
                memory: null,
                state: item.state,
                uuAppServerEnvironment: item.uuAppServerEnvironment,
                data: item
            };
        });
        return deployList;
    }

    async getUuAppResourcePool(reourcePoolOid) {
        return await this.#commandGet("uuAppResourcePool/get", {oid: reourcePoolOid});
    }

    async getAwids(uuSubAppDeployment) {
        let response = await this.#commandGet("uuSubAppInstanceWorkload/awidCard/list", {
            asid: uuSubAppDeployment.asid,
            extended: true
        });
        return response.itemList.map(item => {
            let uri = Uri.createBuilder().parse(response.extendedData.uuSubAppInstanceWorkloadMap[item.uuSubAppInstanceWorkloadOid].uuSubAppInstanceBaseUriList[0]);
            return {
                ...item,
                awidUri: uri.setAwid(item.targetAwid).toUri().toString()
            }
        });
   }

    async #commandGet(commandName, dtoIn) {
        const commandUri = Uri.createBuilder().parse(this.config.universeUri)
            .setUseCase(commandName)
            .clearParameters().toUri();
        const headers = {Authorization: `${await this.token.get()}`};
        let result;
        try {
            result = await AppClient.get(commandUri.toString(), dtoIn, {headers});
        } catch (e) {
            if (e.dtoOut) {
                console.error(JSON.stringify(e.dtoOut, null, 2))
            }
            throw e;
        }
        return result.data;
    }
}

module.exports = UuUniverseClient;