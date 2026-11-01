// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import DomUtilAcc from "../../helpers/DomUtilAcc.js";
import AccInstancePushLog from "../../helpers/AccInstancePushLog.js";
import {
  buildWatchTargets,
  findMatchingTargets,
  getDecomposedSchemas,
  toPosixPath,
} from "../../helpers/watchTargets.js";
import { formatKeyValues, getWriteKey } from "../../helpers/writeKey.js";
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const {
  INSTANCE_PUSH_FILE_NOT_IN_SCOPE,
  INSTANCE_PUSH_META_FILE_MISSING,
  INSTANCE_PUSH_SCHEMA_NOT_FOUND,
  INSTANCE_PUSH_FAILED,
} = codes;

/**
 * Pushes a decomposed file to the instance, wrapped in CDATA, and writes the
 * payload to the `dist` folder of the project, so the SOAP call can be audited
 *
 * Main function push: _findSchemaForFile, _getMetadataDocument,
 * _pushEntityToServer.
 *
 * @class AccInstancePush
 */
class AccInstancePush {
  /**
   * Folder of the built payloads, relative to the project path
   * @type {string}
   */
  static DIST_DIRNAME = "dist";

  /** @type {AioLogger} */
  logger;

  /** @type {Client} */
  client;

  /** @type {AccConfig} */
  accConfig;

  /** @type {string} */
  projectPath;

  /** @type {Function} spinner factory, injected for unit tests */
  createSpinner;

  /**
   * Spinner of the file being pushed
   * @type {object}
   */
  spinner;

  /** @type {string} */
  spinnerFilename;

  /** @type {string} */
  spinnerMetadata;

  /**
   * Reconciliation keys of the pushed entity, undefined until resolved
   * @type {string | undefined}
   */
  spinnerKeys;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {Client} client - Authenticated ACC client
   * @param {AccConfig} accConfig - Schemas and their `decompose` config (acc.config.json)
   * @param {object} cliOptions - Command-line options: `path` (project folder)
   * @param {Function} createSpinner - Spinner factory
   */
  constructor(logger, client, accConfig, cliOptions, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.accConfig = accConfig;
    this.projectPath = cliOptions.path || process.cwd();
    this.createSpinner = createSpinner;
  }

  /**
   * One target per `decompose` entry. Patterns are relative to `projectPath`
   * and use "/" separators.
   * @type {Array<{pattern: string, schemaConfig: object, xpath: string}>}
   */
  get watchTargets() {
    return buildWatchTargets(getDecomposedSchemas(this.accConfig.schemas));
  }

  /**
   * Finds the target (schema config and xpath) of a changed file.
   *
   * @param {string} filePath - Changed file, relative to the watch path
   * @returns {{pattern: string, schemaConfig: object, xpath: string}|null} The matching target, or null
   */
  _findSchemaForFile(filePath) {
    const matches = findMatchingTargets(this.watchTargets, filePath);

    if (matches.length === 0) {
      return null;
    }
    if (matches.length > 1) {
      // Two entries claiming one file is a config problem: report it instead of
      // picking silently.
      this.logger.warn(
        `${toPosixPath(filePath)} matches ${matches.length} decompose patterns, using ${matches[0].schemaConfig.schemaId}`,
      );
    }
    return matches[0];
  }

  /**
   * Handles an added or changed file: rebuilds the entity and pushes it.
   *
   * @param {string} filePath - Changed file, relative to the watch path
   */
  async push(filePath) {
    this.spinnerFilename = path.basename(filePath);
    this.spinnerKeys = undefined; // resolved later, from the schema of this file

    this.spinner = this.createSpinner(
      this._getSpinnerPrefix(0) + `content changed`,
    ).start();

    let match, absolutePath;

    try {
      // path.resolve leaves an already absolute path untouched
      absolutePath = path.resolve(this.projectPath, filePath);

      this.logger.verbose(`File changed: ${absolutePath}`);

      match = this._findSchemaForFile(filePath);
      if (!match) {
        throw new INSTANCE_PUSH_FILE_NOT_IN_SCOPE();
      }
    } catch (err) {
      this.logger.error(err);
      this.spinner.fail(
        this._getSpinnerPrefix(0) +
          `not part of any decomposed schema, skipping.`,
      );
      return;
    }

    const { schemaConfig, xpath } = match;
    let currentContent, metadataDocument;

    try {
      currentContent = fs.readFileSync(absolutePath, "utf8");

      metadataDocument = await this._getMetadataDocument(
        schemaConfig,
        absolutePath,
        xpath,
      );

      if (!metadataDocument) {
        throw new Error(`Could not get metadata for ${absolutePath}`);
      }
    } catch (err) {
      this.logger.error(err);
      this.spinner.fail(
        this._getSpinnerPrefix(1) + `Exception: ${err.message}`,
      );
      return;
    }

    try {
      const pushed = await this._pushEntityToServer(
        xpath,
        currentContent,
        metadataDocument,
        schemaConfig,
        absolutePath,
      );
      if (!pushed) {
        this.spinner.warn(this._getSpinnerPrefix(2) + `not pushed`);
        return;
      }

      this.spinner.succeed(
        this._getSpinnerPrefix(2) +
          `Write successful to ${chalk.cyan(schemaConfig.schemaId)}`,
      );
      this.logger.verbose(
        `✅ ${chalk.green(path.basename(absolutePath))} pushed to ${chalk.cyan(schemaConfig.schemaId)}`,
      );
    } catch (err) {
      this.spinner.fail(
        this._getSpinnerPrefix(2) + `Exception: ${err.message}`,
      );
      this.logger.error(
        `❌ Failed to push ${path.basename(absolutePath)}: ${err.message}`,
      );
    }
  }

