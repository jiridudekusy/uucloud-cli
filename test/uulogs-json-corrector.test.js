const correctJson = require("../src/misc/uulogs-json-corrector");

function testCorrectJson(invalidJson, expectedJson) {
  let result = correctJson(invalidJson, "message", "traceId");
  expect(result).toEqual(expectedJson);
}

test("simpletest", () => {
  testCorrectJson(`{"a": "test", "message": "value"test"", "traceId":"-"}`, `{"a": "test", "message": "value\\"test\\"", "traceId":"-"}`);
});

test("nestedjson", () => {
  testCorrectJson(`{"a": "test", "message": "message {"error":"E01"}", "traceId":"-"}`, `{"a": "test", "message": "message {\\"error\\":\\"E01\\"}", "traceId":"-"}`);
});

test("nestedjson with traceId", () => {
  testCorrectJson(`{"a": "test", "message": "message {"error":"E01", "traceId":"vjdsbv"}", "traceId":"-"}`, `{"a": "test", "message": "message {\\"error\\":\\"E01\\", \\"traceId\\":\\"vjdsbv\\"}", "traceId":"-"}`);
});

test("real life", () => {

  let testString = String.raw`{"eventTime":"2019-01-16T21:19:59.627Z","logger":"UuApp.AppWorkspace.RoleCastService","message":"Unable to verify cast existence in territory ues:UNI-BT:UNI-BT: for roles: ues:UNI-BT:USYE.LIBRA~TEAM","traceId":"329dd73714412ff4-329dd73714412ff4-218e3ed07b7ee46d-0000","processId":"-","threadId":"-","threadName":"-","resourceUri":"/usy-librag01-configuration/84723967990163610-e0ccee48af98412fa20ebc32a266ee0e/listMachineUsers","identityId":"22-5407-1","clientId":"UU.UNREGISTERED-APP","sessionId":"5b70a25a73f344ec964bafd3f1e4e657","errorId":"ecfd8221fc7f7f2a95be21aa21a71a59","stackTrace":"ecfd8221fc7f7f2a95be21aa21a71a59 ApplicationError: {\"id\":\"8f5d0b19-facd-47f0-8746-6ae8c1a16855\",\"code\":\"UU.OS/E05300.M01\",\"exceptionClass\":\"cz.ues.platform.territory.TerritorySwitchServiceRTException\",\"errorCode\":\"M01\",\"errorCodeClass\":\"cz.ues.platform.territory.TerritorySwitchServiceRTException$E05300\",\"errorMessages\":[{\"code\":\"UU.OS/E05300.M01\",\"errorCode\":\"M01\",\"errorCodeClass\":\"cz.ues.platform.territory.TerritorySwitchServiceRTException$E05300\",\"localizedMessage\":\"E05300.M01: Failed to switch to territory using UESURI \\\"ues:UNI-BT:UNI-BT:\\\". Territory is not accessible.\",\"parameters\":[\"ues:UNI-BT:UNI-BT:\"]}]}\nApplicationError: {"id":"8f5d0b19-facd-47f0-8746-6ae8c1a16855","code":"UU.OS/E05300.M01","exceptionClass":"cz.ues.platform.territory.TerritorySwitchServiceRTException","errorCode":"M01","errorCodeClass":"cz.ues.platform.territory.TerritorySwitchServiceRTException$E05300","errorMessages":[{"code":"UU.OS/E05300.M01","errorCode":"M01","errorCodeClass":"cz.ues.platform.territory.TerritorySwitchServiceRTException$E05300","localizedMessage":"E05300.M01: Failed to switch to territory using UESURI \"ues:UNI-BT:UNI-BT:\". Territory is not accessible.","parameters":["ues:UNI-BT:UNI-BT:"]}]}\n    at RemoteErrorHandler.invoke (/var/appserver/node_modules/uu_appg01_core-appclient/src/intcp/remote-error-handler.js:21:15)\n    at <anonymous>\n    at process._tickCallback (internal/process/next_tick.js:188:7)"}`

  let res = correctJson(testString, "stackTrace");
  let resObj = JSON.parse(res);
  expect(resObj).not.toBeNull();
});