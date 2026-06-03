// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import { Client } from "@adobe/acc-js-sdk/src/client.js";
import { EntityAccessor } from "@adobe/acc-js-sdk/src/entityAccessor.js";
import { DomUtil, XPath } from "@adobe/acc-js-sdk/src/domUtil.js";
import { codes, wrapSdkError } from "./helpers/AccErrors.js";
const {
  INSTANCE_PULL_SDK_CREATEQUERY_FAILED,
  INSTANCE_PULL_SDK_SELECTALL_FAILED,
  INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
  INSTANCE_EXEC_NO_SCRIPT,
  INSTANCE_EXEC_BOTH_SCRIPT,
  INSTANCE_EXEC_FILE_NOT_FOUND,
  INSTANCE_EXEC_SDK_EVALUATE_FAILED,
} = codes;
import AioLogger from "@adobe/aio-lib-core-logging";
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
   * XPath separator character
   * @type {string}
   */
  CONFIG_XPATH_SEP = "/";

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
   * @param {Object} cliOptions - Command-line options including path, and metadata filters
   * @param {function} createSpinner - Ora spinner instance for displaying progress
   *
   * @example
   * const instance = new CampaignInstance(client, { schemas: [
   *   { schemaId: "nms:recipient", filename: "recipient_%name%.xml" }
   * ]});
   */
  constructor(logger, client, accConfig, cliOptions, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.accConfig = accConfig;
    this.downloadPath = cliOptions.path;
    this.metadata = cliOptions.metadata;
    this.createSpinner = createSpinner;
    /**
     * Array of schema names to process (excluding default config)
     * @type {string[]}
     */
    this.schemas = Object.keys(this.accConfig);
  }

  /**
   * Gets query definition for a specific schema, merging with default config.
   *
   * @param {string} schema - Schema name (e.g., 'nms:recipient')
   * @param {Object} baseQueryDef - Base query definition
   * @returns {Object} Merged query definition
   *
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
   * @returns {Promise<void>} Resolves when pull operation is complete
   *
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
   * @param {Object} schemaConfig - Schema download config
   * @param {number} startLine - Starting line number for pagination
   * @param {number} lineCount - Size of pagination
   * @returns {Array<Element>} Number of records downloaded
   *
   * @example
   * const count = await instance.download('nms:recipient', '/path/to/save', 1);
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
      startLine: startLine,
      lineCount: lineCount,
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
        const filenameOnly = this.parse(
          element,
          schemaConfig,
          isPreview,
          pullLog,
        );
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
   * @param {Object} cliOptions - Command-line options
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
    this.logger.info(resultXml);
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
   *
   * @param {Element} childElement
   * @param {*} schemaConfig
   * @param {boolean} isPreview
   * @return string filenameOnly
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
      for (let xpathString of excludeXPaths) {
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
          const decomposedFilenameOnly = path.basename(decomposedFilename);
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
    for (let configAttribute of configAttributes) {
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
    return String(value)
      .replace(/[/\\]/g, "_") // POSIX + Windows path separators
      .replace(/[\x00-\x1f]/g, "") // NUL + control characters
      .replace(/^\.+$/, (dots) => "_".repeat(dots.length)); // "." / ".." -> "_" / "__"
  }
}

/**
 * Log data retrieved by CampaignInstance.pull() for troubleshooting and auditing
 * 1 instance per batch, i.e. 15 records with lineCount=10 yields 2 CampaignPullLogs
 * @class CampaignPullLog
 */
class CampaignPullLog {
  /**
   * @type {Object}
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
   * @type {Object}
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

  constructor(schemaConfig, lineCount, startLine) {
    this.startTime = new Date();
    this.elements = [];
    this.schemaConfig = schemaConfig;
    this.errors = [];
  }
}

export default CampaignInstance;
