// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import { minimatch } from "minimatch";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { XPath } from "@adobe/acc-js-sdk/src/domUtil.js";
import DomUtilAcc from "./helpers/DomUtilAcc.js";
import { codes, wrapSdkError } from "./helpers/AccErrors.js";
const {
  INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS,
  INSTANCE_WATCH_FILE_NOT_IN_SCOPE,
  INSTANCE_WATCH_META_FILE_MISSING,
  INSTANCE_WATCH_SCHEMA_NOT_FOUND,
  INSTANCE_WATCH_NO_WRITE_KEY,
  INSTANCE_WATCH_PUSH_FAILED,
  INSTANCE_WATCH_ALREADY_RUNNING,
} = codes;

/**
 * Campaign Watcher class for watching decomposed files and pushing changes to AC.
 * Only files described by the "decompose" key in acc.config.json are watched.
 * When a file is edited, its content is wrapped in CDATA and pushed to the server.
 *
 * At start: _getDecomposedSchemas > _buildWatchList
 * On file change (_onFileChange), 3 stages:  > _findSchemaForFile > _getMetadataDocument > _pushEntityToServer
 *
 * @class CampaignWatch
 */
class CampaignWatch {
  /**
   * Default debounce time in milliseconds
   * @type {number}
   */
  DEFAULT_DEBOUNCE_TIME = 300;

  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @type {Client}
   */
  client;

  /**
   * @type {CampaignConfig}
   */
  accConfig;

  /**
   * @type {string}
   */
  watchPath;

  /**
   * @type {Function} to create spinner, injected for easier unit testing
   */
  createSpinner;

  /**
   * @type {object} spinner instance for displaying progress
   */
  spinner;

  /**
   * @type {string}
   */
  spinnerFilename;

  /**
   * @type {string}
   */
  spinnerMetadata;

  /**
   * Formatted reconciliation keys of the entity being pushed, or undefined until resolved
   * @type {string | undefined}
   */
  spinnerKeys;

  /**
   * Chokidar watcher instance
   * @type {object | null}
   */
  chokidarWatcher = null;

  /**
   * Watch targets derived from the `decompose` config, one entry per glob pattern.
   * Patterns are relative to `watchPath` and use "/" separators.
   * @type {Array<{pattern: string, schemaConfig: object, xpath: string}>}
   */
  watchTargets = [];

  /**
   * Whether the watcher is currently running
   * @type {boolean}
   */
  isRunning = false;

  /**
   * Creates a new CampaignWatch.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated SDK client
   * @param {CampaignConfig} accConfig - Configuration object defining schemas and download options
   * @param {object} cliOptions - Command-line options including path
   * @param {Function} createSpinner - Ora spinner instance for displaying progress
   * @example
   * const watcher = new CampaignWatch(logger, client, accConfig, cliOptions, createSpinner);
   */
  constructor(logger, client, accConfig, cliOptions, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.accConfig = accConfig;
    this.watchPath = cliOptions.path || process.cwd();
    this.createSpinner = createSpinner;
    // TODO: remove when stable
    this.logger.warn(
      "`acc instance watch` is in early access and subject to change. Always test in sandbox first.",
    );
  }

