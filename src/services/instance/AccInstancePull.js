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
 * Pulls the records of the schemas listed in acc.config.json (`acc instance
 * pull`, and `acc instance check` with isPreview). Each schema is read in
 * batches through xtk:queryDef (create, selectAll, executeQuery), and every
 * record goes through parse().
 *
 * @class AccInstancePull
 */
class AccInstancePull {
  /**
   * Records per batch (queryDef lineCount) when the config sets none
   * @type {number}
   */
  CONFIG_DEFAULT_LINECOUNT = 20;

  /**
   * One log per downloaded batch
   * @type {Array<AccInstancePullLog>}
   */
  pullLogs = [];

  /** @type {AioLogger} */
  logger;

  /** @type {Function} spinner factory, injected for unit tests */
  createSpinner;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {Client} client - Authenticated ACC client
   * @param {AccConfig} accConfig - Schemas and download options (acc.config.json)
   * @param {object} cliOptions - Command-line options: `path` (download folder) and `metadata` (comma-separated schema ids)
   * @param {Function} createSpinner - Spinner factory
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
   * Merges the queryDef of the schema config over the base queryDef.
   *
   * @param {object} schemaConfig - Schema entry of acc.config.json
   * @param {object} baseQueryDef - Base queryDef
   * @returns {object} The merged queryDef
   */
  _getQueryDefForSchema(schemaConfig, baseQueryDef) {
    const configQueryDef = schemaConfig.queryDef ? schemaConfig.queryDef : {};

    return {
      ...baseQueryDef,
      ...configQueryDef,
    };
  }

  /**
   * Pulls every schema of the config, in batches of lineCount records.
   *
   * @param {boolean} isPreview - When true, parse the records without writing files
   */
  async pull(isPreview) {
    this.logger.info(
      `✨ ${isPreview ? "Previewing" : "Pulling"} data to ${this.downloadPath}`,
    );
    this.pullLogs = [];

    for (const [index, schemaConfig] of this.accConfig.schemas.entries()) {
      const { schemaId, filename, queryDef } = schemaConfig;
      const pullLogsForThisSchema = [];
      // to report duplicates
      const writtenPaths = new Set();
      const overwrittenPaths = [];
      // --metadata: skip the schemas that are not listed
      if (this.metadata) {
        const metadata = this.metadata.split(",").map((id) => id.trim());
        if (!metadata.includes(schemaId)) {
          this.logger.verbose(`Skipping ${schemaId}`);
          continue;
        }
      }
      // queryDef warnings (ajv validation), shown above the schema
      for (const warning of this.accConfig.queryDefWarnings?.[index] ?? []) {
        this.logger.warn(warning);
      }
      const spinner = this.createSpinner(
        `${filename}: ${chalk.bgCyan(schemaId)}`,
      ).start();
      const lineCount = queryDef?.lineCount || this.CONFIG_DEFAULT_LINECOUNT;
      // startLine is 0-based, like the Adobe Campaign console
      let startLine = 0;
      let recordsParsedTotal = 0;
      let recordsLengthOfThisBatch = 0;
      // one iteration per batch
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
        // When the total is a multiple of lineCount, the last batch is empty, as
        // in the console. Drop it from the logs and stop.
        if (recordsLengthOfThisBatch === 0 && pullLog.errors.length === 0) {
          this.pullLogs.pop();
          pullLogsForThisSchema.pop();
          break;
        }
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
      const flatErrors = pullLogsForThisSchema.flatMap((x) => x.errors);
      if (flatErrors.length > 0) {
        this.logger.verbose(`⚠️ Listing errors for ${schemaId}:`);
        this.logger.verbose(flatErrors.join("\n"));
      }
    }
  }

  /**
   * Downloads one batch of a schema and writes its records as XML files.
   *
   * @param {object} schemaConfig - Schema entry of acc.config.json
   * @param {number} startLine - First line of the batch (0-based)
   * @param {number} lineCount - Batch size
   * @param {boolean} isPreview - When true, parse the records without writing files
   * @param {object} pullLog - Log of the batch, filled in here
   * @returns {Promise<Array<Element>>} The records of the batch
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
      elementsParsed = EntityAccessor.getChildElements(elementDownloaded); // an Array, to use for...of rather than getNextSiblingElement
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
    if (filenamesForThisBatch.length > 0) {
      this.logger.verbose(filenamesForThisBatch.join(", "));
    }

    return elementsParsed;
  }

  /**
   * Wraps the SDK queryDef calls (create, selectAll, executeQuery), to mock them
   * in tests, keep the XML format in one place and wrap SDK errors.
   *
   * @param {Document} queryDefXml - Built with DomUtil.fromJSON
   * @returns {Promise<Element>} The result collection
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
   * Writes one record to disk, as raw XML or decomposed per `decompose`, after
   * blanking the `excludeXPaths`.
   *
   * @param {Element} childElement - The record
   * @param {object} schemaConfig - Schema entry (filename, decompose, excludeXPaths)
   * @param {boolean} isPreview - When true, compute the filename but write nothing
   * @returns {string} The path of the record, relative to the download path
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

    if (excludeXPaths) {
      for (const xpathString of excludeXPaths) {
        const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
          childElement,
          xpathString,
        );
        if (!node) {
          continue; // not found in this record, nothing to blank
        }

        if (attributeName !== null) {
          if (node.hasAttribute(attributeName)) {
            node.setAttribute(attributeName, "");
          }
        } else {
          node.textContent = "";
        }
      }
    }

    // no decompose: the raw XML
    if (!decompose) {
      const raw = DomUtil.toXMLString(childElement);
      if (!isPreview) {
        fs.outputFileSync(datapath, raw);
      }
    }
    // decompose: each xpath goes to its own file, the meta file keeps the rest
    else {
      for (const [xpathString, filenameTemplate] of Object.entries(decompose)) {
        try {
          const decomposedFilename = computeFilename(
            filenameTemplate,
            configAttributes,
            childElement,
          );
          const lastNode = DomUtilAcc.findLastElement(
            childElement,
            xpathString,
          );
          if (!lastNode) {
            continue; // optional xpath: skip when absent
          }
          const content = DomUtilAcc.getDecomposedContent(lastNode);
          const decomposedPath = path.join(
            this.downloadPath,
            decomposedFilename,
          );
          if (!isPreview) {
            fs.outputFileSync(decomposedPath, content);
          }
          // the meta file keeps an empty placeholder
          lastNode.textContent = "";
        } catch (err) {
          this.logger.verbose(`(⚠️ warning:parse ${err.message})`);
        }
      }
      const metaContent = DomUtil.toXMLString(childElement);
      if (!isPreview) {
        fs.outputFileSync(datapath, metaContent);
      }
    }

    return computedFilename;
  }
}

export default AccInstancePull;
