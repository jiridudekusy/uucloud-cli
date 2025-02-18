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
            let res =  await this.#commandGet("uuSubAppInstanceWorkload/list", {uuAppResourcePoolOid: rp});
            deployList = deployList.concat(res.itemList);
        }
        deployList = deployList.map(item => ({
            //asid", "uuSubApp", "Version", "Tags", "Node size", "Node Count", "CPU", "Memory", "State"
            asid: item.asid,
            code: item.urlPath,
            version: item.version,
            tags:"",
            nodeSize: null,
            nodeCount: null,
            cpu: null,
            memory: null,
            state: item.state,
            data: item
        }));
        return deployList;
    }

    async #commandGet(commandName, dtoIn) {
        const commandUri = Uri.createBuilder().parse(this.config.universeUri)
            .setUseCase(commandName)
            .clearParameters().toUri();
        const headers =  {Authorization: `${await this.token.get()}`};
        let result;
        try {
            result = await AppClient.get(commandUri.toString(), dtoIn, {headers});
        } catch (e) {
            if(e.dtoOut) {
                console.error(JSON.stringify(e.dtoOut, null, 2))
            }
            throw e;
        }
        return result.data;

    }
}

module.exports = UuUniverseClient;