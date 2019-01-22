const UESUri = require("../misc/ues-uri");

const commonOptionsDefinitionsAuthentication = [
  {
    name: "authentication",
    alias: "a",
    type: String,
    description: "Type of user authentication. It supports browser(default, token will be obtained from browser using currectly logged user), vault(obtained from oidc-plus4u-vault), interactive(you will be asked for ac1 and ac2)."
  },
  {
    name: "user",
    alias: "u",
    type: String,
    description: "User that will be used for all commands. It must be be specified for vault and interactive authentication. Please note taht the user must be authorized to do the uuCloud/uuLogstore commands. "
  },
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Displays this help."
  }
];

const commonOptionsDefinitionsWithResourcePool = [
  {
    name: "resourcePool",
    alias: "r",
    type: String,
    description: "uuCloud Resource pool uri."
  },
  ...commonOptionsDefinitionsAuthentication
];

function verifyCommonOptionsDefinitionsAuthentication(options, taskUtils){
  if (options.authentication) {
    taskUtils.testOption(["browser", "vault", "interactive"].indexOf(options.authentication) > -1, "Invalid authentication.");
    if (options.authentication === "browser") {
      taskUtils.testOption(!options.user, "User cannot be specified for browser authentication.");
    } else {
      taskUtils.testOption(options.user, `User must be specified for ${options.authentication} authentication.`);
    }
  }
}

function verifyCommonOptionsDefinitionsWithResourcePool(options, taskUtils){
  verifyCommonOptionsDefinitionsAuthentication(options, taskUtils);
  if (options.resourcePool) {
    taskUtils.testOption(UESUri.parse(options.resourcePool), "Resource pool uri must be valid UES uri.");
  }
}



module.exports = {
  commonOptionsDefinitionsAuthentication,
  commonOptionsDefinitionsWithResourcePool,
  verifyCommonOptionsDefinitionsAuthentication,
  verifyCommonOptionsDefinitionsWithResourcePool
};
