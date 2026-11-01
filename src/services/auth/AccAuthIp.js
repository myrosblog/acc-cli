import SdkAdapter from "../../adapters/SdkAdapter.js";

/**
 * Looks up the public IP address of the machine (`acc auth ip`).
 *
 * @class AccAuthIp
 */
class AccAuthIp {
  /** @type {AioLogger} */
  logger;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {object} sdk - Raw ACC JS SDK
   */
  constructor(logger, sdk) {
    this.logger = logger;
    this.sdk = new SdkAdapter(sdk);
  }

  /**
   * Fetches the public IP address of the current machine via the Adobe SDK.
   *
   * @returns {Promise<string>} The public IP address (e.g., "192.0.2.1")
   */
  async ip() {
    this.logger.info(
      `Fetching IP address with the Adobe SDK (from https://api.db-ip.com/v2/free/self)...`,
    );
    const ip = await this.sdk.ip();
    return ip;
  }
}

export default AccAuthIp;
