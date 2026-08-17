// npm
import fs from "fs-extra";
import path from "node:path";
import Ajv from "ajv";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
   * @type {object}
   */
  accJsSdkOptions;

  /**
   * Default instance alias for this project, if set in acc.config.json.
   * @type {string | undefined}
   */
  alias;

  /**
   * True when init() just created the config file from the template.
   * @type {boolean}
   */
  createdFromTemplate = false;

  /**
   * @type {string}
   */
  templateDir = path.join(__dirname, "templates");

  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * the file path to the config JSON file, set in init
   * @type {string}
   */
  configPath;

  /**
   * @type {Ajv}
   */
  ajv;

  /**
   * @type {string}
   */
  ajvSchema;

  /**
   *
   */
  ajvValidate;

  /**
   *
   * @param {AioLogger} logger
   * @param {string} defaultConfigPath
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
   * Initializes the configuration.
   * @param {string} configPath
   * @throws {CONFIG_INIT_CONFIG_PATH_MISSING, CONFIG_PARSE_ERROR, CONFIG_VALIDATE_ERRORS}
   */
  init(configPath) {
    if (!configPath) {
      throw new CONFIG_INIT_CONFIG_PATH_MISSING();
    }
    // use default config path if configPath is not provided, otherwise use the provided one
    if (
      configPath === this.defaultConfigPath &&
      !this.fileExists(this.defaultConfigPath)
    ) {
      this.logger.info(`🛠️ Config not found, initializing ${configPath}`);
      this.copyTemplateTo("acc.config.json", this.defaultConfigPath);
      this.createdFromTemplate = true;
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
   * Seeds the project alias into a freshly created config file, to avoid
   * re-typing --alias on subsequent runs. No-op if the file pre-existed or
   * already has an alias, so an existing manifest is never overwritten.
   * @param {string} alias
   */
  seedAlias(alias) {
    if (!this.createdFromTemplate || this.alias || !alias) {
      return;
    }
    const configJson = fs.readJsonSync(this.configPath);
    configJson.alias = alias;
    fs.writeJsonSync(this.configPath, configJson, { spaces: 2 });
    this.alias = alias;
    this.logger.info(`🌱 Seeded alias "${alias}" into ${this.configPath}`);
  }

  /**
   * Copy template file from /tenplates/ to destination path
   * @param {string} filename
   * @param {string} destinationPath
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
    return content.toString();
  }
}

export default CampaignConfig;