  /**
   * Builds the spinner prefix: Watch, then Metadata (stage 1), then Push (stage 2).
   *
   * @param {number} stage - 0 (watch), 1 (metadata) or 2 (push)
   * @returns {string} Text placed before the step message
   */
  _getSpinnerPrefix(stage) {
    let prefix = `Push(${chalk.green(this.spinnerFilename)})`;
    if (stage > 0) {
      prefix += `>Metadata(xpath: ${chalk.yellow(this.spinnerMetadata)})`;
    }
    if (stage > 1) {
      prefix += this.spinnerKeys
        ? `>Push(${chalk.blue(this.spinnerKeys)})`
        : `>Push`;
    }
    prefix += ": ";
    return prefix;
  }

  /**
   * Loads and parses the meta XML file of a decomposed file.
   *
   * @param {object} schemaConfig - Schema entry of acc.config.json
   * @param {string} filePath - Changed decomposed file
   * @param {string} xpath - xpath key of the decompose config
   * @returns {Promise<Document>} The meta document
   * @throws {Error} If the meta file is missing, unreadable or has no root element
   */
  async _getMetadataDocument(schemaConfig, filePath, xpath) {
    this.spinnerMetadata = xpath;

    this.spinner.text =
      this._getSpinnerPrefix(1) +
      `Building ${chalk.cyan(schemaConfig.schemaId)} from ${chalk.cyan(path.basename(filePath))}`;

    const metaFilePath = this._getMetaFilePath(filePath);

    if (!fs.existsSync(metaFilePath)) {
      throw new INSTANCE_PUSH_META_FILE_MISSING({
        messageValues: [metaFilePath],
      });
    }

    const metaXmlContent = fs.readFileSync(metaFilePath, "utf8"); // @throws
    const document = DomUtil.parse(metaXmlContent); // @throws

    const rootElement = document.documentElement;
    if (!rootElement) {
      throw new Error(`No root element found in meta XML`);
    }

    return document;
  }

  /**
   * Builds the meta file path of a decomposed file: same folder and base name,
   * with the `.meta.xml` extension.
   *
   * @param {string} decomposedFilePath - Decomposed file, e.g. cus/myScript.js
   * @returns {string} Meta file, e.g. cus/myScript.meta.xml
   */
  _getMetaFilePath(decomposedFilePath) {
    const dir = path.dirname(decomposedFilePath);

    const baseName = path.basename(
      decomposedFilePath,
      path.extname(decomposedFilePath),
    );

    // Simplified: the meta file is assumed to share the base name of the
    // decomposed file, rather than follow the filename template of the config
    return path.join(dir, baseName + ".meta.xml");
  }

