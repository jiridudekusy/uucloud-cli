const uesUriRegexp = /^ues:(?<ter_code>[\w\d\.\-]*?)?(\[(?<ter_oid>[\w\d]*?)?\])?:(?<art_code>[\w\d\.\-]*?)?(\[(?<art_oid>[\w\d]*?)?\])?(:(?<obj_code>[\w\d\.\-]*?)?(\[(?<obj_oid>[\w\d]*?)?\])?)?$/;

class UESUri {

  static parse(uesuri) {
    let matcher = uesUriRegexp.exec(uesuri);
    if (matcher) {
      matcher = matcher;
      let uesUriObj = new UESUri();
      uesUriObj.territory = {
        code: matcher.groups.ter_code,
        id: matcher.groups.ter_oid
      };
      if (!uesUriObj.territory.code && !uesUriObj.territory.id) {
        return null;
      }
      uesUriObj.artifact = {
        code: matcher.groups.art_code,
        id: matcher.groups.art_oid
      };
      if (!uesUriObj.artifact.code && !uesUriObj.artifact.id) {
        return null;
      }
      uesUriObj.object = {
        code: matcher.groups.obj_code,
        id: matcher.groups.obj_oid
      };
      return uesUriObj;
    }
  }

}

module.exports = UESUri;