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
  INSTANCE_QUERYDEF_FILE_NOT_FOUND,
  INSTANCE_QUERYDEF_SDK_CREATE_FAILED,
  INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED,
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
