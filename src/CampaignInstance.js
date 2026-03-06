// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// acc
import CampaignError from "./CampaignError.js";

/**
 * Campaign Instance class for interacting with ACC instances.
 * Handles data checking, pulling, and downloading from ACC schemas.
 * - check()
 *   - xml.xtkQueryDef.create(schema)
 *   - adds attributes from the config
 *   - xml.xtkQueryDef.executeQuery() and parses to get records.length
 * - pull(), very similar:
 *   - paginates by batch of 10 (startLine, lineCount)
 *   - download()
 *     - xml.xtkQueryDef.create(schema)
 *     - xml.xtkQueryDef.selectAll()
 *     - for each XML record:
 *       - parse()
 *
 * @class CampaignInstance
 * @classdesc Class for managing data operations with ACC instances
 */
class CampaignInstance {
  REGEX_CONFIG_ATTRIBUTE = /{(.+?)}/g;
  CONFIG_XPATH_SEP = "/";

  /**
   * Creates a new CampaignInstance.
   *
   * @param {Object} client - Authenticated ACC client
   * @param {Object} campaignConfig - Configuration object defining schemas and download options
   * @param {Object} campaignConfig.default - Default configuration for all schemas
   * @param {Object} [campaignConfig.*] - Schema-specific configurations
   *
   * @example
   * const instance = new CampaignInstance(client, {
   *   default: { filename: "%schema%_%name%.xml" },
   *   "nms:recipient": { filename: "recipient_%name%.xml" }
   * });
   */
  constructor(client, campaignConfig, options = { verbose: false }) {
    this.client = client;
    this.campaignConfig = campaignConfig;
    this.verbose = options.verbose;
    /**
     * Array of schema names to process (excluding default config)
     * @type {string[]}
     */
    this.schemas = Object.keys(this.campaignConfig);

    this.client.registerObserver({
      onSOAPCall: (soapCall, safeRequestData) => {
        // this.saveArchiveRequest(soapCall.request.data);
      },
      onSOAPCallSuccess: (soapCall, safeResponseData) => {
        // this.saveArchiveResponse(soapCall.response);
      },
      onSOAPCallFailure: (soapCall, error) => {
        // this.saveArchiveResponse(soapCall.response);
      },
    });
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
  _getQueryDefForSchema(schema, baseQueryDef) {
    const config = this.campaignConfig[schema];
    const configQueryDef = config.queryDef ? config.queryDef : {};

    return {
      ...baseQueryDef,
      ...configQueryDef,
    };
  }

  /**
   * Checks the ACC instance & config by getting records for each schema:
   * - xtkQueryDef.create(schema)
   * - adds attributes from the config
   * - calls executeQuery() and parses to get records.length
   * - if verbose, outputs the list of filenames to be created
   *
   * @param {string} downloadPath - Path where data would be downloaded
   * @returns {Promise<void>} Resolves when check is complete
   * @throws {CampaignError} Throws if download path is not empty
   *
   * @example
   * await instance.check('/path/to/download');
   */
  async check(options) {
    console.log("📡 Checking instance...");
    // don't deconstruct "path" to avoid confusion with the "path" module
    const { verbose } = options;

    for (const [schemaId, schemaConfig] of Object.entries(
      this.campaignConfig,
    )) {
      const baseQueryDef = {
        schema: schemaId,
        operation: "select",
        select: { node: [] },
      };
      const queryDef = this._getQueryDefForSchema(schemaId, baseQueryDef);
      // get all attributes from the config
      const configAttributes =
        this._getAttributesFromSchemaConfig(schemaConfig); // [ '@name', '@namespace' ]
      queryDef.select.node = configAttributes.map((attr) => ({ expr: attr }));
      // API call
      const query = this.client.NLWS.xtkQueryDef.create(queryDef);
      // parsing
      let message = "";
      try {
        const data = await query.executeQuery();
        const firstKey = Object.keys(data)[0];
        const records = data[firstKey] || [];
        message = `${records.length} found (${chalk.bgCyan(schemaId)}).`;
        if (verbose) {
          message +=
            "\n" +
            records
              .map((record) => {
                const filepath = this._computeFilename(
                  schemaConfig.filename,
                  configAttributes,
                  record,
                );
                const filenameOnly = path.basename(filepath);
                return `${chalk.underline(filenameOnly)}`;
              })
              .join(" ");
        }
      } catch (err) {
        message = `⚠️ Error executing query: ${err.message}.`;
      } finally {
        console.log(`- ${schemaConfig.filename}: ` + message + "\n");
      }
    }

    console.log(`📂 Will be downloaded to ${options.path}`);

    // if (!this.isFolderEmpty(downloadPath)) {
    //   throw new CampaignError(
    //     `Directory already exists and is not empty. Please choose an empty directory or a different path.`,
    //   );
    // }
  }

  /**
   * Pulls data from all schemas in the ACC instance.
   * Implements pagination to handle large datasets.
   *
   * @param {string} downloadPath - Path where data will be downloaded
   * @returns {Promise<void>} Resolves when pull operation is complete
   *
   * @example
   * await instance.pull('/path/to/download');
   */
  async pull(options) {
    const { path: downloadPath } = options;
    console.log(`✨ Pulling instance to ${downloadPath}...`);
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    if (!this.isFolderEmpty(downloadPath)) {
      //   throw new CampaignError(
      //     `Directory already exists and is not empty. Please choose an empty directory or a different path.`,
      //   );
    }

    for (const [schemaId, schemaConfig] of Object.entries(
      this.campaignConfig,
    )) {
      console.log(`- Schema ${chalk.bgCyan(schemaId)}`);

      const lineCount = 10;
      let startLine = 1;
      let recordsLength = 0;
      do {
        console.log(
          `  Downloading lines ${startLine} to ${startLine + lineCount - 1}...`,
        );
        recordsLength = await this.downloadAndParse(
          schemaId,
          downloadPath,
          startLine,
          options,
        );
        startLine += lineCount;
      } while (recordsLength >= lineCount);
    }
  }

  /**
   * Downloads records from a specific schema and saves them as XML files.
   *
   * @param {string} schemaId - Schema name to download
   * @param {string} folderPath - Path where files will be saved
   * @param {number} startLine - Starting line number for pagination
   * @returns {Promise<number>} Number of records downloaded
   *
   * @example
   * const count = await instance.download('nms:recipient', '/path/to/save', 1);
   */
  async downloadAndParse(schemaId, folderPath, startLine, options) {
    const DomUtil = this.client.DomUtil;

    const baseQueryDef = {
      schema: schemaId,
      operation: "select",
      select: {
        node: [{ expr: "data" }],
      },
      startLine: startLine,
      lineCount: 10, // @todo pagination
    };
    const queryDef = this._getQueryDefForSchema(schemaId, baseQueryDef);
    const queryDefXml = this.client.DomUtil.fromJSON(
      "queryDef",
      queryDef,
      "SimpleJson",
    );

    const query = this.client.NLWS.xml.xtkQueryDef.create(queryDefXml);

    const config = this.campaignConfig[schemaId];

    let message = "";
    var recordsLength = 0;
    try {
      await query.selectAll(false); // @see https://opensource.adobe.com/acc-js-sdk/xtkQueryDef.html
      const records = await query.executeQuery(); // DOMDocument <srcSchema-collection><srcSchema></srcSchema>...
      var child = DomUtil.getFirstChildElement(records);
      // @see https://opensource.adobe.com/acc-js-sdk/domHelper.html
      while (child) {
        recordsLength++;

        this.parse(child, config, folderPath);

        child = DomUtil.getNextSiblingElement(child);
      }

      message = `${recordsLength} saved.`;
    } catch (err) {
      message = `⚠️ Error executing query: ${err.message}.`;
    } finally {
      console.log(` => ` + message + "\n");
    }
    return recordsLength;
  }

  parse(childElement, config, folderPath) {
    const configFilename = config.filename;
    const configDecompose = config.decompose;
    const configAttributes = this._getAttributesFromSchemaConfig(config); // [ '@name', '@namespace' ]
    const DomUtil = this.client.DomUtil;

    const filename = this._computeFilename(
      configFilename,
      configAttributes,
      childElement,
      false,
    );
    const filenameOnly = path.basename(filename);
    const datapath = path.join(folderPath, filename);

    // no decomposition: save raw XML
    if (!configDecompose) {
      const raw = DomUtil.toXMLString(childElement);
      fs.outputFileSync(datapath, raw);
    }
    // with decomposition: save each xpath, then save the clean meta
    else {
      // 1. save each xpath + removeElement
      for (const [xpaths, filenameTemplate] of Object.entries(
        configDecompose,
      )) {
        // compute filename
        const decomposedFilename = this._computeFilename(
          filenameTemplate,
          configAttributes,
          childElement,
          false,
        );
        // then traverse xpath
        let childTraverse = childElement;
        xpaths.split(this.CONFIG_XPATH_SEP).forEach((xpath) => {
          childTraverse = DomUtil.getFirstChildElement(childTraverse, xpath);
        });
        const elementValue = DomUtil.elementValue(childTraverse);
        // save to file
        const datapath = path.join(folderPath, decomposedFilename);
        fs.outputFileSync(datapath, elementValue);
        const decomposedFilenameOnly = path.basename(decomposedFilename);
        process.stdout.write(`${chalk.underline(decomposedFilenameOnly)} `);
        // removeElement
        const parent = childTraverse.parentNode;
        parent.removeChild(childTraverse);
      }
      // 2. save meta
      const metaContent = DomUtil.toXMLString(childElement);
      fs.outputFileSync(datapath, metaContent);
    }
    process.stdout.write(`${chalk.underline(filenameOnly)} `);
  }

  _getAttributesFromSchemaConfig(schemaConfig) {
    const configAttributesRe = schemaConfig.filename.matchAll(
      this.REGEX_CONFIG_ATTRIBUTE,
    ); // [object RegExp String Iterator]
    const configAttributesArr = Array.from(configAttributesRe); // [ [ '@name', '@name' ], ... ]
    return configAttributesArr.map((attr) => attr[1]); // [ '@name', '@namespace' ]
  }

  _computeFilename(configFilename, configAttributes, record, json = true) {
    const DomUtil = this.client.DomUtil;
    var filename = configFilename;
    for (let configAttribute of configAttributes) {
      const value = json
        ? record[configAttribute.replace("@", "")]
        : DomUtil.getAttributeAsString(
            record,
            configAttribute.replace("@", ""),
          );
      filename = filename.replace(`{${configAttribute}}`, value);
    }
    return filename;
  }

  /**
   * Checks if a folder is empty or doesn't exist.
   *
   * @param {string} path - Path to check
   * @returns {boolean} True if folder is empty or doesn't exist, false otherwise
   *
   * @example
   * if (instance.isFolderEmpty('/path/to/check')) {
   *   // Folder is empty or doesn't exist
   * }
   */
  isFolderEmpty(path) {
    return !fs.existsSync(path) || fs.readdirSync(path).length === 0;
  }

  /**
   * Saves SOAP request to archive file with timestamp.
   *
   * @param {string} rawRequest - Raw SOAP request XML
   * @returns {void}
   *
   * @example
   * instance.saveArchiveRequest('<soap:Envelope>...</soap:Envelope>');
   */
  saveArchiveRequest(rawRequest) {
    const archiveRequest =
      "archives/" + this.getArchiveDate() + "-CampaignInstance-request.xml";
    fs.outputFileSync(archiveRequest, rawRequest, function (errFs) {
      throw errFs;
    });
  }

  /**
   * Saves SOAP response to archive file with timestamp.
   *
   * @param {string} rawResponse - Raw SOAP response XML
   * @returns {void}
   *
   * @example
   * instance.saveArchiveResponse('<soap:Envelope>...</soap:Envelope>');
   */
  saveArchiveResponse(rawResponse) {
    const archiveResponse =
      "archives/" + this.getArchiveDate() + "-CampaignInstance-response.xml";
    fs.outputFileSync(archiveResponse, rawResponse, function (errFs) {
      throw errFs;
    });
  }

  /**
   * Generates timestamp string for archive files in format: YYYY/MM/DD/HH-mm-ss_ms
   *
   * @returns {string} Formatted timestamp string
   *
   * @example
   * const timestamp = instance.getArchiveDate(); // "2023/01/15/14-30-45_123"
   */
  getArchiveDate() {
    var ts_hms = new Date();

    return (
      ts_hms.getFullYear() +
      "/" +
      ("0" + (ts_hms.getMonth() + 1)).slice(-2) +
      "/" +
      ("0" + ts_hms.getDate()).slice(-2) +
      "/" +
      ("0" + ts_hms.getHours()).slice(-2) +
      "-" +
      ("0" + ts_hms.getMinutes()).slice(-2) +
      "-" +
      ("0" + ts_hms.getSeconds()).slice(-2) +
      "_" +
      ts_hms.getMilliseconds()
    );
  }
}

export default CampaignInstance;
