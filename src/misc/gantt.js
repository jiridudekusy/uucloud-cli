const {Uri} = require("uu_appg01_core-uri");
const chalk = require("chalk");
const dayjs = require("dayjs");
const {searchPrompt} = require("../misc/prompt-utils");
const PerfmonHelper = require("./perfmon-helper");
const json = require("../../test/commands/perfmon-cgmesio.json");
const readline = require('readline');
const {line} = require("blessed-contrib");


class Gantt {

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
     * @param {Task[]} tasks
     * @param {number} chartWidth - Number of characters for timeline (e.g. 60)
     */
    async renderGantt(tasks, mode = Gantt.modes.SIMPLE, chartWidth = 60) {
        // Convert to timestamps
        const parsedTasks = tasks.filter(t => (t.urlPath)).map(t => {

            if (!t.urlPath) {
                console.log(t);
                throw new Error("non-parseablelog");
            }

            const useCase = Uri.parse(t.urlPath).getUseCase();
            const start = new Date(t.timeStamp);
            const end = new Date(start.getTime() + t.responseTime);
            return {
                ...t,
                name: useCase,
                start: dayjs(start).valueOf(),
                end: dayjs(end).valueOf(),
            }
        });

        // Find global min/max
        const minTime = Math.min(...parsedTasks.map(t => t.start));
        const maxTime = Math.max(...parsedTasks.map(t => t.end));
        const timeRange = maxTime - minTime;

        // Build time labels (X axis)
        //const step = timeRange / chartWidth;
        this._printXAxis(timeRange, chartWidth, minTime);

        if (mode === Gantt.modes.GROUPED) {
            const grouped = this._groupLogs(parsedTasks);
            for (const [groupKey, docs] of Object.entries(grouped)) {
                console.log(); // spacing
                console.log(`traceID group: ${groupKey}`);
                docs.forEach((task) => {
                    this._printLine(task, minTime, timeRange, chartWidth);
                })
            }
            console.log(); //spacing
        } else if (mode === Gantt.modes.SIMPLE) {
            // Print each task
            parsedTasks.forEach(task => {
                this._printLine(task, minTime, timeRange, chartWidth);
            });
            // spacing
            console.log();
        } else if (mode === Gantt.modes.INTERACTIVE) {
            // Print each task at first
            parsedTasks.forEach(task => {
                this._printLine(task, minTime, timeRange, chartWidth);
            });
            //spacing
            console.log();

            //prepare lines for selections
            let lines = this._getInteractiveLines(parsedTasks, minTime, timeRange, chartWidth);

            //selection-based loop
            while (true) {
                let result = await searchPrompt("Select cmd to get details:", lines);
                if (result === "exit") {
                    console.log(chalk.green('\nGoodbye!\n'));
                    process.exit(0);
                }
                let logItem = parsedTasks.filter(tasks => tasks.id === result)[0];
                this._renderLogDetail(logItem);
                await this._waitForEnter();
            }
        }
    }

    _renderLogDetail(logItem) {
        console.log(chalk.green('\n log item detail:  \n'));
        console.log(chalk.green(JSON.stringify(logItem, null, 2)));
        console.log("Perfmon section:")
        console.log("")
        //let json = require("../../test/commands/perfmon-cgmesio.json");
        //let output = PerfmonHelper.renderTreeString(json);
        //return output;
    }

    _getInteractiveLines(parsedTasks, minTime, timeRange, chartWidth) {
        let lines = [];
        lines.push({
            name: "exit",
            value: "exit"
        })

        let realLines =
            parsedTasks.map(task => {
                let line = this._getLine(task, minTime, timeRange, chartWidth);
                let res = {
                    name: line,
                    value: task.id
                }
                return res;
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

    _getLine(task, minTime, timeRange, chartWidth) {
        const name = task.name.padEnd(10 + 10);
        const startPos = Math.floor(((task.start - minTime) / timeRange) * chartWidth);
        const endPos = Math.floor(((task.end - minTime) / timeRange) * chartWidth);
        let bar = " ".repeat(startPos) + chalk.cyan("█".repeat(endPos - startPos || 1)) + chalk.green(` [${task.end - task.start} ms]`);
        return (chalk.green(name) + " " + bar);
    }

    _printLine(task, minTime, timeRange, chartWidth) {
        let line = this._getLine(task, minTime, timeRange, chartWidth);
        console.log(line);
        console.log(chalk.gray(`${dayjs(task.start).format("HH:mm:ss")}-${dayjs(task.end).format("HH:mm:ss")}, traceId: ${task.traceId}, reqId:${task.id}, responseSize:${task.responseSize}, responseStatus:${task.responseStatus} `,));
    }

    _groupLogs(parsedTasks) {
        const grouped = parsedTasks.reduce((acc, doc) => {
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