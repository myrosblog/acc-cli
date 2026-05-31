// sdk
import { ConnectionParameters } from "@adobe/acc-js-sdk/src/client.js";
import AioLogger from "@adobe/aio-lib-core-logging";
// acc
import { codes, wrapSdkError } from "./helpers/AccErrors.js";
const {
  AUTH_CONSTR_SDK_MISSING,
  AUTH_INIT_EXISTING_ALIAS,
  AUTH_LOGIN_ALIAS_MISSING,
  AUTH_LOGIN_ALIAS_EMPTY,
  AUTH_LOGIN_ALIAS_INVALID,
  AUTH_LOGIN_SDK_CONNECTIONPARAMETERS_FAILED,
  AUTH_LOGIN_SDK_INIT_FAILED,
  AUTH_LOGIN_SDK_LOGON_FAILED,
  AUTH_LOGIN_SDK_SERVERINFO_FAILED,
  AUTH_LOGIN_SDK_SERVERINFO_EMPTY,
} = codes;
import SdkAdapter from "./adapters/SdkAdapter.js";
import AioConfigAdapter from "./adapters/AioConfigAdapter.js";
import AccCache from "./helpers/AccCache.js";

/**
 * Campaign CLI class for managing ACC (Campaign Classic) instances.
 * Provides authentication, instance management, and connection capabilities.
 *
 * @class CampaignAuth
 * @classdesc Main class for interacting with ACC instances
 */
class CampaignAuth {
  /**
   * @type {string}
   */
  configKey = "acc.auth";

  /**
   * Configuration key for storing instances
   * @type {string}
   * @private
   */
  INSTANCES_KEY = "instances";

  /**
   * @type {ConnectionParameters}
   */
  connectionParameters;

  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @param {AioConfigAdapter} config Adobe I/O Core Config API for accessing configuration
   */
  config;

  /**
   * Creates a new CampaignAuth instance.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Object} sdk - Raw ACC JS SDK instance
   * @param {AioConfigAdapter} config - Adobe I/O Core Config API instance
   * @throws {AUTH_CONSTR_SDK_MISSING} Throws if SDK or auth parameters are missing
   *
   * @example
   * const auth = new CampaignAuth(sdk, auth);
   */
  constructor(logger, sdk, config) {
    if (!sdk) {
      throw new AUTH_CONSTR_SDK_MISSING();
    }
    this.config = new AioConfigAdapter(config);
    this.config.reload();
    this.logger = logger;
    this.sdk = new SdkAdapter(sdk);
    this.instances =
      this.config.get(`${this.configKey}.${this.INSTANCES_KEY}`) || {};
    this.instanceIds = Object.keys(this.instances);
  }

  async ip() {
    this.logger.info(`Fetching IP address...`);
    const ip = await this.sdk.ip();
    this.logger.info(ip);
    return ip;
  }

  /**
   * Initializes a new ACC instance with the provided credentials.
   *
   * @param {Object} options - Initialization options
   * @param {string} options.alias - Local alias for this instance (e.g., 'prod', 'staging')
   * @param {string} options.host - URL of ACC root (e.g., 'http://localhost:8080')
   * @param {string} options.user - Operator username
   * @param {string} options.password - Operator password
   * @returns {Promise<void>} Resolves when instance is initialized and logged in
   * @throws {AUTH_INIT_EXISTING_ALIAS} Throws if instance with alias already exists
   *
   * @example
   * await auth.init({
   *   alias: 'prod',
   *   host: 'http://localhost:8080',
   *   user: 'admin',
   *   pass: 'password'
   * });
   */
  async init(authOptions, sdkOptions, cliOptions) {
    if (this.instanceIds.includes(authOptions.alias)) {
      throw new AUTH_INIT_EXISTING_ALIAS();
    }
    const { alias, host, user, pass } = authOptions;
    const storedInstance = {
      host,
      user,
      password: pass,
    };
    this.config.set(
      `${this.configKey}.${this.INSTANCES_KEY}.${alias}`,
      storedInstance,
    );
    this.instances[alias] = storedInstance;
    this.instanceIds = Object.keys(this.instances);
    this.logger.info(`✅ Instance ${alias} added successfully.`);
    return this.login(authOptions, sdkOptions, cliOptions);
  }