  /**
   * Starts watching decomposed files for changes and pushing them to the instance.
   *
   * @param {number} [debounceTime] - Debounce time in milliseconds (default: 300)
   * @returns {Promise<void>} Resolves when watching has started
   * @throws {INSTANCE_WATCH_ALREADY_RUNNING} If watcher is already running
   * @throws {INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS} If no schemas with decompose config found
   */
  async startWatching(debounceTime = this.DEFAULT_DEBOUNCE_TIME) {
    if (this.isRunning) {
      throw new INSTANCE_WATCH_ALREADY_RUNNING();
    }

    this.logger.info(
      `👀 Starting to watch decomposed files in ${this.watchPath} (debounce: ${debounceTime}ms)`,
    );

    // Get schemas with decompose configuration
    const decomposedSchemas = this._getDecomposedSchemas();
    if (decomposedSchemas.length === 0) {
      throw new INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS();
    }

    this.logger.verbose(
      `Found ${decomposedSchemas.length} schemas with decompose configuration`,
    );

    // Build the watch targets, one per decompose entry
    this.watchTargets = this._buildWatchList(decomposedSchemas);
    const filePatterns = this.watchTargets.map((target) => target.pattern);

    if (filePatterns.length === 0) {
      this.logger.warn(
        "No decomposed files found to watch. Make sure files exist and paths match the decompose configuration.",
      );
      return;
    }

    this.logger.verbose(`Watching patterns: ${filePatterns.join(", ")}`);

    // Import chokidar (added as a dependency in package.json)
    let chokidar;
    try {
      chokidar = await this._importChokidar();
    } catch (err) {
      this.logger.error(
        "chokidar dependency is required for watch functionality. Please install it with: npm install chokidar",
      );
      throw err;
    }

    // Create watcher. `cwd` keeps both the patterns and the emitted paths relative
    // to the watch path, so an absolute prefix containing glob metacharacters
    // (e.g. /Users/me/my[work]/) can never be read as part of a pattern.
    const watcherOptions = {
      cwd: this.watchPath,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: debounceTime,
        pollInterval: 100,
      },
      ignored: [
        "**/.DS_Store",
        "**/node_modules/**",
        "**/.git/**",
        "**/.dist/**",
      ],
    };

    this.chokidarWatcher = chokidar.default.watch(filePatterns, watcherOptions);

    // Set up event handlers
    this.chokidarWatcher
      .on("add", (filePath) => this._onFileChange(filePath))
      .on("change", (filePath) => this._onFileChange(filePath))
      .on("unlink", (filePath) => {
        this.spinnerFilename = path.basename(filePath);
        this.logger.verbose(this._getSpinnerPrefix(0) + `File deleted`);
      })
      .on("error", (error) => {
        this.logger.error(`Watcher error: ${error.message}`);
        // A watcher error can fire before any file change, i.e. before a spinner exists
        this.spinner?.fail(
          this._getSpinnerPrefix(0) + `Error "${error.message}"`,
        );
      });

