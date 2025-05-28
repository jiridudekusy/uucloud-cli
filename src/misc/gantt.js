const {Uri} = require("uu_appg01_core-uri");
const chalk = require("chalk");
const dayjs = require("dayjs");
const {searchPrompt} = require("../misc/prompt-utils");
const PerfmonHelper = require("./perfmon-helper");
const json = require("../../test/commands/perfmon-cgmesio.json");


class Gantt {

    /**
     * @typedef {{ name: string, start: string | number, end: string | number }} Task
     * @param {Task[]} tasks
     * @param {number} chartWidth - Number of characters for timeline (e.g. 60)
     */
    renderGantt(tasks, mode = "simple", chartWidth = 60) {
        // Convert to timestamps
        const parsedTasks = tasks.map(t => {
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
        this.printXAxis(timeRange, chartWidth, minTime);

        if (mode === "grouped") {
            const grouped = this._groupLogs(parsedTasks);
            for (const [groupKey, docs] of Object.entries(grouped)) {
                console.log(); // spacing
                console.log(`traceID group: ${groupKey}`);
                docs.forEach((task) => {
                    this.printLine(task, minTime, timeRange, chartWidth);
                })
            }
            console.log(); //spacing
        } else if (mode === "simple") {
            // Print each task
            parsedTasks.forEach(task => {
                this.printLine(task, minTime, timeRange, chartWidth);
            });
            console.log();
            // spacing
        } else if (mode === "interactive") {

            parsedTasks.forEach(task => {
                this.printLine(task, minTime, timeRange, chartWidth);
            });

            let lines = parsedTasks.map(task => {
                let line = this.getLine(task, minTime, timeRange, chartWidth);

                let res = {
                    name: line,
                    value: line
                }
                return res;
            })

            //let result = await searchPrompt("Select traceId to get perflogs:", lines);

        }

        //console.log(`minTime: ${ dayjs(minTime + i * step).format("HH:mm")(minTime)}, maxTime: ${new Date(maxTime)}, timeRange: ${timeRange}, step:  ${step}`);

    }

    printXAxis(timeRange, chartWidth, minTime) {
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

    getLine(task, minTime, timeRange, chartWidth) {
        const name = task.name.padEnd(10 + 10);
        const startPos = Math.floor(((task.start - minTime) / timeRange) * chartWidth);
        const endPos = Math.floor(((task.end - minTime) / timeRange) * chartWidth);
        let bar = " ".repeat(startPos) + chalk.cyan("█".repeat(endPos - startPos || 1)) + chalk.green(` [${task.end - task.start} ms]`);
        return (chalk.green(name) + " " + bar);
    }

    printLine(task, minTime, timeRange, chartWidth) {
        let line = this.getLine(task, minTime, timeRange, chartWidth);
        console.log(line);
        console.log(chalk.grey(`${dayjs(task.start).format("HH:mm:ss")}-${dayjs(task.end).format("HH:mm:ss")}, traceId: ${task.traceId}, reqId:${task.id}, responseSize:${task.responseSize}, responseStatus:${task.responseStatus} `,));
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