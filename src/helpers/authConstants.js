/**
 * Config key under which instances are stored.
 * Displayed with the `acc auth list` command.
 * @type {string}
 */
export const AUTH_INSTANCES_KEY = "acc.auth.instances";

/**
 * Config key holding the alias of the instance added by the last `acc auth init`
 * @type {string}
 */
export const AUTH_CURRENT_ALIAS_KEY = "acc.auth.currentAlias";

/**
 * Config key under which generated IMS access tokens are cached,
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
 * `ImsServerToServer` stores OAuth Server-to-Server credentials and generates an
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
 * Logs where the authentication file is: its location depends on the OS
 * (i.e. C:\Users\jdoe\.config\aio) and is not obvious to non-developers.
 * @param {AioLogger} logger - Logger instance for logging messages
 * @param {string} [file] - Path of the authentication file
 * @returns {void}
 */
export const logCredentialsFile = (logger, file) => {
  logger.info(`🔑 Reading authentication from ${file}`);
};
