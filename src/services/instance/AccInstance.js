// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { Client } from "@adobe/acc-js-sdk/src/client.js";
import { EntityAccessor } from "@adobe/acc-js-sdk/src/entityAccessor.js";
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const {
  INSTANCE_PULL_SDK_CREATEQUERY_FAILED,
  INSTANCE_PULL_SDK_SELECTALL_FAILED,
  INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
  INSTANCE_EXEC_FILE_NOT_FOUND,
  INSTANCE_EXEC_SDK_EVALUATE_FAILED,
  INSTANCE_INFO_SDK_TESTCNX_FAILED,
  INSTANCE_INFO_SDK_SERVERTIME_FAILED,
  INSTANCE_INFO_SDK_CNXINFO_FAILED,
  INSTANCE_INFO_SDK_DUMPSTATE_FAILED,
  INSTANCE_QUERYDEF_FILE_NOT_FOUND,
  INSTANCE_QUERYDEF_SDK_CREATE_FAILED,
  INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED,
  INSTANCE_SOAP_BAD_ARGS,
  INSTANCE_SOAP_ARGS_NOT_ARRAY,
  INSTANCE_SOAP_SDK_CALL_FAILED,
} = codes;
// acc
import DomUtilAcc from "../../helpers/DomUtilAcc.js";
import AccPullLog from "../../helpers/AccPullLog.js";
import { withSpinner } from "../../helpers/withSpinner.js";
import { extractSoapReturnValues } from "../../helpers/soapResponse.js";
import {
  computeFilename,
  getTemplateAttributes,
} from "../../helpers/filenameTemplate.js";

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
 * @class AccInstance
 * @classdesc Class for managing data operations with ACC instances
 */
class AccInstance {
  /**
   * Default SQL LIMIT to fetch schemas (querydef lineCount)
   * @type {number}
   */
  CONFIG_DEFAULT_LINECOUNT = 20;

  /**
   * Logs of downloaded data
   * @type {Array<AccPullLog>}
   */
  pullLogs = [];

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
   * Gets query definition for a specific schema, merging with default config.
   *
   * @param {object} schemaConfig - Schema configuration object from acc.config.json
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
   * @param {boolean} isPreview - If true, only previews the data without saving to disk
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
    for (const [index, schemaConfig] of this.accConfig.schemas.entries()) {
      const { schemaId, filename, queryDef } = schemaConfig;
      const pullLogsForThisSchema = [];
      // save filenames to report duplicates
      const writtenPaths = new Set();
      const overwrittenPaths = [];
      // skip if metadata option was included and not matching
      if (this.metadata) {
        const metadata = this.metadata.split(",").map((id) => id.trim());
        if (!metadata.includes(schemaId)) {
          this.logger.verbose(`Skipping ${schemaId}`);
          continue;
        }
      }
      // Show queryDef warnings (ajv validation) above the schema
      for (const warning of this.accConfig.queryDefWarnings?.[index] ?? []) {
        this.logger.warn(warning);
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
        const pullLog = new AccPullLog(schemaConfig);
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
        for (const parsedPath of pullLog.parsedPaths) {
          if (writtenPaths.has(parsedPath)) {
            overwrittenPaths.push(parsedPath);
          }
          writtenPaths.add(parsedPath);
        }
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
          `AccPullLog for ${schemaId} batch starting at line ${pullLog.queryDef.startLine}:`,
        );
        this.logger.debug(pullLog.toLog());
      } while (recordsLengthOfThisBatch >= lineCount);
      const errorCount = pullLogsForThisSchema.flatMap((x) => x.errors).length;
      const errorMsg = errorCount > 0 ? `(⚠️ ${errorCount} errors)` : "";
      if (overwrittenPaths.length > 0) {
        spinner.warn(
          `${filename}: ${chalk.bgCyan(schemaId)} ${recordsParsedTotal} parsed, ${writtenPaths.size} files (⚠️ ${overwrittenPaths.length} overwritten) ${errorMsg}`,
        );
        this.logger.warn(
          `⚠️ ${schemaId}: ${overwrittenPaths.length} records were saved to a file already existing in this pull. The pagination order is not stable or the filename template is not unique. Add a unique queryDef.orderBy.node[].expr next to where. Open the logs for details. Run "acc instance template" for examples.`,
        );
        this.logger.verbose(`⚠️ Listing overwritten files for ${schemaId}:`);
        this.logger.verbose(overwrittenPaths.join("\n"));
      } else {
        spinner.succeed(
          `${filename}: ${chalk.bgCyan(schemaId)} ${recordsParsedTotal} parsed ${errorMsg}`,
        );
      }
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
   * @param {boolean} isPreview - If true, only previews the data without saving to disk
   * @param {object} pullLog - Log object to record the download and parse process
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
        const parsedPath = this.parse(element, schemaConfig, isPreview);
        const filenameOnly = path.basename(parsedPath);
        pullLog.parsedPaths.push(parsedPath);
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
   * @returns {Promise<Element>} the result collection element
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
   * @param {boolean} [cliOptions.raw] - when true, return the SOAP response as received
   * @returns {Promise<string | object>} the return values as sent by the server
   *   (one per line), the SOAP response when `raw`, or SimpleJson when `json`
   * @throws {INSTANCE_SOAP_BAD_ARGS|INSTANCE_SOAP_ARGS_NOT_ARRAY|INSTANCE_SOAP_SDK_CALL_FAILED}
   */
  async soap(cliOptions) {
    const { schema, method } = cliOptions;

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
    const highlightedLabel = chalk.bgCyan(`${schema}#${method}`);
    const result = await withSpinner(
      this.createSpinner,
      {
        text: `Calling ${highlightedLabel} on the server`,
        succeed: `${highlightedLabel} succeeded`,
        fail: `${highlightedLabel} failed`,
      },
      () =>
        this.adapterCallSoap(
          schemaKey,
          method,
          args,
          cliOptions.json,
          cliOptions.raw,
        ),
    );

    this.logger.verbose(result);
    return result;
  }

