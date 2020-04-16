function _transformTimeAttribute(logRecord) {
  logRecord.time = new Date(logRecord.time);
  if (!logRecord.eventTime) {
    logRecord.eventTime = logRecord.time;
  } else if (logRecord.eventTime.startsWith("[")) {
    //tomcat access logs has following format : [18/Jan/2019:09:55:40 +0100]
    try {
      logRecord.eventTime = moment(logRecord.eventTime.replace("[", "").replace("]", ""), "DD/MMM/YYYY:HH:mm:ss Z").toDate();
    } catch (e) {
      logRecord.eventTime = new Date(logRecord.time);
    }
  } else {
    //logRecord.eventTime format is 2019-01-19T12:10:06,734
    try {
      logRecord.eventTime = moment(logRecord.eventTime, "YYYY-MM-DDTHH:mm:ss,SSS").toDate();
    } catch (e) {
      logRecord.eventTime = new Date(logRecord.time);
    }
  }
  return logRecord;
}

let r = {
  time: "2019-08-23T08:00:50Z",
  eventTime: "2019-08-23 10:00:50"
};

r = _transformTimeAttribute(r);

console.log(JSON.stringify(r));

let r1 = {
  "time": "2019-08-23T10:48:12Z",
  "eventTime": "2019-08-23T12:48:11,913"

};

r1 = _transformTimeAttribute(r1);

console.log(JSON.stringify(r1));
