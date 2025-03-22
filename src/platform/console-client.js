const {AppClient} = require("uu_appg01_core-appclient");
const {Uri} = require("uu_appg01_core-uri");

class ConsoleClient {
    constructor(config) {
        this.config = config;
        this.token = config.oidcToken;
    }

    async getAppStatus(appDepoyment){
        return this.#commandGet("progressBus/load", {code: `uuappstatus_${appDepoyment.asid}`, progressDataLoadStrategy: "nohistory"});
    }

    async listConsoles() {
        return this.#commandGet("console/list", {});
    }

    async listProgressBuses() {
        return this.#commandGet("progressBus/list", {});
    }

    async #commandGet(commandName, dtoIn) {
        const commandUri = Uri.createBuilder().parse(this.config.consoleUri)
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

module.exports = ConsoleClient;