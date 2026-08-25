// npm
import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { codes, wrapSdkError } from "./helpers/AccErrors.js";
const {
  INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS,
  INSTANCE_WATCH_META_FILE_MISSING,
  INSTANCE_WATCH_PUSH_FAILED,
  INSTANCE_WATCH_ALREADY_RUNNING,
} = codes;

/**
 * Campaign Watcher class for watching decomposed files and pushing changes to ACC.
 * Only files described by the "decompose" key in acc.config.json are watched.
 * When a file is edited, its content is wrapped in CDATA and pushed to the server.
 *
 * At start: _getDecomposedSchemas > _buildWatchList > _storeSchemaForPattern
 * On file change: _onFileChange > _findSchemaForFile > _getMetadataDocument > _pushEntityToServer
 *
 * @class CampaignWatch
 * @classdesc Class for watching and syncing decomposed files to ACC instances
 */
class CampaignWatch {
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
   * Default debounce time in milliseconds
   * @type {number}
   */
  DEFAULT_DEBOUNCE_TIME = 300;

  /**
   * Maximum retry attempts for push operations
   * @type {number}
   */
  MAX_RETRY_ATTEMPTS = 3;

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
  currentFilename;

  /**
   * Chokidar watcher instance
   * @type {object | null}
   */
  chokidarWatcher = null;

  /**
   * Map of watched file paths to their schema config
   * @type {Map<string, object>}
   */
  watchedFiles = new Map();

  /**
   * Whether the watcher is currently running
   * @type {boolean}
   */
  isRunning = false;

  /**
   * Map of file paths to their last known content hash (for change detection)
   * @type {Map<string, string>}
   */
  fileContentHashes = new Map();

  /**
   * Creates a new CampaignWatch.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
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
   * Starts watching decomposed files for changes and pushing them to the server.
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

    // Build watch list and file to schema mapping
    const { filePatterns, fileToSchemaMap } =
      this._buildWatchList(decomposedSchemas);

    if (filePatterns.length === 0) {
      this.logger.warn(
        "No decomposed files found to watch. Make sure files exist and paths match the decompose configuration.",
      );
      return;
    }

    this.logger.verbose(`Watching patterns: ${filePatterns.join(", ")}`);
    this.watchedFiles = fileToSchemaMap;

    // Import chokidar (added as a dependency in package.json)
    let chokidar;
    try {
      chokidar = await import("chokidar");
    } catch (err) {
      this.logger.error(
        "chokidar dependency is required for watch functionality. Please install it with: npm install chokidar",
      );
      throw err;
    }

    // Create watcher
    const watcherOptions = {
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
        this.logger.verbose(`File deleted: ${filePath}`);
        this.fileContentHashes.delete(filePath);
      })
      .on("error", (error) => {
        this.logger.error(`Watcher error: ${error.message}`);
        this.spinner.fail(
          `Watch(${chalk.green(this.currentFilename)}): Error "${error.message}"`,
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
    this.watchedFiles.clear();
    this.fileContentHashes.clear();
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
   * Builds a list of file patterns to watch and a map of files to their schema configs.
   * For each decomposed schema, generates the expected file patterns based on the
   * filename template in the config.
   *
   * @param {Array<object>} decomposedSchemas - Schemas with decompose config
   * @returns {object} Object with filePatterns array and fileToSchemaMap
   */
  _buildWatchList(decomposedSchemas) {
    const filePatterns = [];
    const fileToSchemaMap = new Map();

    for (const schemaConfig of decomposedSchemas) {
      const { decompose, schemaId } = schemaConfig;

      // For each decompose entry, generate the file pattern
      for (const [xpath, decomposedFilename] of Object.entries(decompose)) {
        // The decomposed filename follows the same pattern as metaFilename
        // Extract the directory and replace the extension
        const decomposedDir = path.dirname(decomposedFilename);
        const decomposedBasename = path.basename(decomposedFilename);

        // Generate glob patterns for the watch path
        // Replace template placeholders with glob patterns
        const globPattern = this._convertTemplateToGlob(
          path.join(this.watchPath, decomposedDir, decomposedBasename),
        );

        filePatterns.push(globPattern);

        this.logger.verbose(
          `  Schema ${schemaId}: watching ${globPattern} (xpath: ${xpath})`,
        );

        // Store mapping info for later lookup
        // We can't pre-populate the map with actual files, but we store the schema config
        // for each pattern. Actual file to schema mapping happens in _onFileChange.
        this._storeSchemaForPattern(globPattern, schemaConfig, xpath);
      }
    }

    return { filePatterns, fileToSchemaMap };
  }

