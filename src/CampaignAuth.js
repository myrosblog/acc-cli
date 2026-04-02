// sdk
import { ConnectionParameters } from "@adobe/acc-js-sdk/src/client.js";
import AioLogger from "@adobe/aio-lib-core-logging";
// acc
import CampaignError from "./CampaignError.js";
import SdkAdapter from "./adapters/SdkAdapter.js";

/**
 * Campaign CLI class for managing ACC (Campaign Classic) instances.
 * Provides authentication, instance management, and connection capabilities.
 *
 * @class CampaignAuth
 * @classdesc Main class for interacting with ACC instances
 */
class CampaignAuth {
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
   * Creates a new CampaignAuth instance.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Object} sdk - Raw ACC JS SDK instance
   * @param {Configstore} auth - Configstore instance for persistent storage
   * @throws {CampaignError} Throws if SDK or auth parameters are missing
   *
   * @example
   * const auth = new CampaignAuth(sdk, auth);
   */
  constructor(logger, sdk, auth) {
    if (!sdk || !auth) {
      throw new CampaignError(
        "SDK and Configstore instances are required to initialize CampaignAuth.",
      );
    }
    this.logger = logger;
    this.sdk = new SdkAdapter(sdk);
    this.auth = auth;
    this.instances = auth.get(this.INSTANCES_KEY) || {};
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
   * @throws {CampaignError} Throws if instance with alias already exists
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
      throw new CampaignError(
        `Instance with alias ${authOptions.alias} already exists. Please choose a different alias.`,
      );
    }
    const { alias, host, user, pass } = authOptions;
    this.auth.set(`${this.INSTANCES_KEY}.${alias}`, {
      host,
      user,
      password: pass,
    });
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
   * @throws {CampaignError} Throws if instance doesn't exist or login fails
   *
   * @example
   * const client = await auth.login({ alias: 'prod' });
   */
  async login(cliOptions, sdkOptions) {
    let auth;
    try {
      auth = this.auth.get(`instances.${cliOptions.alias}`);
    } catch (error) {
      this.logger.verbose(error);
      throw new CampaignError(
        `Login failed: alias "${cliOptions.alias}" not found. Use "acc auth list" to see all configured instances.`,
      );
    }
    if (!auth) {
      throw new CampaignError(
        `Login failed: alias "${cliOptions.alias}" empty. Use "acc auth list" to see all configured instances.`,
      );
    }
    let { host, user, password } = auth;
    if (!host || !user || !password) {
      this.logger.verbose(error);
      throw new CampaignError(
        `Login failed: alias "${cliOptions.alias}" is misconfigured. Use "acc auth list" to see all configured instances.`,
      );
    }
    this.logger.info(`↔️ Connecting ${user}@${host}...`);
    this.logger.verbose(`Using sdkOptions ${JSON.stringify(sdkOptions)}`);
    this.connectionParameters = this._prepareConnectionParameters(
      host,
      user,
      password,
      sdkOptions,
    );
    const client = await this.sdk.init(this.connectionParameters);
    await client.logon();
    const serverInfo = client.getSessionInfo().serverInfo;
    if (!serverInfo) {
      throw new CampaignError(`Unable to get server info.`);
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
    this.logger.info(`📚 Reading from authentication file ${this.auth.path} `);
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
