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
  AUTH_LOGIN_TOKEN_MISSING,
  AUTH_LOGIN_INVALID_METHOD,
  AUTH_INIT_INVALID_METHOD,
} = codes;
import SdkAdapter from "./adapters/SdkAdapter.js";
import AioConfigAdapter from "./adapters/AioConfigAdapter.js";
import PromptAdapter from "./adapters/PromptAdapter.js";
import AccCache from "./helpers/AccCache.js";

/**
 * Config key (dot path) under which instances are stored in the aio config.
 * Single source of truth shared with the `acc auth list` command.
 * @type {string}
 */
export const AUTH_INSTANCES_KEY = "acc.auth.instances";

/**
 * Supported authentication methods, stored per-instance under `authMethod`.
 * Legacy instances without `authMethod` are treated as `UserPassword`.
 * @type {{ USER_PASSWORD: string, IMS_BEARER_TOKEN: string }}
 */
export const AUTH_METHODS = {
  USER_PASSWORD: "UserPassword",
  IMS_BEARER_TOKEN: "ImsBearerToken",
};

/**
 * Campaign CLI class for managing ACC (Campaign Classic) instances.
 * Provides authentication, instance management, and connection capabilities.
 *
 * @class CampaignAuth
 * @classdesc Main class for interacting with ACC instances
 */
class CampaignAuth {
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
   * @param {PromptAdapter} [prompt] - Interactive prompt adapter (injectable for tests)
   * @throws {AUTH_CONSTR_SDK_MISSING} Throws if SDK or auth parameters are missing
   *
   * @example
   * const auth = new CampaignAuth(sdk, auth);
   */
  constructor(logger, sdk, config, prompt) {
    if (!sdk) {
      throw new AUTH_CONSTR_SDK_MISSING();
    }
    this.config = new AioConfigAdapter(config);
    this.config.reload();
    this.logger = logger;
    this.sdk = new SdkAdapter(sdk);
    this.prompt = prompt || new PromptAdapter();
    this.instances = this.config.get(AUTH_INSTANCES_KEY) || {};
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
    authOptions = await this._collectInitOptions(authOptions || {});
    if (this.instanceIds.includes(authOptions.alias)) {
      throw new AUTH_INIT_EXISTING_ALIAS();
    }
    const { alias } = authOptions;
    const storedInstance = this._buildStoredInstance(authOptions);
    this.config.set(`${AUTH_INSTANCES_KEY}.${alias}`, storedInstance);
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
    // Legacy instances stored before IMS support have no authMethod and are
    // UserPassword by definition, so default keeps them working untouched.
    const authMethod = auth.authMethod || AUTH_METHODS.USER_PASSWORD;
    const { host, user, token } = auth;
    if (authMethod === AUTH_METHODS.USER_PASSWORD) {
      if (!host || !user || !auth.password) {
        throw new AUTH_LOGIN_ALIAS_INVALID();
      }
      this.logger.info(`↔️ Connecting ${user}@${host}...`);
    } else if (authMethod === AUTH_METHODS.IMS_BEARER_TOKEN) {
      if (!host) {
        throw new AUTH_LOGIN_ALIAS_INVALID();
      }
      if (!token) {
        throw new AUTH_LOGIN_TOKEN_MISSING();
      }
      this.logger.info(`↔️ Connecting to ${host} via IMS bearer token...`);
    } else {
      throw new AUTH_LOGIN_INVALID_METHOD();
    }
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
        authMethod,
        auth,
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

  /**
   * Fills in any missing init options by prompting the user, but only when
   * attached to an interactive terminal. The password is always collected via
   * a masked prompt so it never lands in shell history or the process list.
   * In non-interactive mode the options are returned untouched (flags only).
   * @param {Object} opts - partial init options ({ alias, host, user, pass })
   * @returns {Promise<Object>}
   */
  async _collectInitOptions(opts) {
    if (!this.prompt.isInteractive()) {
      return opts;
    }
    const missing = (v) => v === undefined || v === null || v === "";
    // Prompt order follows the natural "where → how → who → secret → local
    // label" flow: connection target first, then the auth method, then the
    // method-specific identity/secret, and finally the local alias.
    if (missing(opts.host)) {
      opts.host = await this.prompt.input(
        "Adobe Campaign host URL (e.g. https://instance.com)",
      );
    }
    if (missing(opts.method)) {
      opts.method = await this.prompt.select("Authentication method", [
        { name: "User / password", value: AUTH_METHODS.USER_PASSWORD },
        { name: "IMS access token", value: AUTH_METHODS.IMS_BEARER_TOKEN },
      ]);
    }
    if (opts.method === AUTH_METHODS.IMS_BEARER_TOKEN) {
      if (missing(opts.token)) {
        opts.token = await this.prompt.password("IMS access token");
      }
    } else {
      if (missing(opts.user)) {
        opts.user = await this.prompt.input("Operator username");
      }
      if (missing(opts.pass)) {
        opts.pass = await this.prompt.password("Operator password");
      }
    }
    if (missing(opts.alias)) {
      opts.alias = await this.prompt.input(
        "Local alias for this instance (e.g. prod, staging, local)",
      );
    }
    return opts;
  }

  /**
   * Builds SDK ConnectionParameters for the given auth method.
   * @param {string} authMethod - one of AUTH_METHODS
   * @param {Object} auth - stored instance ({ host, user, password } | { host, token })
   * @param {Object} sdkOptions - acc-js-sdk connection options
   * @returns {ConnectionParameters}
   */
  _prepareConnectionParameters(authMethod, auth, sdkOptions) {
    if (authMethod === AUTH_METHODS.IMS_BEARER_TOKEN) {
      // sessionInfo:true is required: without it ofImsBearerToken performs no
      // SOAP logon and getSessionInfo().serverInfo stays empty, which would
      // trip AUTH_LOGIN_SDK_SERVERINFO_EMPTY downstream. Available since SDK
      // 1.1.35 (we depend on ^1.2).
      return ConnectionParameters.ofImsBearerToken(auth.host, auth.token, {
        ...sdkOptions,
        sessionInfo: true,
      });
    }
    return ConnectionParameters.ofUserAndPassword(
      auth.host,
      auth.user,
      auth.password,
      sdkOptions,
    );
  }

  /**
   * Builds the per-method object persisted under acc.auth.instances.<alias>.
   * @param {Object} opts - collected init options
   * @returns {Object}
   * @throws {AUTH_INIT_INVALID_METHOD}
   */
  _buildStoredInstance(opts) {
    const authMethod = opts.method || AUTH_METHODS.USER_PASSWORD;
    if (authMethod === AUTH_METHODS.IMS_BEARER_TOKEN) {
      return { host: opts.host, authMethod, token: opts.token };
    }
    if (authMethod === AUTH_METHODS.USER_PASSWORD) {
      return {
        host: opts.host,
        authMethod,
        user: opts.user,
        password: opts.pass,
      };
    }
    throw new AUTH_INIT_INVALID_METHOD();
  }
}

export default CampaignAuth;
