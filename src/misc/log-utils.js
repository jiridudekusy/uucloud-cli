const {AppClient} = require("uu_appg01_core-appclient");
const {Uri} = require("uu_appg01_core-uri");

async function getLogAccessAttributes(workspaceUri, tokenProvider) {
    try {
        const token = typeof tokenProvider === 'string' 
            ? tokenProvider 
            : await tokenProvider.refresh();
        
        const commandUri = Uri.createBuilder().parse(workspaceUri)
            .setUseCase("sys/uuAppWorkspace/getLogAccessAttributes")
            .clearParameters().toUri();
        const headers = {Authorization: `${token}`};
        
        const result = await AppClient.get(commandUri.toString(), {}, {headers});
        return result.data;
    } catch (error) {
        if (error.dtoOut) {
            console.error(JSON.stringify(error.dtoOut, null, 2));
        }
        console.error(`Failed to get log access attributes: ${error.message}`);
        return null;
    }
}

function extractLogCriteriaFromUri(logDataUri) {
    if (!logDataUri) return {};
    
    try {
        const url = new URL(logDataUri);
        const params = url.searchParams;
        
        const criteria = {};
        
        for (const [key, value] of params.entries()) {
            criteria[key] = value;
        }
        
        return criteria;
    } catch (error) {
        console.error(`Failed to extract criteria from logDataUri: ${error.message}`);
        return {};
    }
}

module.exports = {
    getLogAccessAttributes,
    extractLogCriteriaFromUri
}; 