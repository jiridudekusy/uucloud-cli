function getAppConfig(subAppDeployment, ...keys) {
    let config = subAppDeployment.uuAppServerEnvironment;
    let value;
    for (const key of keys) {
        if (value === undefined || value === null) {
            value = config[key];
        }
    }
    return value;
}

module.exports = {
    getAppConfig
};