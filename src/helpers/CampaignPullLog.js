// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;

/**
 * Log data retrieved by CampaignInstance.pull() for troubleshooting and auditing
 * 1 instance per batch, i.e. 15 records with lineCount=10 yields 2 CampaignPullLogs
 * @class CampaignPullLog
 */
class CampaignPullLog {
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
   * @type {Array<Element>}
   */
  elements;

  /**
   * Flat array, not nested for the moment
   * @type {Array<Error>}
   */
  errors;

  /**
   * Save request as JSON
   * @type {object}
   */
  queryDef;

  /**
   * Save request as XML, converted from this.queryDef by DomUtil.fromJSON
   * @type {Document}
   */
  queryDefXml;

  /**
   * Filenames-only of the written files
   * @type {Array<string>}
   */
  parsedFilenames = [];

  /**
   * Paths of the written files, relative to the download path
   * @type {Array<string>}
   */
  parsedPaths = [];

  constructor(schemaConfig) {
    this.startTime = new Date();
    this.elements = [];
    this.schemaConfig = schemaConfig;
    this.errors = [];
  }

  /**
   * Build a readable summary of this pull log for auditing/debugging.
   * DOM elements and the jsdom queryDefXml document are not serializable in a
   * readable way (jsdom internals), so they are summarized/converted here
   * instead of being logged raw.
   * @returns {object} readable summary, safe to pass to logger.debug()
   */
  toLog() {
    return {
      schemaId: this.schemaConfig.schemaId,
      filename: this.schemaConfig.filename,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : undefined,
      durationMs: this.endTime ? this.endTime - this.startTime : undefined,
      elementCount: this.elements.length,
      parsedFilenames: this.parsedFilenames,
      parsedPaths: this.parsedPaths,
      errors: this.errors.map((err) => err.message || String(err)),
      queryDef: this.queryDef,
      queryDefXml: this.queryDefXml
        ? DomUtil.toXMLString(this.queryDefXml)
        : undefined,
    };
  }
}

export default CampaignPullLog;
