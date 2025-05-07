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
        name: "oidc-uri",
        type: String,
        description: "Use different OIDC server than default."
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
        name: "insecure",
        alias: "k",
        type: Boolean,
        description: "Allow insecure server connections"
    },
    {
        name: "cacert",
        type: String,
        description: "Extra CA certificates to verify peer against"
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
        description: "uuCloud Resource pool oid/uri or multiple oids/uris."
    },
    {
        name:"universe-uri",
        type: String,
        description: "Use uuCloudUniverse (instead of uuCloudg01)."
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
    
    // Handle insecure flag by setting NODE_TLS_REJECT_UNAUTHORIZED env variable
    if (options.insecure) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        // Also set uu_app_client_verify_ssl to false
        Config.set("uu_app_client_verify_ssl", false);
        console.error("Warning: Using --insecure flag. SSL certificate validation is disabled.");
    }
    
    // Handle cacert option by setting the NODE_EXTRA_CA_CERTS environment variable
    if (options.cacert) {
        // Check if the file exists
        if (!fs.existsSync(options.cacert)) {
            throw new Error(`CA certificate file not found: ${options.cacert}`);
        }
        process.env.NODE_EXTRA_CA_CERTS = options.cacert;
        console.error(`Using extra CA certificates from: ${options.cacert}`);
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
        if(options["universe-uri"]){

        }else {
            options.resourcePool.forEach(r => taskUtils.testOption(UESUri.parse(r), "Resource pool uri must be valid UES uri."));
        }
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
