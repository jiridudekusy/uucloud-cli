const currentDir = process.cwd();
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
const Config = require("./misc/config");
const { parseArgsStringToArgv } = require('string-argv');
const container = require('./di/container-setup');

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
  const console = container.get('console');
  
  let notifier = updateNotifier({pkg});
  if(notifier.update && process.stdout.isTTY && notifier.update.current != notifier.update.latest){
    notifier.notify({isGlobal: true, defer: false});
    console.error("Press any key to continue...");
    await keypress();
  }

  const mainDefinitions = [
    {name: 'command', defaultOption: true}
  ];

  let mainOptions = commandLineArgs(mainDefinitions, {stopAtFirstUnknown: true});
  let CommandClass;
  let argv = mainOptions._unknown || [];
  let shortcuts = Config.all.shortcuts || [];
  
  if(shortcuts.length > 0) {
    sections.push({
      header: 'Shortcuts',
      content: shortcuts.map(s => {return {name: s.shortcut, summary: s.command}})
    });
  }
  
  // Check if there's a --no-shortcut option to disable shortcut processing
  const disableShortcuts = argv.includes('--no-shortcut');
  if (disableShortcuts) {
    // Remove the --no-shortcut argument
    argv = argv.filter(arg => arg !== '--no-shortcut');
    mainOptions._unknown = argv;
  } else {
    let shortcut = shortcuts.find(i => i.shortcut === mainOptions.command);
    if(shortcut){
      let parsedShortcut = parseArgsStringToArgv(shortcut.command);
      mainOptions = commandLineArgs(mainDefinitions, {stopAtFirstUnknown: true, argv: [...parsedShortcut, ...(mainOptions._unknown||[])]})
    }
  }
  
  argv = mainOptions._unknown || [];
  
  // Determine which command to use
  if (mainOptions.command === "ps") {
    CommandClass = require('./commands/PsCommand');
  } else if (mainOptions.command === "logs") {
    CommandClass = require('./commands/LogsCommand');
  } else if(mainOptions.command === "use"){
    CommandClass = require('./tasks/use');
  } else if(mainOptions.command === "i"){
    CommandClass = require('./tasks/interactive');
  }

  if (!CommandClass) {
    console.error("Unknown command");
    const usage = commandLineUsage(sections);
    console.error(usage);
    return;
  }

  try {
    // Check if it's a new Command implementation
    if (CommandClass.prototype && CommandClass.prototype.constructor && CommandClass.prototype instanceof require('./interfaces/Command')) {
      const command = container.createCommand(CommandClass);
      await command.execute(argv);
    } else {
      // Legacy task execution
      const task = new CommandClass({currentDir});
      await task.execute(argv);
    }
  } catch (error) {
    console.error(`Error executing command: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

module.exports = execute;


