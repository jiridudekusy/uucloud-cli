function renderTreeString(task, prefix = '', isLast = true) {
    const connector = isLast ? '└─ ' : '├─ ';
    let result = prefix + connector + `${task.group}|${task.name || "root"} (${task.duration}ms)\n`;

    if (task.items && task.items.length > 0) {
        const newPrefix = prefix + (isLast ? '   ' : '│  ');
        task.items.forEach((child, i) => {
            const lastChild = i === task.items.length - 1;
            result += renderTreeString(child, newPrefix, lastChild);
        });
    }
   return result;
}


module.exports = {
    renderTreeString
};