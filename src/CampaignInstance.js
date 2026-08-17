// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { Client } from "@adobe/acc-js-sdk/src/client.js";
import { EntityAccessor } from "@adobe/acc-js-sdk/src/entityAccessor.js";
import { XPath } from "@adobe/acc-js-sdk/src/domUtil.js";
import { codes, wrapSdkError } from "./helpers/AccErrors.js";
const {
  INSTANCE_PULL_SDK_CREATEQUERY_FAILED,
  INSTANCE_PULL_SDK_SELECTALL_FAILED,
  INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
  INSTANCE_EXEC_NO_SCRIPT,
  INSTANCE_EXEC_BOTH_SCRIPT,
  INSTANCE_EXEC_FILE_NOT_FOUND,
  INSTANCE_EXEC_SDK_EVALUATE_FAILED,
  INSTANCE_INFO_SDK_TESTCNX_FAILED,
  INSTANCE_INFO_SDK_SERVERTIME_FAILED,
  INSTANCE_INFO_SDK_CNXINFO_FAILED,
  INSTANCE_INFO_SDK_DUMPSTATE_FAILED,
  INSTANCE_QUERYDEF_NO_QUERY,
  INSTANCE_QUERYDEF_BOTH_QUERY,
  INSTANCE_QUERYDEF_FILE_NOT_FOUND,
  INSTANCE_QUERYDEF_SDK_CREATE_FAILED,
  INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED,
  INSTANCE_SOAP_NO_TARGET,
  INSTANCE_SOAP_BAD_ARGS,
  INSTANCE_SOAP_ARGS_NOT_ARRAY,
  INSTANCE_SOAP_SDK_CALL_FAILED,
} = codes;
// acc
import DomUtilAcc from "./helpers/DomUtilAcc.js";

/**
 * Campaign Instance class for interacting with ACC instances.
 * Handles data checking, pulling, and downloading from ACC schemas.
 * - pull():
 *   - paginates by batch of CONFIG_DEFAULT_LINECOUNT (startLine, lineCount)
 *   - download()
 *     - NLWS.xml.xtkQueryDef.create(schema)
 *     - NLWS.xml.xtkQueryDef.selectAll()
 *     - NLWS.xml.xtkQueryDef.executeQuery()
 *     - for each XML record:
 *       - parse()
 *
 * @class CampaignInstance
 * @classdesc Class for managing data operations with ACC instances
 */
class CampaignInstance {
  /**
   * Regular expression to extract config attributes from filename patterns
   * @type {RegExp}
   */
  REGEX_CONFIG_ATTRIBUTE = /{(.+?)}/g;

  /**
   * XPath attribute prefix character
   * @type {string}
   */
  CONFIG_XPATH_ATTR = "@";

  /**
   * Default SQL LIMIT to fetch schemas (querydef lineCount)
   * @type {number}
   */
  CONFIG_DEFAULT_LINECOUNT = 20;

  /**
   * Logs of downloaded data
   * @type {Array<CampaignPullLog>}
   */
  pullLogs = [];

  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @type {function} to create spinner, injected for easier unit testing
   */
  createSpinner;

  /**
   * Creates a new CampaignInstance.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {CampaignConfig} accConfig - Configuration object defining schemas and download options
   * @param {object} cliOptions - Command-line options including path, and metadata filters
   * @param {function} createSpinner - Ora spinner instance for displaying progress
   * @example
   * const instance = new CampaignInstance(logger, client, accConfig, cliOptions, createSpinner);
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
   * Gets query definition for a specific schema, merging with default config.
   *
   * @param {string} schema - Schema name (e.g., 'nms:recipient')
   * @param {object} schemaConfig
   * @param {object} baseQueryDef - Base query definition
   * @returns {object} Merged query definition
   * @example
   * const queryDef = instance._getQueryDefForSchema('nms:recipient', {
   *   schema: 'nms:recipient',
   *   operation: 'count'
   * });
   */
  _getQueryDefForSchema(schemaConfig, baseQueryDef) {
    const configQueryDef = schemaConfig.queryDef ? schemaConfig.queryDef : {};

    return {
      ...baseQueryDef,
      ...configQueryDef,
    };
  }