  /**
   * Adapter of the NLWS proxy dispatch for `soap()`: easier mocking and SDK
   * error wrapping. The representation (xml vs json) drives how the SDK
   * marshals the input parameters.
   *
   * The SDK casts scalars (xsd:dateTime to Date, ...), so in xml mode its result
   * is dropped and the raw response is read through an observer. Internal calls
   * (schema loading) are skipped.
   * @param {string} schemaKey camelCase schema key, e.g. "nmsDelivery"
   * @param {string} method method name (the SDK resolves either casing)
   * @param {Array} args positional arguments
   * @param {boolean} jsonEnabled when true use the SimpleJson representation
   * @param {boolean} [rawEnabled] when true (xml mode) return the whole SOAP response
   * @returns {Promise<string | object>} the return values or the SOAP response (xml), or SimpleJson (json)
   * @throws {CampaignException}
   */
  async adapterCallSoap(schemaKey, method, args, jsonEnabled, rawEnabled) {
    if (jsonEnabled) {
      try {
        return await this.client.NLWS.json[schemaKey][method](...args);
      } catch (err) {
        throw wrapSdkError(err, INSTANCE_SOAP_SDK_CALL_FAILED);
      }
    }

    let output = "";
    const rawResponseObserver = {
      // `call.response`, not the 2nd argument: it has session tokens masked.
      onSOAPCallSuccess: (call) => {
        if (!call.internal) {
          output = rawEnabled
            ? call.response
            : extractSoapReturnValues(call.response, call.methodName);
        }
      },
    };
    this.client.registerObserver(rawResponseObserver);
    try {
      await this.client.NLWS.xml[schemaKey][method](...args);
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_SOAP_SDK_CALL_FAILED);
    } finally {
      this.client.unregisterObserver(rawResponseObserver);
    }
    return output;
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

  /**
   * Writes a single record to disk (raw XML, or decomposed per `decompose`),
   * after blanking any `excludeXPaths`.
   * @param {Element} childElement - the record element
   * @param {object} schemaConfig - schema download config (filename, decompose, excludeXPaths)
   * @param {boolean} isPreview - when true, compute filenames but write nothing
   * @returns {string} the path of the saved record, relative to the download path
   */
  parse(childElement, schemaConfig, isPreview) {
    const { filename, decompose, excludeXPaths } = schemaConfig;
    const configAttributes = getTemplateAttributes(filename); // [ '@name', '@namespace' ]

    const computedFilename = computeFilename(
      filename,
      configAttributes,
      childElement,
    );
    const datapath = path.join(this.downloadPath, computedFilename);

    // prepare XML by removing excluded attributes
    if (excludeXPaths) {
      for (const xpathString of excludeXPaths) {
        const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
          childElement,
          xpathString,
        );
        if (!node) {
          continue; // not found in this record, nothing to blank
        }

        // if attribute, set it to blank
        if (attributeName !== null) {
          if (node.hasAttribute(attributeName)) {
            node.setAttribute(attributeName, "");
          }
        }
        // if element, empty its textContent
        else {
          node.textContent = "";
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
          const decomposedFilename = computeFilename(
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
          const content = DomUtilAcc.getDecomposedContent(lastNode);
          // save to file
          const datapath = path.join(this.downloadPath, decomposedFilename);
          if (!isPreview) {
            fs.outputFileSync(datapath, content);
          }
          // empty element (text and child elements): the meta keeps an empty placeholder
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

    return computedFilename;
  }
}

export default AccInstance;
