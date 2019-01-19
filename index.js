#!/usr/bin/env node
// to enable mocks
// process.env["CONFIG_PROFILE"] = "development-mocks";
process.env["CONFIG_PROFILE"] = "development";
const uuCloudCli = require("./src/uuCloudCli");


uuCloudCli()
.then(() => {
}).catch(e => {
  console.log(`Error in application : ${e.stack}`);
});