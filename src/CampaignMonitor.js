// sdk
import { ConnectionParameters } from "@adobe/acc-js-sdk/src/client.js";
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// acc
import SdkAdapter from "./adapters/SdkAdapter.js";
import { codes, wrapSdkError } from "./helpers/AccErrors.js";
const { MONITOR_HOST_UNRESOLVED, MONITOR_ALIAS_UNKNOWN, MONITOR_TEST_FAILED } =
  codes;

/**
 * Monitoring/health-check operations for ACC instances.
 *
 * Unlike CampaignAuth/CampaignInstance, monitoring probes are non-mutating and
 * may run without credentials: `test()` hits the anonymous /r/test endpoint on
 * the Apache front server and requires no logon.
 *
 * @class CampaignMonitor
 */
class CampaignMonitor {
  /**
   * @param {AioLogger} logger
   * @param {Object} sdk - raw acc-js-sdk instance
   * @param {CampaignAuth} auth - used to resolve a host from a stored alias
   */
  constructor(logger, sdk, auth) {
    this.logger = logger;
    this.sdk = new SdkAdapter(sdk);
    this.auth = auth;
  }

  /**
   * Anonymous health check against /r/test (Apache front server).
   * @param {Object} options
   * @param {string} [options.host] - instance root URL (anonymous, no login)
   * @param {string} [options.alias] - stored instance alias to read the host from
   * @returns {Promise<{xml: string, status: string}>} the raw /r/test XML
   *   (re-serialized from the parsed DOM) and its status attribute
   * @throws {MONITOR_HOST_UNRESOLVED, MONITOR_ALIAS_UNKNOWN, MONITOR_TEST_FAILED}
   */
  async test({ host, alias } = {}) {
    const endpoint = host || this._hostForAlias(alias);
    this.logger.info(`🔍 Health-checking ${endpoint}/r/test (anonymous)...`);
    try {
      // representation "xml" makes test() return the raw DOM instead of JSON,
      // so the server response can be displayed verbatim for auditability.
      const connectionParameters = ConnectionParameters.ofAnonymousUser(
        endpoint,
        { representation: "xml" },
      );
      const client = await this.sdk.init(connectionParameters);
      const xmlDom = await client.test();
      return {
        xml: DomUtil.toXMLString(xmlDom),
        status: xmlDom?.documentElement?.getAttribute("status"),
      };
    } catch (error) {
      throw wrapSdkError(error, MONITOR_TEST_FAILED, { endpoint });
    }
  }

  /**
   * Resolves the host of a stored instance alias.
   * @param {string} alias
   * @returns {string}
   * @throws {MONITOR_HOST_UNRESOLVED, MONITOR_ALIAS_UNKNOWN}
   */
  _hostForAlias(alias) {
    if (!alias) {
      throw new MONITOR_HOST_UNRESOLVED();
    }
    const instance = this.auth?.instances?.[alias];
    if (!instance?.host) {
      throw new MONITOR_ALIAS_UNKNOWN();
    }
    return instance.host;
  }
}

export default CampaignMonitor;
