import { generateAccessToken, invalidateCache } from "@adobe/aio-lib-core-auth";

/**
 * Adapter around `@adobe/aio-lib-core-auth`. Encapsulates IMS OAuth
 * Server-to-Server (client_credentials) token generation behind a clean,
 * mockable interface so business services (e.g. CampaignAuth) can generate
 * access tokens without coupling to a specific library, and so tests can stub
 * it.
 *
 * The library generates a token via the client_credentials grant against
 * `/ims/token/v2` and caches it in-process for 5 minutes. acc-cli adds its own
 * cross-process persistence on top (aio config), since each CLI invocation is a
 * fresh process and the in-memory cache does not survive.
 *
 * @class ImsAuthAdapter
 * @since 1.5.0
 */
class ImsAuthAdapter {
  /**
   * Generates an IMS access token via the OAuth Server-to-Server (client
   * credentials) grant. Returns the full IMS token response.
   *
   * @param {object} params the IMS OAuth2 client credentials
   * @param {string} params.clientId - IMS OAuth2 client id (API Key)
   * @param {string} params.clientSecret - IMS OAuth2 client secret
   * @param {string} params.orgId - IMS org id, e.g. "<id>@AdobeOrg"
   * @param {string[]} [params.scopes] - array of scope strings
   * @param {string} [imsEnv] - "prod" (default) or "stage"
   * @returns {Promise<{access_token: string, token_type: string, expires_in: number}>}
   *   the IMS token response (expires_in is in seconds)
   */
  async generateAccessToken(params, imsEnv) {
    return generateAccessToken(params, imsEnv);
  }

  /**
   * Clears the library's in-process token cache.
   * @returns {void}
   */
  invalidateCache() {
    return invalidateCache();
  }
}

export default ImsAuthAdapter;