  /**
   * Writes the rebuilt entity to the instance with xtk:session#Write
   * (_operation "update").
   *
   * @param {string} xpath - xpath key of the decompose config
   * @param {string} currentContent - Content of the changed file
   * @param {Document} metadataDocument - Meta document of the entity
   * @param {object} schemaConfig - Schema entry of acc.config.json
   * @param {string} filePath - Absolute path of the changed file, mirrored in dist and logged for auditing
   * @returns {Promise<boolean>} true when pushed, false when skipped (XML element)
   * @throws {INSTANCE_PUSH_FAILED} If the write fails
   */
  async _pushEntityToServer(
    xpath,
    currentContent,
    metadataDocument,
    schemaConfig,
    filePath,
  ) {
    const { schemaId } = schemaConfig;
    const pushLog = new AccInstancePushLog(schemaConfig);
    pushLog.filePath = filePath;
    pushLog.xpath = xpath;

    try {
      const rootElement = metadataDocument.documentElement;

      if (!rootElement) {
        throw new Error("No root element in entity XML");
      }

      const schema = await this.client.application.getSchema(schemaId);
      if (!schema) {
        throw new INSTANCE_PUSH_SCHEMA_NOT_FOUND({
          messageValues: [schemaId],
        });
      }

      // The reconciliation key comes from the schema
      const { key, keyValues } = getWriteKey(schema, rootElement);
      pushLog.keyValues = keyValues;
      this.spinnerKeys = formatKeyValues(keyValues);

      this.logger.verbose(
        `AccInstancePushLog for ${schemaId} on ${key.isInternal ? "internal" : "external"} key "${key.name}"`,
      );

      // Only text values (e.g. a delivery html source) can be pushed: a CDATA
      // section would overwrite the child elements of an element (e.g. workflow
      // activities)
      if (await this._isElementOnly(schema, xpath)) {
        this.logger.warn(
          `${schemaId} "${xpath}" is an XML element: pushing it is not supported yet, the file was not pushed.`,
        );
        return false;
      }

      this.spinner.text = this._getSpinnerPrefix(2) + `Writing to the instance`;

      const { payloadDocument, distPath } = this.build(
        filePath,
        xpath,
        currentContent,
        schema,
        keyValues,
      );

      pushLog.operation = "update";
      pushLog.payloadXml = payloadDocument;
      pushLog.distPath = distPath;

      await this.adapterWrite(payloadDocument);
      return true;
    } catch (err) {
      this.logger.verbose(`  Push failed: ${err.message || String(err)}`);
      pushLog.error = err;

      // adapterWrite already wraps SDK failures: wrapping again would nest the
      // message
      if (err?.sdk === "acc") {
        throw err;
      }
      throw wrapSdkError(err, INSTANCE_PUSH_FAILED, { schemaId });
    } finally {
      pushLog.endTime = new Date();
      this.logger.debug(pushLog.toLog());
    }
  }

  /**
   * Builds the xtk:session#Write payload of a decomposed file: the content as
   * CDATA at the xpath, with the reconciliation key, then writes it to `dist`.
   *
   * @param {string} filePath - Absolute path of the decomposed file
   * @param {string} xpath - xpath key of the decompose config
   * @param {string} content - Content of the decomposed file
   * @param {XtkSchema} schema - Schema of the entity, from the SDK
   * @param {Array<{xpath: string, attributeName: string, value: string}>} keyValues - Reconciliation key values
   * @returns {{payloadDocument: Document, distPath: string}} The payload and the file it was written to, e.g. <project>/dist/cus/myScript.js.xml
   */
  build(filePath, xpath, content, schema, keyValues) {
    // Add .xml suffix to log the SOAP payload in XML format
    const distPath = path.join(
      this.projectPath,
      AccInstancePush.DIST_DIRNAME,
      `${path.relative(this.projectPath, filePath)}.xml`,
    );
    // wrap in CDATA and schema root
    const payloadDocument = DomUtilAcc.buildXmlFromPath(
      xpath,
      content,
      schema.name,
    );
    // add update fields
    const payload = payloadDocument.documentElement;
    payload.setAttribute("xtkschema", schema.id);
    payload.setAttribute("_operation", "update");
    payload.setAttribute(
      "_key",
      keyValues.map(({ xpath: keyXpath }) => keyXpath).join(","),
    );
    for (const { attributeName, value } of keyValues) {
      payload.setAttribute(attributeName, value);
    }

    // save the payload before the SOAP call, for troubleshooting
    fs.outputFileSync(distPath, DomUtil.toXMLString(payloadDocument));
    this.logger.verbose(`Payload written to ${distPath}`);

    return { payloadDocument, distPath };
  }

  /**
   * Tells whether the xpath is an element that can hold child elements, rather
   * than a text value (memo, html, CDATA).
   *
   * @param {XtkSchema} schema - Schema of the entity, from the SDK
   * @param {string} xpath - xpath key of the decompose config
   * @returns {Promise<boolean>} true for an element-only node
   * @see https://opensource.adobe.com/acc-js-sdk/application.html
   */
  async _isElementOnly(schema, xpath) {
    const node = await schema.root.findNode(xpath);
    return !!node?.isElementOnly;
  }

  /**
   * Wraps xtk:session#Write, to mock it in tests and wrap SDK errors.
   *
   * @param {Element} element - The entity element to write
   * @returns {Promise<Element>} The result of the write
   * @throws {CampaignException}
   */
  async adapterWrite(element) {
    try {
      return await this.client.NLWS.xml.xtkSession.write(element);
    } catch (err) {
      // Reporting is left to the caller, which owns the spinner
      throw wrapSdkError(err, INSTANCE_PUSH_FAILED);
    }
  }
}

export default AccInstancePush;
