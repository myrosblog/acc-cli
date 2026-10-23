// npm
import fs from "fs-extra";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const {
  INSTANCE_QUERYDEF_FILE_NOT_FOUND,
  INSTANCE_QUERYDEF_SDK_CREATE_FAILED,
  INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED,
} = codes;
// acc
import { withSpinner } from "../../helpers/withSpinner.js";

/**
 * Runs a read-only queryDef on an ACC instance (`acc instance queryDef`).
 *
 * @class AccInstanceQueryDef
 */
class AccInstanceQueryDef {
  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @type {Function} to create spinner, injected for easier unit testing
   */
  createSpinner;

  /**
   * Creates a new AccInstanceQueryDef.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {Function} createSpinner - Factory of the spinner displaying progress
   * @example
   * const instanceQueryDef = new AccInstanceQueryDef(logger, client, createSpinner);
   */
  constructor(logger, client, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.createSpinner = createSpinner;
  }

  /**
   * Runs a read-only query on the instance via xtk:queryDef#ExecuteQuery (the
   * same SOAP mechanism as pull()). The caller passes a full queryDef as JSON;
   * it is read-only by construction: ExecuteQuery is `const`, an
   * operation:"select"/"count" can only read, and it is ACL-enforced (no
   * server-side scripting right needed, unlike exec()).
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} [cliOptions.query] - Inline queryDef as a JSON string
   * @param {string} [cliOptions.file] - Path to a .json file (alternative to query)
   * @param {boolean} [cliOptions.json] - when true, return SimpleJson instead of XML
   * @returns {Promise<string | object>} the result collection, as an XML string
   *   or, when `json` is set, a SimpleJson object
   * @throws {INSTANCE_QUERYDEF_FILE_NOT_FOUND|INSTANCE_QUERYDEF_SDK_CREATE_FAILED|INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED}
   */
  async queryDef(cliOptions) {
    const { query: inlineQuery, file } = cliOptions;

    let raw = inlineQuery;
    if (file) {
      if (!fs.existsSync(file)) {
        throw new INSTANCE_QUERYDEF_FILE_NOT_FOUND({ messageValues: [file] });
      }
      raw = fs.readFileSync(file, "utf8");
    }

    const highlightedName = chalk.bgCyan("queryDef");
    const result = await withSpinner(
      this.createSpinner,
      {
        text: `Executing ${highlightedName} on the server`,
        succeed: `${highlightedName} executed`,
        fail: `${highlightedName} failed`,
      },
      () => this.adapterExecuteQueryDef(raw, cliOptions.json),
    );

    // Always trace the raw XML; return XML or SimpleJson depending on --json.
    // const resultXml = DomUtil.toXMLString(resultElement);
    this.logger.verbose(result);
    return cliOptions.json ? result : DomUtil.toXMLString(result);
  }

  /**
   * Adapter of xtk:queryDef#create + #ExecuteQuery for:
   * - easier mocking in unit tests
   * - SDK error wrapping
   * Unlike pull's adapterCreateAndExecuteQuery, it does NOT call selectAll: the
   * caller-supplied queryDef already carries its own `select`. `.xml` returns
   * the result collection as a DOM Element (one child per row).
   * @param {object} queryDef - the original queryDef JSON, used to detect lineCount for logging
   * @param {boolean} jsonEnabled - when true, use the SimpleJson representation
   * @returns {Promise<Element>} the result collection element
   * @throws {CampaignException}
   */
  async adapterExecuteQueryDef(queryDef, jsonEnabled) {
    let query;
    try {
      // XML
      if (!jsonEnabled) {
        const queryDefXml = DomUtil.parse(queryDef);
        query = this.client.NLWS.xml.xtkQueryDef.create(queryDefXml);
      }
      // JSON
      else {
        const queryDefJson = JSON.parse(queryDef);
        query = this.client.NLWS.json.xtkQueryDef.create(queryDefJson);
      }
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_QUERYDEF_SDK_CREATE_FAILED);
    }
    try {
      return await query.executeQuery();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED);
    }
  }
}

export default AccInstanceQueryDef;
