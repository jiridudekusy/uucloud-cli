const currentDir = process.cwd();
const LogsTask = require("./tasks/logs");
const PsTask = require("./tasks/ps");
const UseTask = require("./tasks/use");
const AppboxTask = require("./tasks/appbox");
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");


const sections = [
  {
    header: "uuCloud CLI",
    content: "Execute various operations on uuCloud using CLI."
  },
  {
    header: "Synopsis",
    content: "$ uucloud <command> <command parameters>"
  },
  {
    header: "Command List",
    content: [
      { name: "help", summary: "Display this help." },
      { name: "use", summary: "Sets up default parameter values." },
      { name: "ps", summary: "Displays list of deployed uuApps." },
      { name: "logs", summary: "Fetch the logs of one or more uuApps" },
      { name: "appbox", summary: "Creates or updates appbox."}
    ]
  }
];

async function execute() {

  const mainDefinitions = [
    {name: "command", defaultOption: true}
  ];

  const mainOptions = commandLineArgs(mainDefinitions, {stopAtFirstUnknown: true});
  const argv = mainOptions._unknown || [];
  let task;
  let opts = {currentDir};
  if (mainOptions.command === "ps") {
    task = new PsTask(opts);
  } else if (mainOptions.command === "logs") {
    task = new LogsTask(opts);
  } else if(mainOptions.command === "use"){
    task = new UseTask(opts);
  } else if(mainOptions.command == "appbox"){
    task = new AppboxTask(opts);
  }

  if (!task) {
    console.error("Unknown command");
    const usage = commandLineUsage(sections);
    console.log(usage);
    return;
  }

  await task.execute(argv);
}

module.exports = execute;


