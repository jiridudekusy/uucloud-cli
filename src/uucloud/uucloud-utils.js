function filterAppDeployments(deployList, appsIdentifiers) {
    let filteredApps = deployList.filter(app => {
        if (!appsIdentifiers) {
            return true;
        }
        //if user specified whole deployment uri
        if (appsIdentifiers.indexOf(app.uri) > -1) {
            return true;
        }
        if (appsIdentifiers.some(appId => 
            (app.asid && app.asid.startsWith(appId)) || 
            (app.code && app.code.includes(appId))
        )) {
            return true;
        }

        let appTags = app.tags || [];
        let matchedIdentifiers = appsIdentifiers.map(id => id.split(",")).filter(tags => {
            for (let tag of tags) {
                if (!appTags.includes(tag) && !app.code?.includes(tag)) {
                    return false;
                }
            }
            return true;
        });
        if (matchedIdentifiers.length > 0) {
            return true;
        }

        return false;
    });
    return filteredApps;
}

module.exports = {
    filterAppDeployments
}
