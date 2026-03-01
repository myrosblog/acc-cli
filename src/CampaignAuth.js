import CampaignError from "./CampaignError.js";

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
   * Creates a new CampaignAuth instance.
   *
   * @param {Object} sdk - ACC JS SDK instance
   * @param {Object} config - Configstore instance for persistent storage
   * @throws {CampaignError} Throws if SDK or config parameters are missing
   *
   * @example
   * const auth = new CampaignAuth(sdk, config);
   */
  constructor(sdk, config) {
    if (!sdk || !config) {
      throw new CampaignError(
        "SDK and Configstore instances are required to initialize CampaignAuth.",
      );
    }
    this.sdk = sdk;
    this.config = config;
    this.instances = config.get(this.INSTANCES_KEY) || {};
    this.instanceIds = Object.keys(this.instances);
    console.log(
      `🏠 acc initialized with SDK ${this.sdk.getSDKVersion().version} and authentication from ${this.config.path}`,
    );
  }

  async ip(){
    console.log(`Fetching IP address...`);
    const ip = await this.sdk.ip();
    console.log(ip);
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
   *   password: 'password'
   * });
   */
  async init(options) {
    if (this.instanceIds.includes(options.alias)) {
      throw new CampaignError(
        `Instance with alias ${options.alias} already exists. Please choose a different alias.`,
      );
    }
    const { alias, host, user, password } = options;
    this.config.set(`${this.INSTANCES_KEY}.${alias}`, { host, user, password });
    console.log(`✅ Instance ${alias} added successfully.`);
    return this.login(options);
  }

  /**
   * Logs in to an existing ACC instance.
   *
   * @param {Object} options - Login options
   * @param {string} options.alias - Alias of the instance to log in to
   * @returns {Promise<Object>} Resolves with the authenticated client
   * @throws {CampaignError} Throws if instance doesn't exist or login fails
   *
   * @example
   * const client = await auth.login({ alias: 'prod' });
   */
  async login(options) {
    const { host, user, password } =
      this.config.get(`instances.${options.alias}`) || {};
    if (!host || !user || !password) {
      throw new CampaignError(
        `Authentication with alias "${options.alias}" doesn't exist. Use campaign auth list to see all configured instances or campaign auth init to add a new instance.`,
      );
    }
    console.log(`↔️ Connecting ${user}@${host}...`);
    const connectionParameters =
      this.sdk.ConnectionParameters.ofUserAndPassword(host, user, password);
    const client = await this.sdk.init(connectionParameters);
    await client.logon();
    const serverInfo = client.getSessionInfo().serverInfo;
    if (!serverInfo) {
      throw new CampaignError(`Unable to get server info.`);
    }
    console.log(
      `✅ Logged in to ${serverInfo.instanceName} (${serverInfo.releaseName} build ${serverInfo.buildNumber}) successfully.`,
    );
    return client;
  }

  /**
   * Lists all configured ACC instances.
   *
   * @returns {void} Outputs list of instances to console
   *
   * @example
   * auth.list(); // Lists all configured instances
   */
  list() {
    console.log(`📚 Reading ${this.instanceIds.length} instance(s)`);
    if(this.instanceIds.length === 0) {
      console.log(`  No instances configured yet. Use "campaign auth init" to add an instance.`);
      return;
    }
    for (const [key, value] of Object.entries(this.instances)) {
      console.log(`  - "${key}": ${value.user}@${value.host}`);
    }
  }
}

export default CampaignAuth;
