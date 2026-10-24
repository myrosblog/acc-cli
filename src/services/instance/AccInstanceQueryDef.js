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
 * Runs a read-only queryDef on an instance (`acc instance queryDef`).
 *
 * @class AccInstanceQueryDef
 */
class AccInstanceQueryDef {
  /** @type {AioLogger} */
  logger;

  /** @type {Function} spinner factory, injected for unit tests */
  createSpinner;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {Client} client - Authenticated ACC client
   * @param {Function} createSpinner - Spinner factory
   */
  constructor(logger, client, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.createSpinner = createSpinner;
  }

  /**
   * Runs a full queryDef with xtk:queryDef#ExecuteQuery, as pull() does. It is
   * read-only: ExecuteQuery is a const method, select and count only read, and
   * ACLs apply. Unlike exec(), it needs no scripting right.
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} [cliOptions.query] - Inline queryDef, XML or JSON (with `json`)
   * @param {string} [cliOptions.file] - File holding the queryDef, instead of `query`
   * @param {boolean} [cliOptions.json] - Use and return SimpleJson instead of XML
   * @returns {Promise<string | object>} The result collection, as XML or SimpleJson
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

    // Always trace the result; return XML or SimpleJson depending on --json
    this.logger.verbose(result);
    return cliOptions.json ? result : DomUtil.toXMLString(result);
  }

  /**
   * Wraps xtk:queryDef#create and #ExecuteQuery, to mock them in tests and wrap
   * SDK errors. Unlike pull, it does not call selectAll: the queryDef carries
   * its own `select`. `.xml` returns the result collection as a DOM Element.
   *
   * @param {string} queryDef - The queryDef, as XML or as JSON
   * @param {boolean} jsonEnabled - Use the SimpleJson representation
   * @returns {Promise<Element>} The result collection, one child per row
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
