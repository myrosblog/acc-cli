// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const { INSTANCE_EXEC_FILE_NOT_FOUND, INSTANCE_EXEC_SDK_EVALUATE_FAILED } =
  codes;
// acc
import { withSpinner } from "../../helpers/withSpinner.js";

/**
 * Runs server-side JavaScript on an instance (`acc instance exec`).
 *
 * @class AccInstanceExec
 */
class AccInstanceExec {
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
   * Runs a script with xtk:builder#EvaluateJavaScript. The script returns no
   * value: its output goes through logInfo() or the `context`, echoed back as XML.
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} [cliOptions.file] - JavaScript file to run
   * @param {string} [cliOptions.script] - Inline JavaScript to run
   * @param {string} [cliOptions.name] - Script name, defaults to the file name
   * @returns {Promise<string>} The execution context, as XML
   * @throws {INSTANCE_EXEC_FILE_NOT_FOUND|INSTANCE_EXEC_SDK_EVALUATE_FAILED}
   */
  async exec(cliOptions) {
    const { file, script: inlineScript } = cliOptions;

    let script = inlineScript;
    if (file) {
      if (!fs.existsSync(file)) {
        throw new INSTANCE_EXEC_FILE_NOT_FOUND({ messageValues: [file] });
      }
      script = fs.readFileSync(file, "utf8");
    }
    const name = cliOptions.name || (file ? path.basename(file) : "acc-cli");

    // EvaluateJavaScript takes a `context` XML param (in/out)
    const contextXml = DomUtil.fromJSON("context", {}, "SimpleJson");
    const highlightedName = chalk.bgCyan(name);
    const resultContext = await withSpinner(
      this.createSpinner,
      {
        text: `Executing ${highlightedName} on the server`,
        succeed: `${highlightedName} executed`,
        fail: `${highlightedName} failed`,
      },
      () => this.adapterEvaluateJavaScript(name, script, contextXml),
    );

    const resultXml = DomUtil.toXMLString(resultContext);
    this.logger.verbose(resultXml);
    return resultXml;
  }

  /**
   * Wraps xtk:builder#EvaluateJavaScript, to mock it in tests and wrap SDK errors.
   *
   * @param {string} name - Logical script name, sent as the `name` param
   * @param {string} script - JavaScript source to evaluate on the server
   * @param {Document} contextXml - Execution context (in/out)
   * @returns {Promise<Element>} The output `context` element
   * @throws {CampaignException}
   */
  async adapterEvaluateJavaScript(name, script, contextXml) {
    try {
      // `.xml` passes and returns the context as DOM, not re-cast from SimpleJson
      return await this.client.NLWS.xml.xtkBuilder.evaluateJavaScript(
        name,
        script,
        contextXml,
      );
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_EXEC_SDK_EVALUATE_FAILED);
    }
  }
}

export default AccInstanceExec;
