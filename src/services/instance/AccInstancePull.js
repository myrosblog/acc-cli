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
} = codes;
// acc
import DomUtilAcc from "../../helpers/DomUtilAcc.js";
import AccInstancePullLog from "../../helpers/AccInstancePullLog.js";
import {
  computeFilename,
  getTemplateAttributes,
} from "../../helpers/filenameTemplate.js";

/**
 * Pulls the records of the schemas listed in acc.config.json from an ACC
 * instance (`acc instance pull` and, with isPreview, `acc instance check`).
 * - pull():
 *   - paginates by batch of CONFIG_DEFAULT_LINECOUNT (startLine, lineCount)
 *   - download()
 *     - NLWS.xml.xtkQueryDef.create(schema)
 *     - NLWS.xml.xtkQueryDef.selectAll()
 *     - NLWS.xml.xtkQueryDef.executeQuery()
 *     - for each XML record:
 *       - parse()
 *
 * @class AccInstancePull
 */
class AccInstancePull {
  /**
   * Default SQL LIMIT to fetch schemas (querydef lineCount)
   * @type {number}
   */
  CONFIG_DEFAULT_LINECOUNT = 20;

  /**
   * Logs of downloaded data
   * @type {Array<AccInstancePullLog>}
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
   * Creates a new AccInstancePull.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {AccConfig} accConfig - Configuration object defining schemas and download options
   * @param {object} cliOptions - Command-line options including path, and metadata filters
   * @param {Function} createSpinner - Ora spinner instance for displaying progress
   * @example
   * const instancePull = new AccInstancePull(logger, client, accConfig, cliOptions, createSpinner);
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
        const pullLog = new AccInstancePullLog(schemaConfig);
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
          `AccInstancePullLog for ${schemaId} batch starting at line ${pullLog.queryDef.startLine}:`,
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

export default AccInstancePull;
