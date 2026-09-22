// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;

/**
 * Log data for a single entity pushed by CampaignWatch._pushEntityToServer,
 * for troubleshooting and auditing.
 * 1 instance per push attempt (no batching, unlike CampaignPullLog).
 * @class CampaignPushLog
 */
class CampaignPushLog {
  /**
   * @type {object}
   */
  schemaConfig;

  /**
   * @type {Date}
   */
  startTime;

  /**
   * @type {Date}
   */
  endTime;

  /**
   * Absolute path of the file that triggered the push.
   * @type {string}
   */
  filePath;

  /**
   * The decompose xpath, relative to the entity root, whose content was pushed.
   * @type {string}
   */
  xpath;

  /**
   * The reconciliation key values written to the payload.
   * @type {Array<{xpath: string, attributeName: string, value: string}>}
   */
  keyValues;

  /**
   * The xtk:session#Write operation, e.g. "update".
   * @type {string}
   */
  operation;

  /**
   * The rebuilt entity document sent to the server.
   * @type {Document}
   */
  payloadXml;

  /**
   * @type {Error}
   */
  error;

  constructor(schemaConfig) {
    this.startTime = new Date();
    this.schemaConfig = schemaConfig;
  }

  /**
   * Build a readable summary of this push log for auditing/debugging.
   * The jsdom payloadXml document is not serializable in a readable way
   * (jsdom internals), so it is stringified here instead of being logged raw.
   * @returns {object} readable summary, safe to pass to logger.debug()
   */
  toLog() {
    return {
      schemaId: this.schemaConfig.schemaId,
      filePath: this.filePath,
      xpath: this.xpath,
      operation: this.operation,
      keyValues: this.keyValues,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : undefined,
      durationMs: this.endTime ? this.endTime - this.startTime : undefined,
      payloadXml: this.payloadXml
        ? DomUtil.toXMLString(this.payloadXml)
        : undefined,
      error: this.error ? this.error.message || String(this.error) : undefined,
    };
  }
}

export default CampaignPushLog;
