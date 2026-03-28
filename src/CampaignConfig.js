// npm
import fs from "fs-extra";
import path from "node:path";
import Ajv from "ajv";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// acc
import CampaignError from "./CampaignError.js";

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
   */
  constructor(defaultConfigPath) {
    if (!defaultConfigPath || typeof defaultConfigPath !== "string") {
      throw new CampaignError(
        "defaultConfigPath is required for new CampaignAuth().",
      );
    }
    this.defaultConfigPath = defaultConfigPath;
  }

  init(configPath) {
    if (!configPath) {
      throw new CampaignError("configPath required for CampaignConfig.init");
    }
    if (
      configPath == this.defaultConfigPath &&
      !this.fileExists(this.defaultConfigPath)
    ) {
      console.log(`🛠️ Config not found, initializing ${configPath}`);
      fs.copySync(
        path.join(__dirname, "..", "config", "acc.config.json"),
        this.defaultConfigPath,
      );
    } else {
      console.log(`🛠️ Using config ${configPath}`);
    }
    const configJson = JSON.parse(fs.readFileSync(configPath));
    this.schemas = configJson.schemas || [];
    this.accJsSdkOptions = configJson["acc-js-sdk"] || {};
  }

  /**
   * @throws {CampaignError} when not valid
   */
  validate() {
    const ajv = new Ajv();
    const validatorAccConfigFile = fs.readFileSync(
      path.join(__dirname, "validators", "accConfig.json"),
    );
    const validatorAccConfig = JSON.parse(validatorAccConfigFile);
    const validate = ajv.compile(validatorAccConfig);
    const isValid = validate(this);
    if (!isValid) {
      throw new Error(
        `Invalid config for "schemas": ${ajv.errorsText(validate.errors)}`,
      );
    }
  }

  fileExists(path) {
    return fs.existsSync(path);
  }
}

export default CampaignConfig;
