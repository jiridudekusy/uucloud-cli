const currentDir = process.cwd();
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
const Config = require("./misc/config");
const { parseArgsStringToArgv } = require('string-argv');
const container = require('./di/container-setup');
const fs = require('fs');
const path = require('path');

// Function to escape Handlebars templates and other special characters in text
function escapeSpecialChars(text) {
  return text.replace(/([\\{}"])/g, "\\$1");
}

const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    process.stdin.pause()
    resolve()
  }))
}

// Function to read release notes from README.md
const getReleaseNotes = () => {
  try {
    const readmePath = path.join(__dirname, '..', 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');
    
    // Extract the release notes section
    const releaseNotesSection = readme.split('# Release Notes')[1];
    if (!releaseNotesSection) return 'Release notes not found';
    
    return releaseNotesSection.trim();
  } catch (error) {
    return `Error reading release notes: ${error.message}`;
  }
};

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
      { name: 'logs', summary: 'Fetch the logs of one or more uuApps' },
      { name: 'i', summary: 'Interactive mode for selecting and operating on deployed uuApps' },
      { name: 'execute', summary: 'Execute a command with a specified command path and dtoIn.' }
    ]
  },
  {
    header: 'Global Options',
    optionList: [
      {
        name: 'version',
        description: 'Display CLI version information.',
        type: Boolean
      },
      {
        name: 'release-notes',
        description: 'Display release notes from README.md (--releaseNotes is also supported).',
        type: Boolean
      }
    ]
  }
];

async function execute() {
  const console = container.get('console');
  
  // Determine the appropriate distTag for update checking
  const currentVersion = pkg.version;
  // A simple check to see if the version string indicates a pre-release (e.g., "1.2.3-beta.0")
  // For more complex semver handling, a dedicated library like 'semver' could be used.
  const isBeta = currentVersion.includes('beta');
  // Use 'beta' for beta pre-releases.
  // Otherwise, use the default 'latest' for stable releases.
  const distTagToUse = isBeta ? 'beta' : 'latest';

  let notifier = updateNotifier({
    pkg,
    distTag: distTagToUse
  });

  // Notify the user if an update is available, the process is running in an interactive terminal,
  // and the current version is different from the latest version.
  if(notifier.update && process.stdout.isTTY && notifier.update.current !== notifier.update.latest){
    notifier.notify({isGlobal: true, defer: false});
    console.error("Press any key to continue...");
    await keypress();
  }

  const mainDefinitions = [
    {name: 'command', defaultOption: true},
    {name: 'version', type: Boolean, description: 'Display CLI version information.'},
    {name: 'release-notes', type: Boolean, description: 'Display release notes from README.md'}
  ];

  // Convert any camelCase arguments to kebab-case for consistent parsing
  const TaskUtils = require('./misc/task-utils');
  const normalizedArgs = TaskUtils.normalizeArguments(process.argv.slice(2));

  let mainOptions = commandLineArgs(mainDefinitions, {
    argv: normalizedArgs,
    stopAtFirstUnknown: true
  });
  
  // Check if version flag is provided
  if (mainOptions.version) {
    console.log(pkg.version);
    return;
  }
  
  // Check if release-notes flag is provided
  if (mainOptions['release-notes']) {
    console.log(getReleaseNotes());
    return;
  }
  
  let CommandClass;
  let argv = mainOptions._unknown || [];
  let shortcuts = Config.all.shortcuts || [];
  
  if(shortcuts.length > 0) {
    sections.push({
      header: 'Shortcuts',
      content: shortcuts.map(s => {return {name: s.shortcut, summary: escapeSpecialChars(s.command)}})
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
    CommandClass = require('./commands/UseCommand'); 
  } else if(mainOptions.command === "i"){
    CommandClass = require('./commands/InteractiveCommand');
  } else if(mainOptions.command === "execute"){
    CommandClass = require('./commands/ExecuteCommand');
  }

  if (!CommandClass) {
    console.error("Unknown command");
    const usage = commandLineUsage(sections);
    console.error(usage);
    return;
  }

  try {
    // All commands now use the modern Command pattern with DI
    const command = container.createCommand(CommandClass);
    await command.execute(argv);
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    console.error(error.stack);
  }
}

module.exports = execute;


