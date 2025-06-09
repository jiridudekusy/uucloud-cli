function getAppConfig(subAppDeployment, ...keys) {
    // For business territory apps, we don't have uuAppServerEnvironment
    if (subAppDeployment.source === 'business-territory') {
        return undefined;
    }
    
    let config = subAppDeployment.uuAppServerEnvironment;
    let value;
    for (const key of keys) {
        if (value === undefined || value === null) {
            value = config?.[key];
        }
    }
    return value;
}

module.exports = {
    getAppConfig
};