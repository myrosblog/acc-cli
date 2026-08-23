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
 * @class CampaignWatcher
 * @classdesc Class for watching and syncing decomposed files to ACC instances
 */
class CampaignWatcher {
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
   * Creates a new CampaignWatcher.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {CampaignConfig} accConfig - Configuration object defining schemas and download options
   * @param {object} cliOptions - Command-line options including path
   * @param {Function} createSpinner - Ora spinner instance for displaying progress
   * @example
   * const watcher = new CampaignWatcher(logger, client, accConfig, cliOptions, createSpinner);
   */
  constructor(logger, client, accConfig, cliOptions, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.accConfig = accConfig;
    this.watchPath = cliOptions.path || process.cwd();
    this.createSpinner = createSpinner;
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
      return;
    }

    const { schemaConfig, xpath } = match;

    try {
      // Check if content actually changed (avoid infinite loops)
      const currentContent = fs.readFileSync(absolutePath, "utf8");
      const currentHash = this._hashContent(currentContent);

      const lastHash = this.fileContentHashes.get(absolutePath);
      if (lastHash === currentHash) {
        this.logger.verbose(`  Content unchanged, skipping push.`);
        return;
      }

      // Update hash
      this.fileContentHashes.set(absolutePath, currentHash);

      // Rebuild entity from file
      const entityXml = await this._rebuildEntityFromFile(
        schemaConfig,
        absolutePath,
        xpath,
        currentContent,
      );

      if (!entityXml) {
        this.logger.warn(`  Could not rebuild entity for ${absolutePath}`);
        return;
      }

      // Push to server
      await this._pushEntityToServer(entityXml, schemaConfig);

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
   * @returns {Promise<string|null>} The complete entity XML as string, or null if failed
   */
  async _rebuildEntityFromFile(schemaConfig, filePath, xpath, fileContent) {
    const { filename: metaFilename, schemaId } = schemaConfig;

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

    // Find the target node by xpath
    // The xpath from decompose config is a simple element name (e.g., "code", "data")
    // We need to find this child node in the root
    const targetNode = this._findNodeBySimpleXPath(rootElement, xpath);

    if (!targetNode) {
      this.logger.warn(
        `  Target node for xpath '${xpath}' not found in ${schemaId} entity`,
      );
      // If the node doesn't exist, we might need to create it
      // For now, just return the original XML
      return DomUtil.toXMLString(document);
    }

    // Clear existing content and add CDATA with file content
    // First, remove all child nodes
    while (targetNode.firstChild) {
      targetNode.removeChild(targetNode.firstChild);
    }

    // Escape content for CDATA (handle ]]> sequences)
    const escapedContent = fileContent.replace(/\]\]>/g, "]]&gt;");

    // Create CDATA section
    const cdataSection = document.createCDATASection(escapedContent);
    targetNode.appendChild(cdataSection);

