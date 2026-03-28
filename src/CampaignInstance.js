// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
// sdk
import { Client } from "@adobe/acc-js-sdk/src/client.js";
import { EntityAccessor } from "@adobe/acc-js-sdk/src/entityAccessor.js";

/**
 * Campaign Instance class for interacting with ACC instances.
 * Handles data checking, pulling, and downloading from ACC schemas.
 * - pull():
 *   - paginates by batch of 10 (startLine, lineCount)
 *   - download()
 *     - sdk.xml.xtkQueryDef.create(schema)
 *     - sdk.xml.xtkQueryDef.selectAll()
 *     - sdk.xml.xtkQueryDef.executeQuery()
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
   * Logs of downloaded data
   * @type {Array<CampaignPullLog>}
   */
  pullLogs = [];

  /**
   * Creates a new CampaignInstance.
   *
   * @param {Client} client - Authenticated ACC client
   * @param {CampaignConfig} accConfig - Configuration object defining schemas and download options
   * @param {Object} [accConfig.*] - Schema-specific configurations
   *
   * @example
   * const instance = new CampaignInstance(client, { schemas: [
   *   { schemaId: "nms:recipient", filename: "recipient_%name%.xml" }
   * ]});
   */
  constructor(client, accConfig, options) {
    this.client = client;
    this.accConfig = accConfig;
    this.verbose = options.verbose;
    this.downloadPath = options.path;
    this.metadata = options.metadata;
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
    this.log(
      `✨ ${isPreview ? "Previewing" : "Pulling"} data to ${this.downloadPath}`,
    );
    this.pullLogs = [];

    // loop schemas
    for (const schemaConfig of this.accConfig.schemas) {
      // skip if metadata option was included and not matching
      if (this.metadata && !this.metadata.includes(schemaConfig.schemaId)) {
        if (this.verbose) {
          this.log(`Skipping ${schemaConfig.schemaId}`);
        }
        continue;
      }
      const spinner = ora(`${filename}: ${chalk.bgCyan(schemaId)}`).start(); // Démarre le spinner
      // download and parse
      const lineCount = schemaConfig.queryDef?.lineCount || 10;
      let startLine = 1;
      let recordsLengthTotal = 0;
      let currentElementsPulled = [];
      do {
        if (this.verbose) {
          this.log(
            `  Querying instance for records from ${startLine} to ${startLine + lineCount - 1}...`,
          );
        }
        currentElementsPulled = await this.downloadAndParse(
          schemaConfig,
          startLine,
          lineCount,
          isPreview,
        );
        pullLog.elements.push(...currentElementsPulled);
        // increment counters
        startLine += lineCount;
        recordsLengthTotal += currentElementsPulled.length;
        pullLog.endTime = new Date();
      const errorCount = pullLogsForThisSchema.flatMap((x) => x.errors).length;
      const errorMsg = errorCount > 0 ? `(⚠️ ${errorCount} errors)` : "";
      spinner.succeed(
        `${filename}: ${chalk.bgCyan(schemaId)} ${recordsParsedTotal} parsed ${errorMsg}`,
      );
      // new line when verbose
      if (this.verbose) {
        this.log("");
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
  async downloadAndParse(schemaConfig, startLine, lineCount, isPreview) {
    const { schemaId } = schemaConfig;
    const baseQueryDef = {
      schema: schemaId,
      operation: "select",
      select: {
        node: [{ expr: "data" }],
      },
      startLine: startLine,
      lineCount: lineCount,
    };
    const queryDef = this._getQueryDefForSchema(schemaConfig, baseQueryDef);
    // console.log("queryDef", JSON.stringify(queryDef));
    const queryDefXml = DomUtil.fromJSON("queryDef", queryDef, "SimpleJson");
    let elementDownloaded;
    let elementsParsed = [];
    try {
      elementDownloaded = await this.adapterCreateAndExecuteQuery(queryDefXml); // Element, <srcSchema-collection>
    } catch (err) {
      return elementsParsed;
    }
    elementsParsed = EntityAccessor.getChildElements(elementDownloaded); // converts to Array[Element] to prefer for loops over "while+getNextSiblingElement"
    if (this.verbose) {
      this.log(
        `Downloaded XML Response with ${elementsParsed.length} children`,
      );
    }
    for (const element of elementsParsed) {
      await query.selectAll(false); // @see https://opensource.adobe.com/acc-js-sdk/xtkQueryDef.html
      const records = await query.executeQuery(); // DOMElement <srcSchema-collection><srcSchema></srcSchema>...
      // console.log("records", DomUtil.toXMLString(records));
      if (this.verbose) {
        this.log(
          `Parsing XML Response with ${records.childElementCount} children`,
        );
      }
      var child = DomUtil.getFirstChildElement(records); // @see https://opensource.adobe.com/acc-js-sdk/domHelper.html
      while (child) {
        elements.push(child);

      try {
        this.parse(element, schemaConfig, isPreview);
      } catch (err) {
        this.parse(child, schemaConfig, isPreview);

        child = DomUtil.getNextSiblingElement(child);
      }

      message = `${elements.length} saved.`;
    } catch (err) {
      message = `⚠️ Error executing query: ${err.message}.`;
    } finally {
      if (this.verbose) {
        this.log(` => ${message}`);
      }
    }
    return elements;
    return recordsLength;
      }
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
    const query = this.client.NLWS.xml.xtkQueryDef.create(queryDefXml);
    await query.selectAll(false); // @see https://opensource.adobe.com/acc-js-sdk/xtkQueryDef.html
    return query.executeQuery(); // Element <srcSchema></srcSchema><srcSchema></srcSchema>...
  }

  /**
   * manual xpath to return the last Element
   * - abc/def => def
   * - abc/def/@ghi => def
   *
   * @param {Element} element
   * @param {string} xpath
   * @return Element
   */
  _getLastElement(element, xpath) {
    let childTraverse = element;
    xpath.split(this.CONFIG_XPATH_SEP).forEach((xp) => {
      if (xp.startsWith(this.CONFIG_XPATH_ATTR)) {
        return;
      }
      childTraverse = DomUtil.getFirstChildElement(childTraverse, xp);
    });
    return childTraverse;
  }

  parse(childElement, schemaConfig, isPreview) {
    // console.log(`>>> parse with isPreview:${isPreview}`);
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
      for (let xpath of excludeXPaths) {
        const chunks = xpath.split(this.CONFIG_XPATH_SEP);
        const childTraverse = this._getLastElement(childElement, xpath);

        // remove attribute
        if (xpath.includes(this.CONFIG_XPATH_ATTR)) {
          const attribute = chunks[chunks.length - 1];
          const attributeName = attribute.replace(this.CONFIG_XPATH_ATTR, "");
          if (!childTraverse.hasAttribute(attributeName)) {
            continue;
          }
          childTraverse.setAttribute(attributeName, "");
        }
        // remove element
        else {
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
      for (const [xpath, filenameTemplate] of Object.entries(decompose)) {
        try {
          // compute filename
          const decomposedFilename = this._computeFilename(
            filenameTemplate,
            configAttributes,
            childElement,
          );
          // then traverse xpath
          let childTraverse = this._getLastElement(childElement, xpath);
          const elementValue = DomUtil.elementValue(childTraverse);
          // save to file
          const datapath = path.join(this.downloadPath, decomposedFilename);
          if (!isPreview) {
            fs.outputFileSync(datapath, elementValue);
          }
          const decomposedFilenameOnly = path.basename(decomposedFilename);
          if (this.verbose) {
            this.log(`${chalk.underline(decomposedFilenameOnly)} `, false);
          }
          // removeElement
          if (childTraverse) {
            childTraverse.textContent = ""; // @since 0.5.1, instead of removeChild that removed attributes
          }
        } catch (err) {
          this.log(`(⚠️ warning:parse ${err.message})`);
        }
      }
      // 2. save meta
      const metaContent = DomUtil.toXMLString(childElement);
      if (!isPreview) {
        fs.outputFileSync(datapath, metaContent);
      }
    }

    if (this.verbose) {
      this.log(`${chalk.underline(filenameOnly)} `, false);
    }
  }

  _getAttributesFromSchemaConfig(schemaConfig) {
    const configAttributesRe = schemaConfig.filename.matchAll(
      this.REGEX_CONFIG_ATTRIBUTE,
    ); // [object RegExp String Iterator]
    const configAttributesArr = Array.from(configAttributesRe); // [ [ '@name', '@name' ], ... ]
    return configAttributesArr.map((attr) => attr[1]); // [ '@name', '@namespace' ]
  }

  _computeFilename(configFilename, configAttributes, record) {
    var filename = configFilename;
    for (let configAttribute of configAttributes) {
      const value = DomUtil.getAttributeAsString(
        record,
        configAttribute.replace(this.CONFIG_XPATH_ATTR, ""),
      );
      filename = filename.replace(`{${configAttribute}}`, value);
    }
    return filename;
  }

  log(text, newLine = true) {
    if (newLine) {
      console.log(text);
    } else {
      process.stdout.write(text);
    }
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

  constructor(schemaConfig) {
    this.startTime = new Date();
    this.elements = [];
    this.schemaConfig = schemaConfig;
  }
}

export default CampaignInstance;
