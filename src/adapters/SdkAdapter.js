/**
 * Adapter class for interacting with an external SDK (e.g., acc-js-sdk).
 * Encapsulates SDK-specific logic and provides a clean interface for business services.
 * @class SdkAdapter
 */
class SdkAdapter {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Get the outbound IP address (https://api.db-ip.com/v2/free/self)
   * Can be useful to troubleshoot IP whitelisting issues
   */
  async ip() {
    return this.sdk.ip();
  }

  /**
   * @param {ConnectionParameters} connectionParameters. Use ConnectionParameters.ofUserAndPassword for example
   * @param {object} connectionParameters
   * @returns {Promise<Client>} an ACC client object
   */
  async init(connectionParameters) {
    return this.sdk.init(connectionParameters);
  }
}

export default SdkAdapter;