  /**
   * Pulls data from all schemas in the ACC instance.
   * Implements pagination to handle large datasets.
   *
   * @param {boolean} isPreview
   * @returns {Promise<void>} Resolves when pull operation is complete
   * @example
   * await instance.pull('/path/to/download');
   */
  async pull(isPreview) {
    this.logger.info(
      `✨ ${isPreview ? "Previewing" : "Pulling"} data to ${this.downloadPath}`,
    );
    this.pullLogs = [];

    // loop schemas
    for (const schemaConfig of this.accConfig.schemas) {
      const { schemaId, filename, queryDef } = schemaConfig;
      const pullLogsForThisSchema = [];
      // skip if metadata option was included and not matching
      if (this.metadata) {
        const metadata = this.metadata.split(",").map((id) => id.trim());
        if (!metadata.includes(schemaId)) {
          this.logger.verbose(`Skipping ${schemaId}`);
          continue;
        }
      }
      const spinner = this.createSpinner(
        `${filename}: ${chalk.bgCyan(schemaId)}`,
      ).start(); // Démarre le spinner
      // download and parse
      const lineCount = queryDef?.lineCount || this.CONFIG_DEFAULT_LINECOUNT;
      // startLine is 0-based, matching the Adobe Campaign console (verified via
      // Fiddler)
      let startLine = 0;
      let recordsParsedTotal = 0;
      let recordsLengthOfThisBatch = 0;
      // pagination loop, 1 per batch
      do {
        spinner.text = `${filename}: ${chalk.bgCyan(schemaId)} parsed ${recordsParsedTotal}. Downloading next ${lineCount}`;
        const pullLog = new CampaignPullLog(schemaConfig);
        this.pullLogs.push(pullLog);
        pullLogsForThisSchema.push(pullLog);
        this.logger.verbose(
          `  Querying instance for records from ${startLine} to ${startLine + lineCount - 1}...`,
        );
        const elementsForThisBatch = await this.downloadAndParse(
          schemaConfig,
          startLine,
          lineCount,
          isPreview,
          pullLog,
        );
        // increment counters
        recordsLengthOfThisBatch = elementsForThisBatch.length;
        startLine += lineCount;
        recordsParsedTotal += recordsLengthOfThisBatch;
        pullLog.endTime = new Date();
        // Like the console, pagination ends with one empty batch when the total
        // is an exact multiple of lineCount. Don't journal that trailing empty
        // batch (no records, no errors): drop it and stop.
        if (recordsLengthOfThisBatch === 0 && pullLog.errors.length === 0) {
          this.pullLogs.pop();
          pullLogsForThisSchema.pop();
          break;
        }
        // debug pullLog
        this.logger.debug(
          `Pull log for ${schemaId} batch starting at line ${pullLog.queryDef.startLine}:`,
        );
        this.logger.debug(pullLog);
      } while (recordsLengthOfThisBatch >= lineCount);
      const errorCount = pullLogsForThisSchema.flatMap((x) => x.errors).length;
      const errorMsg = errorCount > 0 ? `(⚠️ ${errorCount} errors)` : "";
      spinner.succeed(
        `${filename}: ${chalk.bgCyan(schemaId)} ${recordsParsedTotal} parsed ${errorMsg}`,
      );
      // display errors if any
      const flatErrors = pullLogsForThisSchema.flatMap((x) => x.errors);
      if (flatErrors.length > 0) {
        this.logger.verbose(`⚠️ Listing errors for ${schemaId}:`);
        this.logger.verbose(flatErrors.join("\n"));
      }
    }
  }