  /**
   * Logs in to an existing ACC instance.
   *
   * @param {Object} options - Login options
   * @param {string} options.alias - Alias of the instance to log in to
   * @param {Object} sdkOptions @see https://opensource.adobe.com/acc-js-sdk/connectionParameters
   * @returns {Promise<Object>} Resolves with the authenticated client
   * @throws {AUTH_LOGIN_ALIAS_MISSING, AUTH_LOGIN_ALIAS_EMPTY, AUTH_LOGIN_ALIAS_INVALID, AUTH_LOGIN_SDK_INIT_FAILED} Throws if instance doesn't exist or login fails
   *
   * @example
   * const client = await auth.login({ alias: 'prod' });
   */
  async login(cliOptions, _sdkOptions) {
    let auth;
    if (!(cliOptions.alias in this.instances)) {
      throw new AUTH_LOGIN_ALIAS_MISSING();
    }
    auth = this.instances[cliOptions.alias];
    if (!auth) {
      throw new AUTH_LOGIN_ALIAS_EMPTY();
    }
    let { host, user, password } = auth;
    if (!host || !user || !password) {
      throw new AUTH_LOGIN_ALIAS_INVALID();
    }
    this.logger.info(`↔️ Connecting ${user}@${host}...`);
    const sdkOptions = _sdkOptions || {};
    this.logger.verbose(`Using sdkOptions ${JSON.stringify(sdkOptions)}`);
    try {
      if (
        sdkOptions.noStorage === undefined ||
        sdkOptions.noStorage === false
      ) {
        this.logger.verbose(`Using AccCache for SDK storage`);
        sdkOptions.storage = new AccCache();
      }
      this.connectionParameters = this._prepareConnectionParameters(
        host,
        user,
        password,
        sdkOptions,
      );
    } catch (error) {
      throw wrapSdkError(error, AUTH_LOGIN_SDK_CONNECTIONPARAMETERS_FAILED);
    }
    let client;
    try {
      client = await this.sdk.init(this.connectionParameters);
    } catch (error) {
      throw wrapSdkError(error, AUTH_LOGIN_SDK_INIT_FAILED);
    }
    try {
      await client.logon();
    } catch (error) {
      throw wrapSdkError(error, AUTH_LOGIN_SDK_LOGON_FAILED);
    }
    let serverInfo;
    try {
      serverInfo = client.getSessionInfo().serverInfo;
    } catch (error) {
      throw wrapSdkError(error, AUTH_LOGIN_SDK_SERVERINFO_FAILED);
    }
    if (!serverInfo) {
      throw new AUTH_LOGIN_SDK_SERVERINFO_EMPTY();
    }
    this.logger.info(
      `✅ Logged in to ${serverInfo.instanceName} (${serverInfo.releaseName} build ${serverInfo.buildNumber}) successfully.`,
    );
    return client;
  }

  _prepareConnectionParameters(host, user, password, sdkOptions) {
    return ConnectionParameters.ofUserAndPassword(
      host,
      user,
      password,
      sdkOptions,
    );
  }

  /**
   * Lists all configured ACC instances.
   *
   * @returns {void} Outputs list of instances
   *
   * @example
   * auth.list(); // Lists all configured instances
   */
  list() {
    this.logger.info(
      `📚 Reading from authentication file ${this.config.global().file} `,
    );
    this.logger.info(`📚 Listing ${this.instanceIds.length} instance(s)`);
    if (this.instanceIds.length === 0) {
      this.logger.info(
        `  No instances configured yet. Use "campaign auth init" to add an instance.`,
      );
      return;
    }
    for (const [key, value] of Object.entries(this.instances)) {
      this.logger.info(`  - "${key}": ${value.user}@${value.host}`);
    }
  }
}

export default CampaignAuth;
