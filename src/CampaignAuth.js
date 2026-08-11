// sdk
import accSdk from "@adobe/acc-js-sdk";
const { ConnectionParameters } = accSdk;
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
  AUTH_LOGIN_IMS_CREDENTIALS_MISSING,
  AUTH_LOGIN_IMS_TOKEN_GENERATION_FAILED,
  AUTH_LOGIN_INVALID_METHOD,
  AUTH_INIT_INVALID_METHOD,
} = codes;
import SdkAdapter from "./adapters/SdkAdapter.js";
import AioConfigAdapter from "./adapters/AioConfigAdapter.js";
import PromptAdapter from "./adapters/PromptAdapter.js";
import ImsAuthAdapter from "./adapters/ImsAuthAdapter.js";
import AccCache from "./helpers/AccCache.js";
import soapLogObserver from "./helpers/soapLogObserver.js";

/**
 * Config key (dot path) under which instances are stored in the aio config.
 * Single source of truth shared with the `acc auth list` command.
 * @type {string}
 */
export const AUTH_INSTANCES_KEY = "acc.auth.instances";

/**
 * Config key (dot path) under which minted IMS access tokens are cached,
 * separately from the credentials in AUTH_INSTANCES_KEY so that secrets and
 * volatile tokens never mix (and `acc auth list` never sees a token). Each
 * alias holds `{ accessToken, expiresAt }`, reused until close to expiry.
 * @type {string}
 * @since 1.5.0
 */
export const AUTH_IMS_TOKENS_KEY = "acc.auth.imsTokens";

/**
 * Supported authentication methods, stored per-instance under `authMethod`.
 * Legacy instances without `authMethod` are treated as `UserPassword`.
 * `ImsServerToServer` stores OAuth Server-to-Server credentials and mints an
 * IMS access token on demand (since 1.5.0); `ImsBearerToken` stores a token the
 * user pasted by hand.
 * @type {{ USER_PASSWORD: string, IMS_BEARER_TOKEN: string, IMS_SERVER_TO_SERVER: string }}
 * @since 1.2.0
 */
export const AUTH_METHODS = {
  USER_PASSWORD: "UserPassword",
  IMS_BEARER_TOKEN: "ImsBearerToken",
  IMS_SERVER_TO_SERVER: "ImsServerToServer",
};