  /**
   * Downloads records from a specific schema and saves them as XML files.
   *
   * @param {object} schemaConfig - Schema download config
   * @param {number} startLine - Starting line number for pagination
   * @param {number} lineCount - Size of pagination
   * @param {boolean} isPreview
   * @param {object} pullLog
   * @returns {Promise<Array<Element>>} the parsed records of this batch
   */
  async downloadAndParse(
    schemaConfig,
    startLine,
    lineCount,
    isPreview,
    pullLog,
  ) {
    const { schemaId } = schemaConfig;
    const baseQueryDef = {
      schema: schemaId,
      operation: "select",
      select: {
        node: [],
      },
      startLine,
      lineCount,
    };

    let elementDownloaded;
    let elementsParsed = [];
    try {
      const queryDef = this._getQueryDefForSchema(schemaConfig, baseQueryDef);
      pullLog.queryDef = queryDef;
      const queryDefXml = DomUtil.fromJSON("queryDef", queryDef, "SimpleJson");
      pullLog.queryDefXml = queryDefXml;
      elementDownloaded = await this.adapterCreateAndExecuteQuery(queryDefXml); // Element, <srcSchema-collection>
      elementsParsed = EntityAccessor.getChildElements(elementDownloaded); // converts to Array[Element] to prefer for loops over "while+getNextSiblingElement"
    } catch (err) {
      pullLog.errors.push(err);
      return elementsParsed;
    }
    this.logger.verbose(
      `Downloaded XML Response with ${elementsParsed.length} children`,
    );
    const filenamesForThisBatch = [];
    for (const element of elementsParsed) {
      pullLog.elements.push(element);

      try {
        const filenameOnly = this.parse(element, schemaConfig, isPreview);
        pullLog.parsedFilenames.push(filenameOnly);
        filenamesForThisBatch.push(`${chalk.underline(filenameOnly)}`);
      } catch (err) {
        pullLog.errors.push(err);
      }
    }
    // display filenames
    if (filenamesForThisBatch.length > 0) {
      this.logger.verbose(filenamesForThisBatch.join(", "));
    }

    return elementsParsed;
  }

