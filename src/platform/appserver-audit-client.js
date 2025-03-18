const {AppClient} = require("uu_appg01_core-appclient");
const {Uri} = require("uu_appg01_core-uri");

class AppServerAuditClient {
    constructor(config) {
        this.config = config;
        this.token = config.oidcToken;
    }

    async getAuditLogs(dtoIn){
        return this.#commandGet("sys/logRecord/list", dtoIn);
    }

    async #commandGet(commandName, dtoIn) {
        const commandUri = Uri.createBuilder().parse(this.config.baseUri)
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

module.exports = AppServerAuditClient;