const { Uri } = require("uu_appg01_core-uri");
const chalk = require("chalk");
const dayjs = require("dayjs");

class Gantt {

    /**
     * @typedef {{ name: string, start: string | number, end: string | number }} Task
     * @param {Task[]} tasks
     * @param {number} chartWidth - Number of characters for timeline (e.g. 60)
     */
    renderGantt(tasks, chartWidth = 60) {

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
        const step = timeRange / chartWidth;
        const labels = Array.from({length: chartWidth}, (_, i) =>
            dayjs(minTime + i * step).format("HH:mm")
        );

        // Print time axis
        const labelLine = " ".repeat(12 + 10) + labels.map((l, i) => (i % 6 === 0 ? l.padStart(6) : " ")).join("");
        console.log(chalk.bold("\nGantt Chart (Datetime):\n"));
        console.log(labelLine);

        // Print each task
        parsedTasks.forEach(task => {
            const name = task.name.padEnd(10 + 10);
            //.slice(0,20);
            const startPos = Math.floor(((task.start - minTime) / timeRange) * chartWidth);
            const endPos = Math.floor(((task.end - minTime) / timeRange) * chartWidth);
            const bar = " ".repeat(startPos) + chalk.cyan("█".repeat(endPos - startPos || 1));
            console.log(chalk.green(name) + " " + bar);
            console.log(`[${startPos},${endPos}], start: ${dayjs(task.start).format("HH:mm:ss")}, end: ${dayjs(task.end).format("HH:mm:ss")}, duration: ${task.end - task.start}, traceId: ${task.traceId}`);
        });

        console.log(); // spacing
        //console.log(`minTime: ${ dayjs(minTime + i * step).format("HH:mm")(minTime)}, maxTime: ${new Date(maxTime)}, timeRange: ${timeRange}, step:  ${step}`);

    }
}


module.exports = Gantt;