  /**
   * Adapter of the sdk functions for:
   * - easier mocking in unit test
   * - format isolation (XML vs JSON)
   * @param {Document} queryDefXml created from DomUtil.fromJSON
   * @returns {Promise<Element>}
   * @throws {CampaignException}
   */
  async adapterCreateAndExecuteQuery(queryDefXml) {
    let query;
    try {
      query = this.client.NLWS.xml.xtkQueryDef.create(queryDefXml);
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_PULL_SDK_CREATEQUERY_FAILED);
    }
    try {
      await query.selectAll(false); // @see https://opensource.adobe.com/acc-js-sdk/xtkQueryDef.html
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_PULL_SDK_SELECTALL_FAILED);
    }
    try {
      return await query.executeQuery(); // Element <srcSchema></srcSchema><srcSchema></srcSchema>...
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED);
    }
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
   * @throws {INSTANCE_EXEC_NO_SCRIPT, INSTANCE_EXEC_BOTH_SCRIPT, INSTANCE_EXEC_FILE_NOT_FOUND, INSTANCE_EXEC_SDK_EVALUATE_FAILED}
   */
  async exec(cliOptions) {
    const { file, script: inlineScript } = cliOptions;
    if (!file && !inlineScript) {
      throw new INSTANCE_EXEC_NO_SCRIPT();
    }
    if (file && inlineScript) {
      throw new INSTANCE_EXEC_BOTH_SCRIPT();
    }

    let script = inlineScript;
    if (file) {
      if (!fs.existsSync(file)) {
        throw new INSTANCE_EXEC_FILE_NOT_FOUND({ messageValues: [file] });
      }
      script = fs.readFileSync(file, "utf8");
    }
    const name = cliOptions.name || (file ? path.basename(file) : "acc-cli");

    const spinner = this.createSpinner(
      `Executing ${chalk.bgCyan(name)} on the server`,
    ).start();
    // EvaluateJavaScript requires a `context` XML param (in/out)
    const contextXml = DomUtil.fromJSON("context", {}, "SimpleJson");
    let resultContext;
    try {
      resultContext = await this.adapterEvaluateJavaScript(
        name,
        script,
        contextXml,
      );
    } catch (err) {
      spinner.fail(`${chalk.bgCyan(name)} failed`);
      throw err;
    }
    spinner.succeed(`${chalk.bgCyan(name)} executed`);

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
   * @throws {INSTANCE_QUERYDEF_NO_QUERY, INSTANCE_QUERYDEF_BOTH_QUERY, INSTANCE_QUERYDEF_FILE_NOT_FOUND, INSTANCE_QUERYDEF_SDK_CREATE_FAILED, INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED}
   */
  async queryDef(cliOptions) {
    const { query: inlineQuery, file } = cliOptions;
    if (!inlineQuery && !file) {
      throw new INSTANCE_QUERYDEF_NO_QUERY();
    }
    if (inlineQuery && file) {
      throw new INSTANCE_QUERYDEF_BOTH_QUERY();
    }

    let raw = inlineQuery;
    if (file) {
      if (!fs.existsSync(file)) {
        throw new INSTANCE_QUERYDEF_FILE_NOT_FOUND({ messageValues: [file] });
      }
      raw = fs.readFileSync(file, "utf8");
    }

    const spinner = this.createSpinner(
      `Executing ${chalk.bgCyan("queryDef")} on the server`,
    ).start();
    let result;
    try {
      result = await this.adapterExecuteQueryDef(raw, cliOptions.json);
    } catch (err) {
      spinner.fail(`${chalk.bgCyan("queryDef")} failed`);
      throw err;
    }
    spinner.succeed(`${chalk.bgCyan("queryDef")} executed`);

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
   * @param {Document} queryDefXml created from DomUtil.fromJSON
   * @param {object} queryDef
   * @param {boolean} jsonEnabled
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
   * Generic SOAP invoker: calls an arbitrary method on any schema via the
   * acc-js-sdk NLWS proxy. The escape hatch behind the curated `instance`
   * commands, reaches any method `instance query`/`instance exec` don't wrap.
   *
   * Scope: static methods only. The SDK auto-detects static/non-static from the
   * schema; a non-static method needs a loaded entity as its `this` param, which
   * this command does not build: the SDK then throws (wrapped as
   * INSTANCE_SOAP_SDK_CALL_FAILED). Prefer the static *FromId/*ById variants.
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} cliOptions.schema - schema id, e.g. "nms:delivery"
   * @param {string} cliOptions.method - method name (PascalCase or camelCase),
   *   e.g. "BuildPreviewFromId"; the SDK resolves either casing
   * @param {string} [cliOptions.args] - method arguments as a JSON array string,
   *   e.g. '[1234, "<params/>"]'. Omitted/empty means no argument.
   * @param {boolean} [cliOptions.json] - when true, return SimpleJson instead of XML
   * @returns {Promise<string | object>} the method result: an XML string (or the
   *   array's parts joined) in human mode, or the SimpleJson value when `json`
   * @throws {INSTANCE_SOAP_NO_TARGET, INSTANCE_SOAP_BAD_ARGS, INSTANCE_SOAP_ARGS_NOT_ARRAY, INSTANCE_SOAP_SDK_CALL_FAILED}
   */
  async soap(cliOptions) {
    const { schema, method } = cliOptions;
    if (!schema || !method) {
      throw new INSTANCE_SOAP_NO_TARGET();
    }

    // Arguments arrive as a JSON array string and are spread positionally onto
    // the method. A bare value (e.g. "5") is rejected to steer the user to [].
    let args = [];
    if (cliOptions.args !== undefined && cliOptions.args !== "") {
      try {
        args = JSON.parse(cliOptions.args);
      } catch (err) {
        throw new INSTANCE_SOAP_BAD_ARGS({ messageValues: [err.message] });
      }
      if (!Array.isArray(args)) {
        throw new INSTANCE_SOAP_ARGS_NOT_ARRAY();
      }
    }

    const schemaKey = this._toSchemaKey(schema);
    const label = `${schema}#${method}`;
    const spinner = this.createSpinner(
      `Calling ${chalk.bgCyan(label)} on the server`,
    ).start();
    let result;
    try {
      result = await this.adapterCallSoap(
        schemaKey,
        method,
        args,
        cliOptions.json,
      );
    } catch (err) {
      spinner.fail(`${chalk.bgCyan(label)} failed`);
      throw err;
    }
    spinner.succeed(`${chalk.bgCyan(label)} succeeded`);

    this.logger.verbose(result);
    return cliOptions.json ? result : this._serializeSoapResult(result);
  }

  /**
   * Adapter of the NLWS proxy dispatch for `soap()`:
   * - easier mocking in unit tests
   * - SDK error wrapping
   * The representation (xml vs json) drives how the SDK marshals both the input
   * parameters and the return value. The schema key is the camelCase namespace
   * the proxy expects (e.g. "nmsDelivery" for "nms:delivery").
   * @param {string} schemaKey camelCase schema key, e.g. "nmsDelivery"
   * @param {string} method method name (the SDK resolves either casing)
   * @param {Array} args positional arguments
   * @param {boolean} jsonEnabled when true use the SimpleJson representation
   * @returns {Promise<*>} DOM node / scalar / array (xml) or SimpleJson (json)
   * @throws {CampaignException}
   */
  async adapterCallSoap(schemaKey, method, args, jsonEnabled) {
    try {
      const nlws = jsonEnabled ? this.client.NLWS.json : this.client.NLWS.xml;
      return await nlws[schemaKey][method](...args);
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_SOAP_SDK_CALL_FAILED);
    }
  }

  /**
   * Maps a schema id to the camelCase namespace key the NLWS proxy expects,
   * e.g. "nms:delivery" -> "nmsDelivery", "xtk:queryDef" -> "xtkQueryDef".
   * Inverse of the SDK's Util.schemaIdFromNamespace.
   * @param {string} schema schema id ("namespace:entity")
   * @returns {string} the proxy key
   */
  _toSchemaKey(schema) {
    const [ns, entity] = schema.split(":");
    if (!entity) return schema; // already a key (or malformed): pass through
    return ns + entity.charAt(0).toUpperCase() + entity.slice(1);
  }

  /**
   * Serialises a SOAP result for human (XML) mode. A method may return nothing
   * (null), a scalar, a DOM node or, for multi-output methods like
   * BuildPreviewFromId, an array of those. DOM nodes are stringified; arrays
   * are stringified part-by-part and joined.
   * @param {*} result the raw NLWS return value
   * @returns {string}
   */
  _serializeSoapResult(result) {
    if (result === null || result === undefined) return "";
    if (Array.isArray(result)) {
      return result.map((r) => this._serializeSoapResult(r)).join("\n");
    }
    if (typeof result === "object" && result.nodeType) {
      return DomUtil.toXMLString(result);
    }
    return String(result);
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
   * @returns {Promise<{text: string, errors: Array<Error>}>}
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
      const spinner = this.createSpinner(probe.title).start();
      try {
        const body = probe.render(await probe.run());
        spinner.succeed(probe.title);
        sections.push(`== ${probe.title} ==\n${body}`);
      } catch (err) {
        spinner.fail(probe.title);
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
   * @returns {Promise<*>}
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

  /**
   * Writes a single record to disk (raw XML, or decomposed per `decompose`),
   * after blanking any `excludeXPaths`.
   * @param {Element} childElement - the record element
   * @param {object} schemaConfig - schema download config (filename, decompose, excludeXPaths)
   * @param {boolean} isPreview - when true, compute filenames but write nothing
   * @returns {string} the base filename of the saved record
   */
  parse(childElement, schemaConfig, isPreview) {
    const { filename, decompose, excludeXPaths } = schemaConfig;
    const configAttributes = this._getAttributesFromSchemaConfig(schemaConfig); // [ '@name', '@namespace' ]

    const computedFilename = this._computeFilename(
      filename,
      configAttributes,
      childElement,
    );
    const filenameOnly = path.basename(computedFilename);
    const datapath = path.join(this.downloadPath, computedFilename);

    // prepare XML by removing excluded attributes
    if (excludeXPaths) {
      for (const xpathString of excludeXPaths) {
        const xpath = new XPath(xpathString);
        const xpathElements = xpath.getElements();
        const lastXpathElement = xpathElements[xpathElements.length - 1];
        const lastNode = DomUtilAcc.findLastElement(childElement, xpathString);

        // if attribute, set it to blank
        if (DomUtilAcc.xpathElementIsAttribute(lastXpathElement)) {
          const attributeName =
            DomUtilAcc.getXpathAttributeName(lastXpathElement);
          if (lastNode.hasAttribute(attributeName)) {
            lastNode.setAttribute(attributeName, "");
          }
        }
        // if element, empty its textContent
        else {
          if (lastNode) {
            lastNode.textContent = "";
          }
        }
      }
    }

    // no decomposition: save raw XML
    if (!decompose) {
      const raw = DomUtil.toXMLString(childElement);
      if (!isPreview) {
        fs.outputFileSync(datapath, raw);
      }
    }
    // with decomposition: save each xpath, then save the clean meta
    else {
      // 1. save each xpath + removeElement
      for (const [xpathString, filenameTemplate] of Object.entries(decompose)) {
        try {
          // compute filename
          const decomposedFilename = this._computeFilename(
            filenameTemplate,
            configAttributes,
            childElement,
          );
          // then traverse xpath
          const lastNode = DomUtilAcc.findLastElement(
            childElement,
            xpathString,
          );
          if (!lastNode) {
            continue; // if xpath not found, skip to next one without throwing error as it can be optional
          }
          const elementValue = DomUtil.elementValue(lastNode);
          // save to file
          const datapath = path.join(this.downloadPath, decomposedFilename);
          if (!isPreview) {
            fs.outputFileSync(datapath, elementValue);
          }
          // empty element
          lastNode.textContent = "";
        } catch (err) {
          this.logger.verbose(`(⚠️ warning:parse ${err.message})`);
        }
      }
      // 2. save meta
      const metaContent = DomUtil.toXMLString(childElement);
      if (!isPreview) {
        fs.outputFileSync(datapath, metaContent);
      }
    }

    return filenameOnly;
  }

  _getAttributesFromSchemaConfig(schemaConfig) {
    const configAttributesRe = schemaConfig.filename.matchAll(
      this.REGEX_CONFIG_ATTRIBUTE,
    ); // [object RegExp String Iterator]
    const configAttributesArr = Array.from(configAttributesRe); // [ [ '@name', '@name' ], ... ]
    return configAttributesArr.map((attr) => attr[1]); // [ '@name', '@namespace' ]
  }

  _computeFilename(configFilename, configAttributes, record) {
    let filename = configFilename;
    for (const configAttribute of configAttributes) {
      const value = DomUtil.getAttributeAsString(
        record,
        configAttribute.replace(this.CONFIG_XPATH_ATTR, ""),
      );
      // The template (configFilename) is trusted and may contain "/" for
      // subdirectories. The attribute value comes from the server record and is
      // untrusted, so it must never inject path separators, parent-dir refs or
      // control chars (path traversal). A function replacer is used so "$"
      // patterns in the value are not interpreted by String.replaceAll.
      const safeValue = this._sanitizeFilenameValue(value);
      filename = filename.replaceAll(`{${configAttribute}}`, () => safeValue);
    }
    return filename;
  }

  /**
   * Sanitizes a single attribute value before it is substituted into a filename
   * template, so untrusted record data cannot escape the download directory.
   * Only the value is sanitized, never the template (which legitimately carries
   * "/" for subfolders).
   * @param {string} value raw attribute value from the record
   * @returns {string} a value safe to use as a filename component
   */
  _sanitizeFilenameValue(value) {
    return (
      String(value)
        .replace(/[/\\]/g, "_") // POSIX + Windows path separators
        // eslint-disable-next-line no-control-regex -- stripping control chars is the purpose here
        .replace(/[\x00-\x1f]/g, "") // NUL + control characters
        .replace(/^\.+$/, (dots) => "_".repeat(dots.length))
    ); // "." / ".." -> "_" / "__"
  }
}

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
   * @type {Element}
   */
  queryDefXml;

  /**
   * @type {Array<string>}
   */
  parsedFilenames = [];

  constructor(schemaConfig) {
    this.startTime = new Date();
    this.elements = [];
    this.schemaConfig = schemaConfig;
    this.errors = [];
  }
}

export default CampaignInstance;
