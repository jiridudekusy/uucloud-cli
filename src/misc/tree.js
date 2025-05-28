const {v4: uuidv4} = require("uuid");
const {Uri} = require("uu_appg01_core-uri");
const chalk = require("chalk");
const Gantt = require("./gantt");


class Tree {

    renderTree(logs) {

        console.log("Tree view: ");
        console.log("");

        //group logs by their traceGroupId (first part of traceId currently)
        const grouped = this._groupLogs(logs);

        //add virtual nodes representing roots having similar parts of traceId
        const virtualNodes = [];
        for (const [groupKey, docs] of Object.entries(grouped)) {
            virtualNodes.push({
                id: uuidv4(),
                dependsOn: [],
                traceIdGroup: groupKey
            });
        }

        //resolve dependencies
        let enhancedDocs = logs.map((task) => {
            const previousVirtualNode = virtualNodes.filter(virtualNode => virtualNode.traceIdGroup === task.traceIdGroup)[0];
            return {
                ...task,
                dependsOn: [previousVirtualNode.id]
            }
        })

        enhancedDocs.push(...virtualNodes);

        const depMap = this.buildDependencyMap(enhancedDocs);
        const roots = this.findRoots(depMap);

        roots.forEach(root => {
            this.printTree(depMap, root, '', new Set(), enhancedDocs);


        });
    }

    buildDependencyMap(tasks) {
        const map = new Map();
        tasks.forEach(task => {
            map.set(task.id, task.dependsOn);
        });
        return map;
    }

    findRoots(depMap) {
        const allNodes = new Set(depMap.keys());
        const allDeps = new Set([...depMap.values()].flat());
        return allDeps;
        //return [...allNodes].filter(node => !allDeps.has(node));
    }

    printTree(map, node, prefix = '', visited = new Set(), nodesToLookup) {

        let row = "";
        let nodeToWrite = nodesToLookup.filter(item => item.id === node)[0];
        if (nodeToWrite.traceId) {
            const useCase = Uri.parse(nodeToWrite.urlPath).getUseCase();
            row = `request id: ${nodeToWrite.id}, traceId: ${nodeToWrite.traceId}, responseTime: ${nodeToWrite.responseTime}, usecase: ${useCase}`;
        } else {
            row = `traceGroupId: ${nodeToWrite.traceIdGroup}`;
        }

        //console.log(prefix + row);
        visited.add(node);

        // Find all tasks that depend on this node
        const children = [...map.entries()]
            .filter(([id, deps]) => deps.includes(node) && !visited.has(id))
            .map(([id]) => id);


        if (children.length > 0) {
            let res = []
            children.forEach(child => {
                child = nodesToLookup.filter(item => item.id === child)[0];
                res.push(child);
            })

            if (res) {
                //sub-gant chart
                const Gantt = require("../misc/gantt");
                const gantt = new Gantt();
                gantt.renderGantt(res, false);
            }
        }


        //calculate aggregated stats on given level
        const stats= {
            responseTime: 0
        }

        children.forEach(child => {
            let childNode = nodesToLookup.filter(item => item.id === child)[0];
            stats.responseTime += childNode.responseTime;
        });

        //coloring of rows
        const shouldBeColored = children.length > 0;
        console.log(shouldBeColored ? chalk.green(prefix + row) : prefix + row)


        const last = children.length - 1;
        children.forEach((child, i) => {
            const isLast = i === last;
            const newPrefix = prefix + (isLast ? '└── ' : '├── ');
            //this.printTree(map, child, newPrefix + (isLast ? '    ' : '│   '), visited);
            this.printTree(map, child, newPrefix, visited, nodesToLookup);
        });
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

module.exports = Tree;