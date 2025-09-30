/**
 * Command Helper
 * Replicated from uu_appg01_core-npm/src/scripts/uu_cloud/misc/cmd-helper
 */
class CmdHelper {

  static buildCmdUrl(url, mainEntity) {
    return url + "?uesuri=" + mainEntity;
  }

  static buildCmd2Url(url, mainEntity, query = null) {
    url = url + "?uuUri=" + mainEntity;

    if (query) {
      query.forEach((value, key) => {
        url = url + `&${key}=${value}`;
      });
    }

    return url;
  }

  static async waitForC3Result(getResult) {
    let time = 0;

    while (true) {
      await CmdHelper.sleep(5000);
      time += 5;

      if (time > 0) {
        console.log(" ..." + time + "s");
      }

      let result = await getResult();
      let resultJson = JSON.parse(result.body);

      switch (resultJson.state) {
        case "WAITING":
        case "RUNNING":
          break;
        case "FINISHED":
          return resultJson.result;
        default:
          throw new Error("Error while waiting for C3 result:" + resultJson.result);
      }
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CmdHelper;
