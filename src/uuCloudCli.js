const currentDir = process.cwd();
const LogsTask = require("./tasks/logs");
const PsTask = require("./tasks/ps");
const UseTask = require("./tasks/use");
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
const Config = require("./misc/config");
const { parseArgsStringToArgv } = require('string-argv');

const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    process.stdin.pause()
    resolve()
  }))
}

const sections = [
  {
    header: "uuCloud CLI",
    content: "Execute various operations on uuCloud using CLI."
  },
  {
    header: 'Synopsis',
    content: '$ uucloud <command> <command parameters>'
  },
  {
    header: 'Command List',
    content: [
      { name: 'help', summary: 'Display this help.' },
      { name: 'use', summary: 'Sets up default parameter values.' },
      { name: 'ps', summary: 'Displays list of deployed uuApps.' },
      { name: 'logs', summary: 'Fetch the logs of one or more uuApps' }
    ]
  }
];

async function execute() {
  let notifier = updateNotifier({pkg});
  if(notifier.update && process.stdout.isTTY && notifier.update.current != notifier.update.latest){
    notifier.notify({isGlobal: true, defer: false});
    console.error("Press any key to continue...");
    await keypress();
  };

  const mainDefinitions = [
    {name: 'command', defaultOption: true}
  ];

  let mainOptions = commandLineArgs(mainDefinitions, {stopAtFirstUnknown: true});
  let task;
  let opts = {currentDir};
  let shortcuts = Config.all.shortcuts || [];
  if(shortcuts.length > 0) {
    sections.push({
      header: 'Shortcuts',
      content: shortcuts.map(s => {return {name: s.shortcut, summary: s.command}})
    });
  }
  let shortcut = shortcuts.find(i => i.shortcut === mainOptions.command);
  if(shortcut){
    let parsedShortcut = parseArgsStringToArgv(shortcut.command);
    mainOptions = commandLineArgs(mainDefinitions, {stopAtFirstUnknown: true, argv: [...parsedShortcut, ...(mainOptions._unknown||[])]})
  }
  const argv = mainOptions._unknown || [];
  if (mainOptions.command === "ps") {
    task = new PsTask(opts);
  } else if (mainOptions.command === "logs") {
    task = new LogsTask(opts);
  } else if(mainOptions.command === "use"){
    task = new UseTask(opts);
  }

  if (!task) {
    console.error("Unknown command");
    const usage = commandLineUsage(sections);
    console.error(usage);
    return;
  }

  await task.execute(argv);
}

module.exports = execute;


