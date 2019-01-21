function correctJson(json, invalidAttribute, followingAttribute) {
  let regExp
  if (invalidAttribute && followingAttribute) {
    regExp = new RegExp(`"${invalidAttribute}"\\s*:\\s*"(?<value>.*)"\\s*,\\s*"${followingAttribute}"`);
  } else if (invalidAttribute) {
    regExp = new RegExp(`"${invalidAttribute}"\\s*:\\s*"(?<value>.*)"\\s*}`);
  }
  return json.replace(regExp, (match, value) => {
    let fixedValue = value.replace(/([^\\])"/g, (match, g1) => g1 + "\\\"");
    return match.replace(value, fixedValue);
  });
}

module.exports = correctJson;