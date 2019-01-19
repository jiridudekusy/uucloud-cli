const relativeTimeRegexp = /^(?<amount>\d+)(?<unit>[mh])$/;

function parseRelativeDateTime(expression, refDate) {
  refDate = new Date(refDate);
  try {
    let timestamp = Date.parse(expression);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
  } catch (e) {
  }

  let matcher = relativeTimeRegexp.exec(expression);
  if (matcher) {
    let amount = matcher.groups.amount;
    if(matcher.groups.unit === "m"){
      refDate.setMinutes(refDate.getMinutes()-amount);
    }
    if(matcher.groups.unit === "h"){
      refDate.setHours(refDate.getHours()-amount);
    }
    return refDate;
  }
}

module.exports = parseRelativeDateTime;