/**
 * Campaign CLI class for managing ACC (Campaign Classic) instances.
 * Provides authentication, instance management, and connection capabilities.
 *
 * Works with 3 methods:
 * - IMS OAuth Server-to-Server (Client Id, Secret, Org Id, Scopes)
 * - IMS Access token (JWT, starts with 'eyJ...')
 * - Operator (User, password)
 *
 * @class CampaignAuth
 * @classdesc Main class for interacting with ACC instances
 * @see Credentials in node_modules/@adobe/acc-js-sdk/src/client.js
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
   * @param {Function} [makeCache] - factory (alias) => AccCache for SDK storage
   * @param {ImsAuthAdapter} [imsAuth] - IMS S2S token minter (injectable for tests)
   * @throws {AUTH_CONSTR_SDK_MISSING} Throws if SDK or auth parameters are missing
   *
   * @example
   * const auth = new CampaignAuth(sdk, auth);
   */
  constructor(logger, sdk, config, prompt, makeCache, imsAuth) {
    if (!sdk) {
      throw new AUTH_CONSTR_SDK_MISSING();
    }
    this.config = new AioConfigAdapter(config);
    this.config.reload();
    this.logger = logger;
    this.sdk = new SdkAdapter(sdk);
    this.prompt = prompt || new PromptAdapter();
    this.makeCache = makeCache || (() => new AccCache());
    this.imsAuth = imsAuth || new ImsAuthAdapter();
    this.logger.info(
      `🔑 Reading authentication from ${this.config.global()?.file}`,
    );
    this.instances = this.config.get(AUTH_INSTANCES_KEY) || {};
    this.instanceIds = Object.keys(this.instances);
  }

  async ip() {
    this.logger.info(`Fetching IP address...`);
    const ip = await this.sdk.ip();
    return ip;
  }

  /**
   * Returns a redacted view of the configured instances, safe to print.
   *
   * Secrets are NEVER included: only the connection target (host), the operator
   * (user) and the derived auth method are exposed. This is what `acc auth list`
   * renders, deliberately replacing the raw `config:get` dump which leaked the
   * stored password in clear text.
   *
   * @returns {Array<{alias: string, host: string, user: string, method: string}>}
   *   One entry per instance, sorted by alias.
   */
  list() {
    return this.instanceIds.sort().map((alias) => {
      const record = this.instances[alias] || {};
      // Coerce missing host/user to null so the 4 fields are always present,
      // keeping the --json shape stable (JSON.stringify drops undefined keys).
      return {
        alias,
        host: record.host ?? null,
        user: record.user ?? null,
        method: this._methodOf(record),
      };
    });
  }

  /**
   * Derives the auth method from a stored instance record. Records now persist
   * `authMethod` explicitly (UserPassword or ImsBearerToken). Legacy instances
   * stored before IMS support have no authMethod but carry a password, so they
   * are UserPassword by definition (mirrors the fallback in login()).
   * @param {Object} record - a stored instance record
   * @returns {string}
   */
  _methodOf(record) {
    if (!record) {
      return "Unknown";
    }
    if (record.authMethod) {
      return record.authMethod;
    }
    return record.password ? AUTH_METHODS.USER_PASSWORD : "Unknown";
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
    // The bearer token handed to the SDK. For ImsBearerToken it is the token the
    // user stored; for ImsServerToServer it is minted (and cached) on the fly.
    let bearerToken;
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
      bearerToken = token;
    } else if (authMethod === AUTH_METHODS.IMS_SERVER_TO_SERVER) {
      if (!host || !auth.json) {
        throw new AUTH_LOGIN_IMS_CREDENTIALS_MISSING();
      }
      this.logger.info(`↔️ Connecting to ${host} via IMS server-to-server...`);
      bearerToken = await this._resolveImsToken(cliOptions.alias, auth);
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
        // Per-instance cache: each alias gets its own sub-directory (the
        // Console stores each instance separately too).
        sdkOptions.storage = this.makeCache(cliOptions.alias);
      }
      this.connectionParameters = this._prepareConnectionParameters(
        authMethod,
        auth,
        sdkOptions,
        bearerToken,
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
    // Trace SOAP calls into the logger (secret hidden and length-capped)
    client.registerObserver(soapLogObserver(this.logger));
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
   * Resolves an IMS access token for an `ImsServerToServer` instance. Reuses a
   * previously minted token persisted under {@link AUTH_IMS_TOKENS_KEY} until it
   * is within a 10-minute safety margin of expiry (mirrors aio-lib-ims);
   * otherwise mints a fresh one via @adobe/aio-lib-core-auth and persists it.
   * This gives cross-process reuse, which the library's in-memory 5-minute cache
   * cannot provide (each CLI invocation is a new process).
   *
   * @param {string} alias - instance alias, used as the token cache key
   * @param {Object} auth - stored instance ({ clientId, clientSecret, orgId, scopes, imsEnv? })
   * @returns {Promise<string>} a valid IMS access token
   * @throws {AUTH_LOGIN_IMS_TOKEN_GENERATION_FAILED}
   */
  async _resolveImsToken(alias, auth) {
    // A generous margin avoids handing out a token that expires mid-session.
    const SAFETY_MARGIN_MS = 10 * 60 * 1000;
    const cache = this.config.get(AUTH_IMS_TOKENS_KEY) || {};
    const cached = cache[alias];
    // check cached validity
    if (
      cached?.accessToken &&
      cached.expiresAt > Date.now() + SAFETY_MARGIN_MS
    ) {
      const friendlyDate = new Date(cached.expiresAt).toISOString();
      this.logger.info(
        `🔐 Re-using IMS access token (expires on ${friendlyDate})`,
      );
      return cached.accessToken;
    }
    if (cached) {
      const friendlyDate = new Date(cached.expiresAt).toISOString();
      this.logger.info(
        `🔐 IMS access token expired on ${friendlyDate}. Generating a new one.`,
      );
    }
    let resp;
    try {
      resp = await this.imsAuth.generateAccessToken(
        {
          clientId: auth.json.CLIENT_ID,
          clientSecret: auth.json.CLIENT_SECRETS[0],
          orgId: auth.json.ORG_ID,
          scopes: auth.json.SCOPES,
        },
        auth.imsEnv,
      );
    } catch (error) {
      throw wrapSdkError(error, AUTH_LOGIN_IMS_TOKEN_GENERATION_FAILED);
    }
    // generateAccessToken resolves the full IMS response { access_token,
    // expires_in }
    const accessToken = resp?.access_token ?? resp;
    const expiresInMs = (resp?.expires_in ?? 0) * 1000;
    const expiresAt = Date.now() + expiresInMs;
    this.config.set(`${AUTH_IMS_TOKENS_KEY}.${alias}`, {
      accessToken,
      expiresAt,
    });
    const friendlyDate = new Date(expiresAt).toISOString();
    this.logger.info(
      `🔐 Generated a new IMS access token for ${alias} (expires on ${friendlyDate})`,
    );
    return accessToken;
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
        {
          name: `IMS OAuth Server-to-Server (Client Id, Secret)`,
          value: AUTH_METHODS.IMS_SERVER_TO_SERVER,
        },
        {
          name: "IMS Access token (eyJhbG...)",
          value: AUTH_METHODS.IMS_BEARER_TOKEN,
        },
        {
          name: "Operator (User, password)",
          value: AUTH_METHODS.USER_PASSWORD,
        },
      ]);
    }
    if (opts.method === AUTH_METHODS.IMS_BEARER_TOKEN) {
      if (missing(opts.token)) {
        opts.token = await this.prompt.password(
          "IMS access token (JWT, starts with 'eyJ…')",
        );
      }
    } else if (opts.method === AUTH_METHODS.IMS_SERVER_TO_SERVER) {
      if (missing(opts.json)) {
        const maxAttempts = 10;
        let attempts = 0;
        let jsonParsed = null;
        do {
          const jsonString = await this.prompt.input(
            `IMS OAuth Server-to-Server JSON (starts with {"ORG_ID":...})`,
          );
          try {
            jsonParsed = JSON.parse(jsonString);
          } catch (e) {
            this.logger.error("Invalid JSON provided: " + e.message);
          }
          attempts++;
        } while (jsonParsed === null && attempts < maxAttempts);
        opts.json = jsonParsed;
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
   * Both IMS methods authenticate with a bearer token (pasted for
   * ImsBearerToken, minted for ImsServerToServer), so they share the same
   * ofImsBearerToken path.
   * @param {string} authMethod - one of AUTH_METHODS
   * @param {Object} auth - stored instance ({ host, user, password } | { host, ... })
   * @param {Object} sdkOptions - acc-js-sdk connection options
   * @param {string} [bearerToken] - resolved IMS bearer token (both IMS methods)
   * @returns {ConnectionParameters}
   */
  _prepareConnectionParameters(authMethod, auth, sdkOptions, bearerToken) {
    if (
      authMethod === AUTH_METHODS.IMS_BEARER_TOKEN ||
      authMethod === AUTH_METHODS.IMS_SERVER_TO_SERVER
    ) {
      // sessionInfo:true is required: without it ofImsBearerToken performs no
      // SOAP logon and getSessionInfo().serverInfo stays empty, which would
      // trip AUTH_LOGIN_SDK_SERVERINFO_EMPTY downstream. Available since SDK
      // 1.1.35 (we depend on ^1.2).
      return ConnectionParameters.ofImsBearerToken(auth.host, bearerToken, {
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
    if (authMethod === AUTH_METHODS.IMS_SERVER_TO_SERVER) {
      const instance = {
        host: opts.host,
        authMethod,
        json: opts.json,
      };
      // Optional IMS environment override (prod|stage); default is prod.
      if (opts.imsEnv) {
        instance.imsEnv = opts.imsEnv;
      }
      return instance;
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
