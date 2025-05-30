const {Uri} = require("uu_appg01_core-uri");
const chalk = require("chalk");
const dayjs = require("dayjs");
const {searchPrompt} = require("../misc/prompt-utils");
const readline = require('readline');
const UuAppLogStoreClient = require("../platform/uuapplogstore-client")
const OidcTokenProvider = require("../oidc-token-provider");
const {renderTreeString} = require("./perfmon-helper");



class Gantt {

    constructor(appLogStoreUri, oidcUri) {
        this._appLogStoreUri = appLogStoreUri;
        this._oidcUri = oidcUri;
    }

    static config = {
        defaultWidthOffset: 40,
    }

    static modes = {
        SIMPLE: 'simple',
        GROUPED: 'user',
        INTERACTIVE: 'guest',
    }

    /**
     * @typedef {{ name: string, start: string | number, end: string | number }} Task
     * @param {Task[]} logs
     * @param {number} chartWidth - Number of characters for timeline (e.g. 60)
     */
    async renderGantt(logs, mode = Gantt.modes.SIMPLE, chartWidth = 60) {
        // Convert to timestamps
        const parsedLogs = logs.filter(l => (l.urlPath)).map(l => {

            if (!l.urlPath) {
                console.log(t);
                throw new Error("non-parseable log");
            }

            const useCase = Uri.parse(l.urlPath).getUseCase();
            const start = new Date(l.timeStamp);
            const end = new Date(start.getTime() + l.responseTime);
            return {
                ...l,
                name: useCase,
                start: dayjs(start).valueOf(),
                end: dayjs(end).valueOf(),
            }
        });

        // Find global min/max
        const minTime = Math.min(...parsedLogs.map(l=> l.start));
        const maxTime = Math.max(...parsedLogs.map(l => l.end));
        const timeRange = maxTime - minTime;

        // Build time labels (X axis)
        //const step = timeRange / chartWidth;
        this._printXAxis(timeRange, chartWidth, minTime);

        if (mode === Gantt.modes.GROUPED) {
            const grouped = this._groupLogs(parsedLogs);
            for (const [groupKey, docs] of Object.entries(grouped)) {
                console.log(); // spacing
                console.log(`traceID group: ${groupKey}`);
                docs.forEach((logs) => {
                    this._printLine(logs, minTime, timeRange, chartWidth);
                })
            }
            console.log(); //spacing
        } else if (mode === Gantt.modes.SIMPLE) {
            // Print each logs
            parsedLogs.forEach(logs => {
                this._printLine(logs, minTime, timeRange, chartWidth);
            });
            // spacing
            console.log();
        } else if (mode === Gantt.modes.INTERACTIVE) {
            // Print each logs at first
            parsedLogs.forEach(logs => {
                this._printLine(logs, minTime, timeRange, chartWidth);
            });
            //spacing
            console.log();

            //prepare lines for selections
            let lines = this._getInteractiveLines(parsedLogs, minTime, timeRange, chartWidth);

            //selection-based loop
            while (true) {
                let result = await searchPrompt("Select cmd to get details:", lines);
                if (result === "exit") {
                    console.log(chalk.green('\nGoodbye!\n'));
                    process.exit(0);
                }
                let logItem = parsedLogs.filter(logs => logs.id === result)[0];
                this._renderLogDetail(logItem);
                await this._waitForEnter();
            }
        }
    }

    async _renderLogDetail(logItem) {
        console.log(chalk.green('\n log item detail:  \n'));
        console.log(chalk.green(JSON.stringify(logItem, null, 2)));
        console.log("Perfmon section:")
        console.log("")

        const oidcToken = await this.getAppLogStoreOidcToken(this._oidcUri);

        // Use ConsoleClient to list consoles
        const uuAppLogStoreClient = new UuAppLogStoreClient({ oidcToken, baseUri:this._appLogStoreUri });
        let auditLogs = await uuAppLogStoreClient.getAuditLogs({
            filterMap:{
                logTypeCode:["uuApp/perfMon"],
                requestId: logItem.traceId
            }
        });

        let data = auditLogs.itemList[0];
        if (data) {
            console.log("\n");
            console.log("Perfmon output (compact view):");
            console.log("\n");
            let res = renderTreeString(data.logData.log);
            console.log(chalk.cyan(res));
            console.log("\n");
            console.log("Perfmon output (raw view):");
            console.log("\n");
            console.log(chalk.green(JSON.stringify(data, null, 2)));

        }else{
            console.log(`auditLogs not found for traceId: ${logItem.traceId} \n`);
        }
    }