    this.isRunning = true;
    this.logger.info(
      `✅ Watching ${filePatterns.length} file pattern(s) for changes. Press Ctrl+C to stop.`,
    );
  }

  /**
   * Stops watching files.
   *
   * @returns {Promise<void>} Resolves when watching has stopped
   */
  async stopWatching() {
    if (!this.isRunning || !this.chokidarWatcher) {
      return;
    }

    this.logger.info("🛑 Stopping file watcher...");
    await this.chokidarWatcher.close();
    this.chokidarWatcher = null;
    this.isRunning = false;
    this.watchTargets = [];
    this.logger.info("✅ File watcher stopped.");
  }

  /**
   * Filters schemas to only those with a decompose configuration.
   *
   * @returns {Array<object>} Array of schema configs with decompose
   */
  _getDecomposedSchemas() {
    return this.accConfig.schemas.filter(
      (schemaConfig) =>
        schemaConfig.decompose &&
        typeof schemaConfig.decompose === "object" &&
        Object.keys(schemaConfig.decompose).length > 0,
    );
  }

  /**
   * Builds the watch targets, one per entry of every decomposed schema.
   * Each target pairs the glob pattern of a decomposed file with the schema and
   * xpath that produced it, so a changed file can be traced back to its origin.
   *
   * @param {Array<object>} decomposedSchemas - Schemas with decompose config
   * @returns {Array<{pattern: string, schemaConfig: object, xpath: string}>} the watch targets
   */
  _buildWatchList(decomposedSchemas) {
    const watchTargets = [];

    for (const schemaConfig of decomposedSchemas) {
      const { decompose, schemaId } = schemaConfig;

      for (const [xpath, decomposedFilename] of Object.entries(decompose)) {
        const pattern = this._convertTemplateToGlob(decomposedFilename);

        watchTargets.push({ pattern, schemaConfig, xpath });

        this.logger.verbose(
          `  Schema ${schemaId}: watching ${pattern} (xpath: ${xpath})`,
        );
      }
    }

    return watchTargets;
  }

  /**
   * Converts a filename template from acc.config.json into a glob pattern
   * relative to the watch path.
   *
   * Each placeholder becomes a single "*": CampaignInstance sanitizes attribute
   * values before substituting them, so a placeholder can never expand to more
   * than one path segment.
   *
   * @param {string} template - Filename template with attribute placeholders
   * @returns {string} Glob pattern relative to the watch path
   * @see CampaignInstance._sanitizeFilenameValue
   */
  _convertTemplateToGlob(template) {
    // Templates are rooted at the download directory, not at the filesystem root
    const relativeTemplate = template.replace(/^\/+/, "");
    return relativeTemplate.replace(/\{@?[^}]+\}/g, "*");
  }

  /**
   * Finds the schema config and xpath a changed file belongs to.
   *
   * @param {string} filePath - Path of the changed file, relative to the watch path
   * @returns {{pattern: string, schemaConfig: object, xpath: string}|null} the matching target, or null
   */
  _findSchemaForFile(filePath) {
    const posixPath = filePath.split(path.sep).join("/");
    const matches = this.watchTargets.filter((target) =>
      minimatch(posixPath, target.pattern),
    );

    if (matches.length === 0) {
      return null;
    }
    if (matches.length > 1) {
      // Two decompose entries claiming the same file is a configuration problem,
      // so report it rather than silently picking one.
      this.logger.warn(
        `${posixPath} matches ${matches.length} decompose patterns, using ${matches[0].schemaConfig.schemaId}`,
      );
    }
    return matches[0];
  }

  /**
   * Imports chokidar lazily, isolated in its own method so unit tests can stub it.
   *
   * @returns {Promise<object>} the chokidar module namespace
   */
  async _importChokidar() {
    return import("chokidar");
  }

  /**
   * Callback for file change events.
   * Rebuilds the entity from the changed file and pushes to instance.
   *
   * @param {string} filePath - The path of the changed file, relative to the watch path
   */
  async _onFileChange(filePath) {
    this.spinnerFilename = path.basename(filePath);
    this.spinnerKeys = undefined; // resolved later, from the schema of this file

    this.spinner = this.createSpinner(
      this._getSpinnerPrefix(0) + `content changed`,
    ).start();

    let match, absolutePath;

    try {
      // path.resolve leaves an already absolute path untouched
      absolutePath = path.resolve(this.watchPath, filePath);

      this.logger.verbose(`File changed: ${absolutePath}`);

      // Find which schema this file belongs to
      match = this._findSchemaForFile(filePath);
      if (!match) {
        throw new INSTANCE_WATCH_FILE_NOT_IN_SCOPE();
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

      // Rebuild entity from file
      metadataDocument = await this._getMetadataDocument(
        schemaConfig,
        absolutePath,
        xpath,
        currentContent,
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
      await this._pushEntityToServer(
        xpath,
        currentContent,
        metadataDocument,
        schemaConfig,
      );

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
   * @param {number} stage 0/1/2
   * @returns {string} the prefix
   */
  _getSpinnerPrefix(stage) {
    let prefix = `Watch(${chalk.green(this.spinnerFilename)})`;
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
   * Rebuilds the complete entity XML from a decomposed file.
   * Loads the meta XML file, finds the target node by XPath, and inserts
   * the file content as CDATA.
   *
   * @param {object} schemaConfig - Schema configuration
   * @param {string} filePath - Path to the changed decomposed file
   * @param {string} xpath - The xpath key from decompose config
   * @param {string} fileContent - Content of the changed file
   * @returns {Promise<Document|null>} The complete entity XML as string, or null if failed
   * @throws {Error}
   */
  async _getMetadataDocument(schemaConfig, filePath, xpath, fileContent) {
    const { filename: metaFilename } = schemaConfig;

    this.spinnerMetadata = xpath;

    this.spinner.text =
      this._getSpinnerPrefix(1) +
      `Building ${chalk.cyan(schemaConfig.schemaId)} from ${chalk.cyan(path.basename(filePath))}`;

    // Generate the meta file path by replacing the decomposed file extension
    // with .meta.xml (or .xml if metaFilename ends with that)
    // This assumes the meta file follows the same naming pattern as the decomposed file
    const metaFilePath = this._getMetaFilePath(filePath, metaFilename);

    if (!fs.existsSync(metaFilePath)) {
      throw new INSTANCE_WATCH_META_FILE_MISSING({
        messageValues: [metaFilePath],
      });
    }

    // Load and parse the meta XML
    const metaXmlContent = fs.readFileSync(metaFilePath, "utf8"); // @throws
    const document = DomUtil.parse(metaXmlContent); // @throws

    // Find the root element (should be the entity)
    const rootElement = document.documentElement;
    if (!rootElement) {
      throw new Error(`No root element found in meta XML`);
    }

    return document;
  }

  /**
   * Builds an XML document the content as CDATA
   *
   * @param {string} xpath the xpath from acc.config.json
   * @param {string} currentContent the content of the watched file
   * @param {string} schemaName the schema name to use as the XML root tag
   * @returns {Document} the XML built
   * @see XPath.getElements()
   */
  buildXmlFromPath(xpath, currentContent, schemaName) {
    const parts = xpath.split("/");
    const doc = DomUtil.newDocument(schemaName); // docRoot must be the schemaName
    let current = doc.documentElement;
    const firstIndex = 0;
    for (let i = firstIndex; i < parts.length; i++) {
      const el = doc.createElement(parts[i]);
      current.appendChild(el);
      current = el;
    }
    // A CDATA section cannot carry its own terminator, and the DOM throws on it.
    // Escaping keeps the payload valid for files that legitimately contain "]]>".
    const safeContent = currentContent.replaceAll("]]>", "]]&gt;");
    current.appendChild(doc.createCDATASection(safeContent));
    return doc;
  }

  /**
   * Generates the meta file path from a decomposed file path.
   * Replaces the file extension with .meta.xml or adjusts based on the
   * schema's filename template.
   *
   * @param {string} decomposedFilePath - Path to the decomposed file
   * @param {string} metaFilename - Meta filename template from config
   * @returns {string} Path to the meta file
   */
  _getMetaFilePath(decomposedFilePath, metaFilename) {
    const dir = path.dirname(decomposedFilePath);

    // Extract the base name without extension
    const baseName = path.basename(
      decomposedFilePath,
      path.extname(decomposedFilePath),
    );

    // If the meta filename ends with .meta.xml, replace the decomposed file's extension
    // This is a simplified approach - assumes the decomposed file name matches
    // the pattern without the extension
    return path.join(dir, baseName + ".meta.xml");
  }

  /**
   * Pushes the rebuilt entity XML to the instance.
   * Uses xtk:session#Write with _operation: "update".
   *
   * @param {string} xpath - The xpath key from decompose config
   * @param {string} currentContent - The current content of the changed file
   * @param {Document} metadataDocument - The complete metadata document
   * @param {object} schemaConfig - Schema configuration
   * @returns {Promise<void>} Resolves when push is complete
   * @throws {INSTANCE_WATCH_PUSH_FAILED} If push fails after retries
   */
  async _pushEntityToServer(
    xpath,
    currentContent,
    metadataDocument,
    schemaConfig,
  ) {
    const { schemaId } = schemaConfig;

    try {
      const rootElement = metadataDocument.documentElement;

      if (!rootElement) {
        throw new Error("No root element in entity XML");
      }

      const schema = await this.client.application.getSchema(schemaId);
      if (!schema) {
        throw new INSTANCE_WATCH_SCHEMA_NOT_FOUND({
          messageValues: [schemaId],
        });
      }

      // The reconciliation key comes from the schema, not from a guess
      const { key, keyValues } = this._getWriteKey(schema, rootElement);
      this.spinnerKeys = this._formatKeyValues(keyValues);

      this.logger.verbose(
        `Reconciling ${schemaId} on ${key.isInternal ? "internal" : "external"} key "${key.name}"`,
      );

      this.spinner.text = this._getSpinnerPrefix(2) + `Writing to the instance`;

      // build payload
      const payloadDocument = this.buildXmlFromPath(
        xpath,
        currentContent,
        schema.name,
      );
      const payload = payloadDocument.documentElement;
      payload.setAttribute("xtkschema", schemaId);
      payload.setAttribute("_operation", "update");
      // Declare the key so the server reconciles on it rather than on whichever
      // attribute it finds first
      payload.setAttribute(
        "_key",
        keyValues.map(({ xpath: keyXpath }) => keyXpath).join(","),
      );
      for (const { attributeName, value } of keyValues) {
        payload.setAttribute(attributeName, value);
      }

      await this.adapterWrite(payloadDocument);
    } catch (err) {
      this.logger.verbose(`  Push failed: ${err.message || String(err)}`);

      // adapterWrite already reports SDK failures as AccErrors: re-wrapping one
      // would nest the message inside itself
      if (err?.sdk === "acc") {
        throw err;
      }
      throw wrapSdkError(err, INSTANCE_WATCH_PUSH_FAILED, { schemaId });
    }
  }

  /**
   * Picks the key to reconcile the entity on, and reads its values from the meta
   * document. Keys are tried internal first, as the SDK does, falling through to
   * the next one when the meta file has no value for every field of a key.
   *
   * @param {XtkSchema} schema - The schema of the entity, from the SDK
   * @param {Element} rootElement - Root element of the meta document
   * @returns {{key: XtkSchemaKey, keyValues: Array<{xpath: string, attributeName: string, value: string}>}} the key and its values
   * @throws {INSTANCE_WATCH_NO_WRITE_KEY} If no key of the schema is fully valued
   * @see https://opensource.adobe.com/acc-js-sdk/application.html
   */
  _getWriteKey(schema, rootElement) {
    const candidateKeys = [
      schema.root.firstInternalKeyDef(),
      schema.root.firstExternalKeyDef(),
    ].filter(Boolean);

    for (const key of candidateKeys) {
      const keyValues = this._getKeyValues(key, rootElement);
      if (keyValues) {
        return { key, keyValues };
      }
    }

    throw new INSTANCE_WATCH_NO_WRITE_KEY({
      messageValues: [
        schema.id,
        candidateKeys.map((key) => key.name).join(", ") || "none defined",
      ],
    });
  }

  /**
   * Reads the values of every field of a key from the meta document.
   *
   * @param {XtkSchemaKey} key - The key definition, from the SDK schema
   * @param {Element} rootElement - Root element of the meta document
   * @returns {Array<{xpath: string, attributeName: string, value: string}>|null} the values, or null if the key cannot be used
   */
  _getKeyValues(key, rootElement) {
    const keyValues = [];

    for (const field of key.fields) {
      // nodePath is absolute ("/@name"), the keyfield xpath is relative to the root
      const keyXpath = field.nodePath.replace(/^\//, "");
      const xpathElements = new XPath(keyXpath).getElements();
      const lastXpathElement = xpathElements[xpathElements.length - 1];

      // A key on an element rather than an attribute cannot be written as an
      // attribute of the payload, so the whole key is unusable
      if (
        !lastXpathElement ||
        !DomUtilAcc.xpathElementIsAttribute(lastXpathElement)
      ) {
        return null;
      }

      const lastNode = DomUtilAcc.findLastElement(rootElement, keyXpath);
      if (!lastNode) {
        return null;
      }

      const attributeName = DomUtilAcc.getXpathAttributeName(lastXpathElement);
      const value = lastNode.getAttribute(attributeName);
      if (!value) {
        return null;
      }

      keyValues.push({ xpath: keyXpath, attributeName, value });
    }

    return keyValues.length > 0 ? keyValues : null;
  }

  /**
   * Formats key values for display. The SDK has no equivalent: its toString()
   * dumps the schema tree and ignores keys.
   *
   * @param {Array<{attributeName: string, value: string}>} keyValues - The key values
   * @returns {string} "DM123" for a single field, "cus:New" for name + namespace, "a, b" otherwise
   */
  _formatKeyValues(keyValues) {
    const values = keyValues.map(({ value }) => value);

    if (keyValues.length === 1) {
      return values[0];
    }

    // "namespace:name" is how Adobe Campaign names these entities everywhere else
    if (keyValues.length === 2) {
      const byName = Object.fromEntries(
        keyValues.map(({ attributeName, value }) => [attributeName, value]),
      );
      if (byName.name && byName.namespace) {
        return `${byName.namespace}:${byName.name}`;
      }
    }

    return values.join(", ");
  }

  /**
   * Adapter of xtk:session#Write for:
   * - easier mocking in unit tests
   * - SDK error wrapping
   * @param {Element} element - The entity element to write
   * @returns {Promise<Element>} the result
   * @throws {CampaignException}
   */
  async adapterWrite(element) {
    try {
      return await this.client.NLWS.xml.xtkSession.write(element);
    } catch (err) {
      // Reporting is left to the caller, which owns the spinner
      throw wrapSdkError(err, INSTANCE_WATCH_PUSH_FAILED);
    }
  }
}

export default CampaignWatch;
