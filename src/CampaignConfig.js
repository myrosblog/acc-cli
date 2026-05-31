// npm
import fs from "fs-extra";
import path from "node:path";
import Ajv from "ajv";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// sdk
import AioLogger from "@adobe/aio-lib-core-logging";
// acc
import { codes } from "./helpers/AccErrors.js";
const {
  CONFIG_CONSTR_DEFAULT_PATH_MISSING,
  CONFIG_INIT_CONFIG_PATH_MISSING,
  CONFIG_PARSE_ERROR,
  CONFIG_VALIDATE_ERRORS,
} = codes;

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
   * Default instance alias for this project, if set in acc.config.json.
   * @type {String|undefined}
   */
  alias;

  /**
   * @type {String}
   */
  templateDir = path.join(__dirname, "templates");

  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * the file path to the config JSON file, set in init
   * @type {String}
   */
  configPath;

  /**
   * @type {Ajv}
   */
  ajv;

  /**
   * @type {String}
   */
  ajvSchema;

  /**
   *
   */
  ajvValidate;

  /**
   *
   * @param {*} defaultConfigPath
   * @throws {CONFIG_CONSTR_DEFAULT_PATH_MISSING}
   */
  constructor(logger, defaultConfigPath) {
    if (!defaultConfigPath || typeof defaultConfigPath !== "string") {
      throw new CONFIG_CONSTR_DEFAULT_PATH_MISSING();
    }
    this.logger = logger;
    this.defaultConfigPath = defaultConfigPath;
    this.ajv = new Ajv();
    this.ajvSchema = fs.readJsonSync(
      path.join(__dirname, "validators", "accConfig.json"),
    );
    this.ajvValidate = this.ajv.compile(this.ajvSchema);
  }

  /**
   *
   * @param {*} configPath
   * @throws {CONFIG_INIT_CONFIG_PATH_MISSING, CONFIG_PARSE_ERROR, CONFIG_VALIDATE_ERRORS}
   */
  init(configPath) {
    if (!configPath) {
      throw new CONFIG_INIT_CONFIG_PATH_MISSING();
    }
    // use default config path if configPath is not provided, otherwise use the provided one
    if (
      configPath == this.defaultConfigPath &&
      !this.fileExists(this.defaultConfigPath)
    ) {
      this.logger.info(`🛠️ Config not found, initializing ${configPath}`);
      this.copyTemplateTo("acc.config.json", this.defaultConfigPath);
    } else {
      this.logger.info(`🛠️ Using config ${configPath}`);
    }
    // parse the config
    let configJson;
    try {
      configJson = fs.readJsonSync(configPath);
    } catch (error) {
      throw new CONFIG_PARSE_ERROR({ messageValues: [error.message] });
    }
    // validate the config
    const isValid = this.ajvValidate(configJson);
    if (!isValid) {
      throw new CONFIG_VALIDATE_ERRORS({
        messageValues: [this.ajv.errorsText(this.ajvValidate.errors)],
      });
    }
    // OK
    this.schemas = configJson.schemas || [];
    this.accJsSdkOptions = configJson["acc-js-sdk"] || {};
    this.alias = configJson.alias;
    this.configPath = configPath;
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
    this.logger.info(
      `📄 Returning template content for acc.config.json from ${this.templateDir}`,
    );
    const filename = "acc.config.json";
    const content = fs.readFileSync(path.join(this.templateDir, filename));
    this.logger.info(content.toString());
  }
}

export default CampaignConfig;
