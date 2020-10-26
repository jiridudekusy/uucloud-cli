function filterAppDeployments(deployList, appsIdentifiers) {
  let filteredApps = deployList.pageEntries.filter(app => {
    if(!appsIdentifiers){
      return true;
    }
    //if user specified whole deployment uri
    if (appsIdentifiers.indexOf(app.uri) > -1) {
      return true;
    }
    if (app.asid && appsIdentifiers.filter(appId => app.asid.startsWith(appId)).length > 0) {
      return true;
    }
    if (app.config.deploymentTimeConfig && app.config.deploymentTimeConfig.tags) {
      let appTags = app.config.deploymentTimeConfig.tags.split(",");
      let matchedIdentifiers = appsIdentifiers.map(id => id.split(",")).filter(tags => {
        for (let tag of tags) {
          if (!appTags.includes(tag)) {
            return false;
          }
        }
        return true;
      });
      if (matchedIdentifiers.length > 0) {
        return true;
      }
    }
    return false;
  });
  return filteredApps;
}

module.exports = {
  filterAppDeployments
}
