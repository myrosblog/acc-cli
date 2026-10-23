// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { Client } from "@adobe/acc-js-sdk/src/client.js";
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const {
  INSTANCE_EXEC_FILE_NOT_FOUND,
  INSTANCE_EXEC_SDK_EVALUATE_FAILED,
  INSTANCE_INFO_SDK_TESTCNX_FAILED,
  INSTANCE_INFO_SDK_SERVERTIME_FAILED,
  INSTANCE_INFO_SDK_CNXINFO_FAILED,
  INSTANCE_INFO_SDK_DUMPSTATE_FAILED,
} = codes;
// acc
import { withSpinner } from "../../helpers/withSpinner.js";

/**
 * Campaign Instance class for interacting with ACC instances.
 * Handles exec, queryDef, soap and info. The pull and check live in AccInstancePull.
 *
 * @class AccInstance
 */
class AccInstance {
  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @type {Function} to create spinner, injected for easier unit testing
   */
  createSpinner;

  /**
   * Creates a new AccInstance.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {AccConfig} accConfig - Configuration object defining schemas and download options
   * @param {object} cliOptions - Command-line options including path, and metadata filters
   * @param {Function} createSpinner - Ora spinner instance for displaying progress
   * @example
   * const instance = new AccInstance(logger, client, accConfig, cliOptions, createSpinner);
   */
  constructor(logger, client, accConfig, cliOptions, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.accConfig = accConfig;
    this.downloadPath = cliOptions.path;
    this.metadata = cliOptions.metadata;
    this.createSpinner = createSpinner;
  }

  /**
   * Executes server-side JavaScript on the instance via xtk:builder#EvaluateJavaScript.
   * The script does not "return" a value: it surfaces output through logInfo() /
   * the execution context, which is echoed back raw.
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} [cliOptions.file] - Path to a JavaScript file to execute
   * @param {string} [cliOptions.script] - Inline JavaScript to execute
   * @param {string} [cliOptions.name] - Logical script name (param `name`)
   * @returns {Promise<string>} The execution context, serialized as XML
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

    // EvaluateJavaScript requires a `context` XML param (in/out)
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
   * Adapter of the SDK static method xtk:builder#EvaluateJavaScript for:
   * - easier mocking in unit tests
   * - SDK error wrapping
   * @param {string} name Script name (param `name`)
   * @param {string} script JavaScript source to evaluate server-side (param `script`)
   * @param {Document} contextXml Execution context (param `context`, in/out)
   * @returns {Promise<Element>} the output `context` element
   * @throws {CampaignException}
   */
  async adapterEvaluateJavaScript(name, script, contextXml) {
    try {
      // `.xml` forces the XML representation so DOMDocument params (context)
      // are passed/returned as DOM rather than re-cast from SimpleJson.
      return await this.client.NLWS.xml.xtkBuilder.evaluateJavaScript(
        name,
        script,
        contextXml,
      );
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_EXEC_SDK_EVALUATE_FAILED);
    }
  }

  /**
   * Diagnostic report combining read-only session/monitoring probes:
   *   - xtk:session#TestCnx (reachability ping)
   *   - xtk:session#GetServerTime (server clock)
   *   - xtk:session#GetCnxInfo (active connections + datasource)
   *   - nl:monitoring#DumpCurrentInstanceState (workflows & instance state)
   *
   * Best-effort, "doctor"-style: each probe runs in its own try/catch so one
   * failure doesn't hide the others. The caller gets the rendered report plus
   * the list of failed probes (to set a non-zero exit code).
   *
   * @returns {object} { text: string, errors: Array<Error> } the report and any errors
   */
  async info() {
    // GetServerTime returns a JS Date; the two XML probes return an Element
    // (not a Document), so DomUtil.toXMLString serializes them directly.
    const probes = [
      {
        title: "Connection (xtk:session#TestCnx)",
        run: () => this.adapterTestCnx(),
        render: () => "✅ reachable",
      },
      {
        title: "Server time (xtk:session#GetServerTime)",
        run: () => this.adapterGetServerTime(),
        render: (value) => value?.toISOString?.() ?? String(value),
      },
      {
        title: "Connection info (xtk:session#GetCnxInfo)",
        run: () => this.adapterGetCnxInfo(),
        render: (value) => DomUtil.toXMLString(value),
      },
      {
        title: "Instance state (nl:monitoring#DumpCurrentInstanceState)",
        run: () => this.adapterDumpCurrentInstanceState(),
        render: (value) => DomUtil.toXMLString(value),
      },
    ];

    const sections = [];
    const errors = [];
    for (const probe of probes) {
      try {
        const body = await withSpinner(
          this.createSpinner,
          { text: probe.title },
          async () => probe.render(await probe.run()),
        );
        sections.push(`== ${probe.title} ==\n${body}`);
      } catch (err) {
        errors.push(err);
        sections.push(`== ${probe.title} ==\n⚠️ ${err.message}`);
      }
    }

    const text = sections.join("\n\n");
    this.logger.verbose(text);
    return { text, errors };
  }

  /**
   * Adapter of xtk:session#TestCnx (reachability ping; resolves with no value).
   * @returns {Promise<void>}
   * @throws {CampaignException}
   */
  async adapterTestCnx() {
    try {
      return await this.client.NLWS.xtkSession.testCnx();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_TESTCNX_FAILED);
    }
  }

  /**
   * Adapter of xtk:session#GetServerTime.
   * @returns {Promise<Date>} the server clock
   * @throws {CampaignException}
   */
  async adapterGetServerTime() {
    try {
      return await this.client.NLWS.xtkSession.getServerTime();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_SERVERTIME_FAILED);
    }
  }

  /**
   * Adapter of xtk:session#GetCnxInfo. `.xml` forces the XML representation so
   * the result is returned as a DOM Element.
   * @returns {Promise<Element>} the `<infos>` element
   * @throws {CampaignException}
   */
  async adapterGetCnxInfo() {
    try {
      return await this.client.NLWS.xml.xtkSession.getCnxInfo();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_CNXINFO_FAILED);
    }
  }

  /**
   * Adapter of nl:monitoring#DumpCurrentInstanceState. Heavy call (~7s): the
   * caller must open the connection with a raised `timeout` (the SDK default of
   * 5s is too short). `.xml` returns the `<elemMonitoring>` element.
   * @returns {Promise<Element>} the `<elemMonitoring>` element
   * @throws {CampaignException}
   */
  async adapterDumpCurrentInstanceState() {
    try {
      return await this.client.NLWS.xml.nlMonitoring.dumpCurrentInstanceState();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_DUMPSTATE_FAILED);
    }
  }
}

export default AccInstance;