    async getAppLogStoreOidcToken(oidcUri) {
        //let oidcUri = "https://smarta-dev1.pseex20-smarta.local/uu-oidc-maing02/00219110000000000000000000000100/oidc"
        //logger.info(`OIDC URI of uuSubApp : ${oidcUri}`);
        let oidcToken = await new OidcTokenProvider().getToken({
            authentication: "oidc",
            oidcUri,
            tokenAlias: Uri.parse(oidcUri).awid
        });
        return oidcToken;
    }


    _getInteractiveLines(parsedLogs, minTime, timeRange, chartWidth) {
        let lines = [];
        lines.push({
            name: "exit",
            value: "exit"
        })

        let realLines =
            parsedLogs.map(log => {
                let line = this._getLine(log, minTime, timeRange, chartWidth);
                return {
                    name: line,
                    value: log.id
                };
            });

        lines.push(...realLines);
        return lines;
    }

    async _waitForEnter() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(chalk.gray('Press Enter to go back to the list...'), () => {
                rl.close();
                console.log(); // for spacing
                resolve();
            });
        });
    }

    _printXAxis(timeRange, chartWidth, minTime) {
        const totalDurationMs = timeRange
        const stepCharWidth = 6; // width of each step (in characters)
        const maxSteps = Math.floor(chartWidth / stepCharWidth);

        // Compute time per step
        const stepSizeMs = Math.ceil(totalDurationMs / maxSteps);

        // Format label
        const formatLabel = (timestamp) => {
            const d = new Date(timestamp);
            return dayjs(d).format("HH:mm");
        };

        const labelWidth = 5; // for MM:SS labels
        const totalSteps = Math.ceil(totalDurationMs / stepSizeMs);
        const maxLabels = Math.floor(chartWidth / labelWidth);
        const labelEvery = Math.ceil(totalSteps / maxLabels);

        // Draw axis
        let axis = " ".repeat(12 + 10);
        for (let i = 0; i <= totalSteps; i++) {
            const time = minTime + i * stepSizeMs;
            if (i % labelEvery === 0) {
                axis += formatLabel(time).padEnd(stepCharWidth, ' ');
            } else {
                axis += ' '.repeat(stepCharWidth);
            }
        }
        console.log(chalk.bold("\nGantt Chart (Datetime):\n"));
        console.log(axis);
        return axis;
    }


    _getLine(logs, minTime, timeRange, chartWidth) {
        const name = logs.name.padEnd(10 + 10);
        const startPos = Math.floor(((logs.start - minTime) / timeRange) * chartWidth);
        const endPos = Math.floor(((logs.end - minTime) / timeRange) * chartWidth);
        let bar = " ".repeat(startPos) + chalk.cyan("█".repeat(endPos - startPos || 1)) + chalk.green(` [${logs.end - logs.start} ms]`);
        return (chalk.green(name) + " " + bar);
    }

    _printLine(logs, minTime, timeRange, chartWidth) {
        let line = this._getLine(logs, minTime, timeRange, chartWidth);
        console.log(line);
        console.log(chalk.gray(`${dayjs(logs.start).format("HH:mm:ss")}-${dayjs(logs.end).format("HH:mm:ss")}, traceId: ${logs.traceId}, reqId:${logs.id}, responseSize:${logs.responseSize}, responseStatus:${logs.responseStatus} `,));
    }

    _groupLogs(parsedLogs) {
        const grouped = parsedLogs.reduce((acc, doc) => {
            const groupKey = doc.traceId.split('-')[0];
            if (!acc[groupKey]) acc[groupKey] = [];
            // traceIdGroup
            doc.traceIdGroup = groupKey;
            acc[groupKey].push(doc);
            return acc;
        }, {});
        return grouped;
    }
}


module.exports = Gantt;