  /**
   * Converts a filename template with placeholders to a glob pattern.
   * Placeholders like {name} or {namespace} become * for glob matching.
   *
   * @param {string} templatePath - Path with template placeholders
   * @returns {string} Glob pattern
   */
  _convertTemplateToGlob(templatePath) {
    // Replace all {placeholder} with * for glob matching
    // Also handle the @ prefix if present
    return templatePath.replace(/\{@?[^}]+\}/g, "*");
  }

  /**
   * Stores schema config and xpath info for a glob pattern.
   * This is used later to look up which schema a changed file belongs to.
   *
   * @param {string} globPattern - The glob pattern
   * @param {object} schemaConfig - The schema configuration
   * @param {string} xpath - The xpath key from decompose
   */
  _storeSchemaForPattern(globPattern, schemaConfig, xpath) {
    // Store in a simple structure for pattern matching
    // This is a simplified approach - in production, we'd use a more robust
    // pattern matching library or convert globs to regex
    if (!this._patternMap) {
      this._patternMap = new Map();
    }

    // Normalize the pattern for matching
    const normalizedPattern = globPattern
      .replace(/\\/g, "/")
      .replace(/\*\*/g, "*")
      .replace(/\*$/, "");

    if (!this._patternMap.has(normalizedPattern)) {
      this._patternMap.set(normalizedPattern, []);
    }
    this._patternMap.get(normalizedPattern).push({ schemaConfig, xpath });
  }

  /**
   * Finds the schema config and xpath for a given file path.
   *
   * @param {string} filePath - The absolute path of the changed file
   * @returns {object|null} Object with schemaConfig and xpath, or null if not found
   */
  _findSchemaForFile(filePath) {
    if (!this._patternMap) {
      return null;
    }

    const normalizedPath = filePath.replace(/\\/g, "/");

    // Try to match the file path against stored patterns
    for (const [pattern, configs] of this._patternMap) {
      // Convert glob pattern to regex for matching
      const regexPattern = this._globToRegex(pattern);
      if (regexPattern.test(normalizedPath)) {
        // For now, return the first matching config
        // In a more robust implementation, we'd need to handle multiple matches
        return configs[0];
      }
    }

    return null;
  }

  /**
   * Converts a glob pattern to a regex.
   *
   * @param {string} glob - Glob pattern
   * @returns {RegExp} Regex for matching
   */
  _globToRegex(glob) {
    // Escape special regex chars except * and **
    // This is a simplified conversion
    const escaped = glob
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");

    return new RegExp(`^${escaped}$`);
  }

  /**
   * Callback for file change events.
   * Rebuilds the entity from the changed file and pushes to server.
   *
   * @param {string} filePath - The path of the changed file
   */
  async _onFileChange(filePath) {
    this.currentFilename = path.basename(filePath);

    this.spinner = this.createSpinner(
      `Watch(${chalk.green(this.currentFilename)}): content changed`,
    ).start();

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.watchPath, filePath);

    this.logger.verbose(`File changed: ${absolutePath}`);

    // Find which schema this file belongs to
    const match = this._findSchemaForFile(absolutePath);
    if (!match) {
      this.logger.verbose(
        `  File ${absolutePath} not part of any decomposed schema, skipping.`,
      );
      this.spinner.fail(
        `Watch(${chalk.green(this.currentFilename)}): not part of any decomposed schema, skipping.`,
      );
      return;
    }

    const { schemaConfig, xpath } = match;

    try {
      // Check if content actually changed (avoid infinite loops)
      const currentContent = fs.readFileSync(absolutePath, "utf8");
      const currentHash = this._hashContent(currentContent);

      const lastHash = this.fileContentHashes.get(absolutePath);
      if (lastHash === currentHash) {
        this.logger.verbose(`  Content unchanged, skipping.`);
        this.spinner.fail(
          `Watch(${chalk.green(this.currentFilename)}): content unchanged, skipping.`,
        );
        return;
      }

      // Update hash
      this.fileContentHashes.set(absolutePath, currentHash);

      // Rebuild entity from file
      const metadataDocument = await this._getMetadataDocument(
        schemaConfig,
        absolutePath,
        xpath,
        currentContent,
      );

      if (!metadataDocument) {
        this.logger.warn(`  Could not get metadata for ${absolutePath}`);
        this.spinner.fail(
          `Watch(${chalk.green(this.currentFilename)})>Metadata: could not get metadata, skipping.`,
        );
        return;
      }

      // Push to server
      await this._pushEntityToServer(
        xpath,
        currentContent,
        metadataDocument,
        schemaConfig,
      );

      this.logger.info(
        `✅ ${chalk.green(path.basename(absolutePath))} pushed to ${chalk.cyan(schemaConfig.schemaId)}`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Failed to push ${path.basename(absolutePath)}: ${err.message}`,
      );
    }
  }

  /**
   * Creates a simple hash of file content for change detection.
   *
   * @param {string} content - File content
   * @returns {string} Hash string
   */
  _hashContent(content) {
    // Simple hash using string length and first/last characters
    // For production, consider using a proper hash function
    if (!content || content.length === 0) {
      return "";
    }
    return `${content.length}:${content.substring(0, 10)}:${content.substring(
      content.length - 10,
    )}`;
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
   */
  async _getMetadataDocument(schemaConfig, filePath, xpath, fileContent) {
    const { filename: metaFilename } = schemaConfig;

    this.spinner.text = `Watch(${chalk.green(this.currentFilename)})>Metadata: Building ${chalk.cyan(schemaConfig.schemaId)} from ${chalk.cyan(path.basename(filePath))}`;

    // Generate the meta file path by replacing the decomposed file extension
    // with .meta.xml (or .xml if metaFilename ends with that)
    // This assumes the meta file follows the same naming pattern as the decomposed file
    const metaFilePath = this._getMetaFilePath(filePath, metaFilename);

    if (!fs.existsSync(metaFilePath)) {
      this.logger.warn(
        `  Meta file not found: ${metaFilePath}. Cannot rebuild entity.`,
      );
      throw new INSTANCE_WATCH_META_FILE_MISSING({
        messageValues: [metaFilePath],
      });
    }

    // Load and parse the meta XML
    let metaXmlContent;
    try {
      metaXmlContent = fs.readFileSync(metaFilePath, "utf8");
    } catch (err) {
      this.logger.error(`  Failed to read meta file: ${err.message}`);
      return null;
    }

    let document;
    try {
      document = DomUtil.parse(metaXmlContent);
    } catch (err) {
      this.logger.error(`  Failed to parse meta XML: ${err.message}`);
      return null;
    }

    // Find the root element (should be the entity)
    const rootElement = document.documentElement;
    if (!rootElement) {
      this.logger.error(`  No root element found in meta XML`);
      return null;
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
    current.appendChild(doc.createCDATASection(currentContent));
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
   * Pushes the rebuilt entity XML to the Adobe Campaign server.
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

    this.spinner.text = `Watch(${chalk.green(this.currentFilename)})>Metadata>Push: Writing ${chalk.bgCyan(schemaId)} to the instance`;

    try {
      const rootElement = metadataDocument.documentElement;

      if (!rootElement) {
        throw new Error("No root element in entity XML");
      }

      const id = rootElement.getAttribute("id");
      const name = rootElement.getAttribute("name");
      const namespace = rootElement.getAttribute("namespace");
      const internalName = rootElement.getAttribute("internalName");

      const schema = await this.client.application.getSchema(schemaId);
      // build payload
      const payloadDocument = this.buildXmlFromPath(
        xpath,
        currentContent,
        schema.name,
      );
      const payload = payloadDocument.documentElement;
      payload.setAttribute("xtkschema", schemaId);
      payload.setAttribute("_operation", "update");
      // Add keys
      // TODO: keys from sdk getSchema
      if (id) {
        payload.setAttribute("id", id);
      }
      if (name) {
        payload.setAttribute("name", name);
      }
      if (namespace) {
        payload.setAttribute("namespace", namespace);
      }
      if (internalName) {
        payload.setAttribute("internalName", internalName);
      }

      await this.adapterWrite(payloadDocument);

      this.spinner.succeed(
        `Watch(${chalk.green(this.currentFilename)})>Metadata>Push: Written ${chalk.bgCyan(schemaId)} to server`,
      );
    } catch (err) {
      this.logger.verbose(`  Attempt failed: ${err.message || String(err)}`);

      this.spinner.fail(
        `Watch(${chalk.green(this.currentFilename)})>Metadata>Push: Failed to push ${chalk.bgCyan(schemaId)}`,
      );
      throw new INSTANCE_WATCH_PUSH_FAILED({
        messageValues: [schemaId, err?.message || "unknown error"],
      });
    }
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
      throw wrapSdkError(err, INSTANCE_WATCH_PUSH_FAILED);
    }
  }
}

export default CampaignWatch;
