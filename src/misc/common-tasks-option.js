const UESUri = require("../misc/ues-uri");
const {LoggerFactory} = require("uu_appg01_core-logging");
const {Config} = require("uu_appg01_core-utils");
const fs = require("fs");

const commonOptionsDefinitionsAuthentication = [
    {
        name: "authentication",
        alias: "a",
        type: String,
        description: "Type of user authentication. It supports browser(default, token will be obtained from browser using currectly logged user), vault(obtained from oidc-plus4u-vault), interactive(you will be asked for ac1 and ac2) and passwordFile(file with ac1 and ac2)."
    },
    {
        name: "authenticationType",
        type: String,
        description: "Type of authentication used for uuC3 and uuLogStore. It supports oidc(default), basic(http basic auth) ."
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
    },
    {
        name: "verbose",
        alias: "v",
        type: Boolean,
        description: "Display debug output"
    },
    {
        name: "passwordFile",
        type: String,
        description: "File containing ac1 and ac2. (2 lines: accessCode1=... and accessCode2=...)"
    }
];

const commonOptionsDefinitionsWithResourcePool = [
    {
        name: "resourcePool",
        alias: "r",
        type: String,
        multiple: true,
        description: "uuCloud Resource pool uri or multiple uris."
    },
    {
        name: "c3-uri",
        type: String,
        description: "Use different uuC3 than default."
    },
    ...commonOptionsDefinitionsAuthentication
];

const commonOptionsDefinitionsWithPresent = [
    {
        name: "present",
        alias: "p",
        type: String,
        description: "Named set of options."
    },
    ...commonOptionsDefinitionsWithResourcePool
];

const commonOptionsDefinitionsWithPresentAndApps = [
    ...commonOptionsDefinitionsWithPresent,
    {
        name: 'apps',
        defaultOption: true,
        multiple: true,
        description: "Definition of apps. It can be either complete appDeploymentUri(one or more), tags (one or more), asid(one or more) or start of it or any combination."
    }
]


function verifyCommonOptionsDefinitionsAuthentication(options, taskUtils) {
    if (options.verbose) {
        Config.set("log_level", "DEBUG");
        LoggerFactory.configureAll();
    } else {
        Config.set("log_level", "WARN");
        LoggerFactory.configureAll();
    }
    if (options.authentication) {
        taskUtils.testOption(["browser", "vault", "interactive", "passwordFile"].indexOf(options.authentication) > -1, "Invalid authentication.");
        if (options.authentication === "browser" || options.authentication === "passwordFile") {
            taskUtils.testOption(!options.user, `User cannot be specified for ${options.authentication} authentication.`);
        } else {
            taskUtils.testOption(options.user, `User must be specified for ${options.authentication} authentication.`);
        }
        if (options.authentication === "passwordFile") {
            taskUtils.testOption(options.passwordFile, `Password file must be specified for ${options.authentication} authentication.`);
            taskUtils.testOption(fs.existsSync(options.passwordFile), `File ${options.testOption} does not exists.`);
        }
    }
}

function verifyCommonOptionsDefinitionsWithResourcePool(options, taskUtils) {
    verifyCommonOptionsDefinitionsAuthentication(options, taskUtils);
    if (options.resourcePool) {
        if (!Array.isArray(options.resourcePool)) {
            options.resourcePool = [options.resourcePool];
        }
        options.resourcePool.forEach(r =>  taskUtils.testOption(UESUri.parse(r), "Resource pool uri must be valid UES uri."));
    }
}

function verifyCommonOptionsDefinitionsWithPresent(options, taskUtils) {
    verifyCommonOptionsDefinitionsWithResourcePool(options, taskUtils);
}

module.exports = {
    commonOptionsDefinitionsAuthentication,
    commonOptionsDefinitionsWithResourcePool,
    verifyCommonOptionsDefinitionsAuthentication,
    commonOptionsDefinitionsWithPresentAndApps,
    verifyCommonOptionsDefinitionsWithResourcePool,
    commonOptionsDefinitionsWithPresent,
    verifyCommonOptionsDefinitionsWithPresent
};
