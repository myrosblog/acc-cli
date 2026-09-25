// npm
import fs from "fs-extra";
import path from "node:path";
import Ajv from "ajv";
import hjson from "hjson";
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

/**
 * Name of the project config file (and the name to its template)
 * @type {string}
 */
export const CONFIG_FILENAME = "acc.config.json";

class CampaignConfig {
  /**
   * @type {Array<object>}
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
   * Compiled AJV validator instance for acc.config.json schema.
   * @type {Function}
   */
  ajvValidate;

  /**
   * Creates a new CampaignConfig instance.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {string} defaultConfigPath - Default path to the acc.config.json file
   * @throws {CONFIG_CONSTR_DEFAULT_PATH_MISSING} Thrown if defaultConfigPath is missing or invalid
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
   * @param {string} configPath the path to the acc.config.json file
   * @param {string} [aliasToSeed] alias written into the config when it is created from the template
   * @returns {void}
   * @throws {CONFIG_INIT_CONFIG_PATH_MISSING|CONFIG_PARSE_ERROR|CONFIG_VALIDATE_ERRORS}
   */
  init(configPath, aliasToSeed) {
    if (!configPath) {
      throw new CONFIG_INIT_CONFIG_PATH_MISSING();
    }
    // use default config path if configPath is not provided, otherwise use the provided one
    if (
      configPath === this.defaultConfigPath &&
      !this.fileExists(this.defaultConfigPath)
    ) {
      this.logger.info(`🛠️ Config not found, initializing ${configPath}`);
      fs.writeFileSync(
        this.defaultConfigPath,
        this.renderTemplate(aliasToSeed),
      );
      if (aliasToSeed) {
        this.logger.info(`🌱 Seeded alias "${aliasToSeed}" into ${configPath}`);
      }
    } else {
      this.logger.info(`🛠️ Using config ${configPath}`);
    }
    let configJson;
    try {
      configJson = hjson.parse(fs.readFileSync(configPath, "utf8"));
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

  /**
   * Checks if a file exists at the given path.
   * @param {string} path - the file path to check
   * @returns {boolean} true if the file exists
   */
  fileExists(path) {
    return fs.existsSync(path);
  }

  /**
   * Returns the acc.config.json template text.
   * When an alias is provided, placeholder line is uncommented with its value.
   * @param {string} [alias] the alias to write in place of the placeholder
   * @returns {string} the template content
   */
  renderTemplate(alias) {
    const content = fs.readFileSync(
      path.join(this.templateDir, CONFIG_FILENAME),
      "utf8",
    );
    if (!alias) {
      return content;
    }
    // a replacer function, so "$" in the alias is not read as a replacement pattern
    return content.replace(
      '// "alias": "staging",',
      () => `"alias": ${JSON.stringify(alias)},`,
    );
  }

  /**
   * Controller for "acc instance template"
   * Currently only supports returning the content of the input file
   * @returns {string} The template file content as a string
   */
  template() {
    this.logger.info(
      `📄 Returning template content for ${CONFIG_FILENAME} from ${this.templateDir}`,
    );
    return this.renderTemplate();
  }
}

export default CampaignConfig;