    // Return the complete XML
    return DomUtil.toXMLString(document);
  }

  /**
   * Finds a node in the XML tree using a simple xpath (element name only).
   * This handles simple xpaths like "code", "data", or "content/html/source".
   *
   * @param {Element} rootElement - Root element to search in
   * @param {string} xpath - Simple xpath string
   * @returns {Element|null} The found element, or null
   */
  _findNodeBySimpleXPath(rootElement, xpath) {
    // Handle simple element name (e.g., "code", "data")
    if (!xpath.includes("/")) {
      const child = rootElement.getElementsByTagName(xpath)[0];
      if (child) {
        return child;
      }
      // Try to find by direct child access
      for (const childNode of rootElement.childNodes) {
        if (childNode.nodeType === 1 && childNode.nodeName === xpath) {
          return childNode;
        }
      }
      return null;
    }

    // Handle nested xpaths (e.g., "content/html/source")
    const parts = xpath.split("/");
    let current = rootElement;

    for (const part of parts) {
      if (!part) {
        continue; // Skip empty parts from leading/trailing slashes
      }

      let found = null;
      // Try getElementsByTagName first
      const elements = current.getElementsByTagName(part);
      if (elements.length > 0) {
        found = elements[0];
      } else {
        // Try direct child access
        for (const childNode of current.childNodes) {
          if (childNode.nodeType === 1 && childNode.nodeName === part) {
            found = childNode;
            break;
          }
        }
      }

      if (!found) {
        return null;
      }
      current = found;
    }

    return current;
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
   * @param {string} entityXml - The complete entity XML
   * @param {object} schemaConfig - Schema configuration
   * @returns {Promise<void>} Resolves when push is complete
   * @throws {INSTANCE_WATCH_PUSH_FAILED} If push fails after retries
   */
  async _pushEntityToServer(entityXml, schemaConfig) {
    const { schemaId } = schemaConfig;
    const spinner = this.createSpinner(
      `Pushing ${chalk.bgCyan(schemaId)} to server`,
    ).start();

    let attempt = 0;
    let lastError = null;

    while (attempt < this.MAX_RETRY_ATTEMPTS) {
      attempt++;

      try {
        // Parse the XML to get a DOM Document
        const document = DomUtil.parse(entityXml);
        const rootElement = document.documentElement;

        if (!rootElement) {
          throw new Error("No root element in entity XML");
        }

        // The SDK expects an Element, not a Document
        // We need to create an entity object that the SDK can work with
        // For xtk:session#Write, we need to pass an object with xtkschema

        // Get the entity's primary key (id or name)
        const id = rootElement.getAttribute("id");
        const name = rootElement.getAttribute("name");

        // Build the update payload
        // The payload should have:
        // - xtkschema: the schema ID
        // - _operation: "update"
        // - the primary key (id or name)
        // - the modified data

        // For simplicity, we'll serialize the entire XML and pass it
        // The SDK's Write method accepts XML strings
        const payload = {
          xtkschema: schemaId,
          _operation: "update",
        };

        // Add primary key
        if (id) {
          payload.id = id;
        } else if (name) {
          payload.name = name;
        } else {
          // Try to find other keys
          const internalName = rootElement.getAttribute("internalName");
          if (internalName) {
            payload.internalName = internalName;
          }
        }

        // For XML content, we need to use the XML representation
        // The SDK's xtkSession.write can accept an Element or an object
        // We'll try passing the rootElement directly

        // Try to use the SDK's write method
        // First, get the appropriate proxy
        const nlws = this.client.NLWS.xml;

        // Build a simple JSON representation for logging
        this.logger.verbose(
          `  Pushing ${schemaId} with id=${id || name || "unknown"}`,
        );

        // Use xtk:session#Write
        // The Write method accepts a DOM Element or a SimpleJson object
        // We'll pass the rootElement which is already a DOM Element

        // Set _operation attribute on the element
        rootElement.setAttribute("_operation", "update");

        // Call Write
        await nlws.xtkSession.write(rootElement);

        spinner.succeed(`Pushed ${chalk.bgCyan(schemaId)} to server`);
        return;
      } catch (err) {
        lastError = err;
        this.logger.verbose(
          `  Push attempt ${attempt} failed: ${err.message || String(err)}`,
        );

        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          // Wait a bit before retrying
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    spinner.fail(`Failed to push ${chalk.bgCyan(schemaId)}`);
    throw new INSTANCE_WATCH_PUSH_FAILED({
      messageValues: [schemaId, lastError?.message || "unknown error"],
    });
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

  /**
   * Maps a schema id to the camelCase namespace key the NLWS proxy expects,
   * e.g. "nms:delivery" -> "nmsDelivery", "xtk:queryDef" -> "xtkQueryDef".
   * Inverse of the SDK's Util.schemaIdFromNamespace.
   *
   * @param {string} schema - schema id ("namespace:entity")
   * @returns {string} the proxy key
   */
  _toSchemaKey(schema) {
    const [ns, entity] = schema.split(":");
    if (!entity) {
      return schema; // already a key (or malformed): pass through
    }
    return ns + entity.charAt(0).toUpperCase() + entity.slice(1);
  }
}

export default CampaignWatcher;
