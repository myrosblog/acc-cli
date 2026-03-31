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
   * @type {String}
   */
  templateDir = path.join(__dirname, "templates");

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
      this.copyTemplateTo("acc.config.json", this.defaultConfigPath);
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

  /**
   * Copy template file from /tenplates/ to destination path
   * @param {String} filename
   * @param {String} destinationPath
   */
  copyTemplateTo(filename, destinationPath) {
    fs.copySync(path.join(this.templateDir, filename), destinationPath);
  }

  /**
   * Controller for "acc instance template"
   * Currently only supports returning the content of the input file
   * @returns 
   */
  template() {
    console.log(`📄 Returning template content for acc.config.json from ${this.templateDir}`);
    const filename = "acc.config.json";
    const content = fs.readFileSync(path.join(this.templateDir, filename));
    console.log(content.toString());}
}

export default CampaignConfig;
