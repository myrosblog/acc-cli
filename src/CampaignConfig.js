import fs from "fs-extra";
import path from "node:path";

class CampaignConfig {
  /**
   * @type {Array<Object}
   */
  schemas;

  /**
   * @type {Object}
   */
  accJsSdkOptions;

  /**
   *
   * @param {*} defaultConfigPath
   * @param {*} dirPackage
   */
  constructor(defaultConfigPath, dirPackage) {
    this.defaultConfigPath = defaultConfigPath;
    this.dirPackage = dirPackage;
  }

  init(configPath) {
    if (
      configPath == this.defaultConfigPath &&
      !this.fileExists(this.defaultConfigPath)
    ) {
      console.log(`🛠️ Config not found, initialializing ${configPath}`);
      fs.copySync(
        path.join(this.dirPackage, "config", "acc.config.json"),
        this.defaultConfigPath,
      );
    } else {
      console.log(`🛠️ Using config ${configPath}`);
    }
    const configJson = JSON.parse(fs.readFileSync(configPath));
    this.schemas = configJson.schemas || [];
    this.accJsSdkOptions = configJson['acc-js-sdk'] || {};
  }

  fileExists(path) {
    return fs.existsSync(path);
  }
}

export default CampaignConfig;
