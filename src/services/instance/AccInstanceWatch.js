// npm
import path from "node:path";
import AccInstancePush from "./AccInstancePush.js";
import {
  buildWatchTargets,
  getDecomposedSchemas,
} from "../../helpers/watchTargets.js";
import { codes } from "../../helpers/AccErrors.js";
const { INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS, INSTANCE_WATCH_ALREADY_RUNNING } =
  codes;

/**
 * Watches the files described by the `decompose` key of acc.config.json and
 * hands each edit to AccInstancePush.
 *
 * At start: getDecomposedSchemas, then _buildWatchList.
 * On a file change: AccInstancePush.push.
 *
 * @class AccInstanceWatch
 */
class AccInstanceWatch {
  /**
   * Default debounce, in milliseconds
   * @type {number}
   */
  DEFAULT_DEBOUNCE_TIME = 300;

  /** @type {AioLogger} */
  logger;

  /** @type {AccConfig} */
  accConfig;

  /** @type {string} */
  watchPath;

  /** @type {AccInstancePush} pushes each changed file */
  accInstancePush;

  /**
   * Created by startWatching, closed by stopWatching
   * @type {object | null}
   */
  chokidarWatcher = null;

  /**
   * One target per `decompose` entry. Patterns are relative to `watchPath` and
   * use "/" separators.
   * @type {Array<{pattern: string, schemaConfig: object, xpath: string}>}
   */
  watchTargets = [];

  /**
   * Whether the watcher is running
   * @type {boolean}
   */
  isRunning = false;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {AccConfig} accConfig - Schemas and their `decompose` config (acc.config.json)
   * @param {object} cliOptions - Command-line options: `path` (watched folder)
   * @param {AccInstancePush} accInstancePush - Pushes each changed file
   */
  constructor(logger, accConfig, cliOptions, accInstancePush) {
    this.logger = logger;
    this.accConfig = accConfig;
    this.watchPath = cliOptions.path || process.cwd();
    this.accInstancePush = accInstancePush;
    // Early access notice, to remove once stable
    this.logger.warn(
      "`acc instance watch` is in early access and subject to change. Always test in sandbox first.",
    );
  }

  /**
   * Watches the decomposed files and pushes their changes to the instance.
   *
   * @param {number} [debounceTime] - Wait after the last write, in milliseconds
   * @throws {INSTANCE_WATCH_ALREADY_RUNNING} If already running
   * @throws {INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS} If no schema has a `decompose` config
   */
  async startWatching(debounceTime = this.DEFAULT_DEBOUNCE_TIME) {
    if (this.isRunning) {
      throw new INSTANCE_WATCH_ALREADY_RUNNING();
    }

    this.logger.info(
      `👀 Started the watch process in ${this.watchPath} ` +
        `(debounce: ${debounceTime}ms, XML saved to ${AccInstancePush.DIST_DIRNAME}/)`,
    );

    const decomposedSchemas = getDecomposedSchemas(this.accConfig.schemas);
    if (decomposedSchemas.length === 0) {
      throw new INSTANCE_WATCH_NO_DECOMPOSED_SCHEMAS();
    }

    this.logger.verbose(
      `Found ${decomposedSchemas.length} schemas with decompose configuration`,
    );

    this.watchTargets = this._buildWatchList(decomposedSchemas);
    const filePatterns = this.watchTargets.map((target) => target.pattern);

    if (filePatterns.length === 0) {
      this.logger.warn(
        "No decomposed files found to watch. Make sure files exist and paths match the decompose configuration.",
      );
      return;
    }

    this.logger.verbose(`Watching patterns: ${filePatterns.join(", ")}`);

    let chokidar;
    try {
      chokidar = await this._importChokidar();
    } catch (err) {
      this.logger.error(
        "chokidar dependency is required for watch functionality. Please install it with: npm install chokidar",
      );
      throw err;
    }

    // `cwd` keeps the patterns and the emitted paths relative, so glob
    // characters in the absolute prefix (e.g. /Users/me/my[work]/) are never
    // read as part of a pattern.
    const watcherOptions = {
      cwd: this.watchPath,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: debounceTime,
        pollInterval: 100,
      },
      ignored: [
        // ignore "acc. instance push|watch" build folder
        `**/${AccInstancePush.DIST_DIRNAME}/**`,
        // ignore common system files and folders
        "**/.DS_Store",
        "**/node_modules/**",
        "**/.git/**",
      ],
    };

    this.chokidarWatcher = chokidar.default.watch(filePatterns, watcherOptions);

    this.chokidarWatcher
      .on("add", (filePath) => this.accInstancePush.push(filePath))
      .on("change", (filePath) => this.accInstancePush.push(filePath))
      .on("unlink", (filePath) => {
        this.logger.verbose(`${path.basename(filePath)}: File deleted`);
      })
      .on("error", (error) => {
        this.logger.error(`Watcher error: ${error.message}`);
      });

    this.isRunning = true;
    this.logger.info(
      `📋 Found ${filePatterns.length} schema(s) to watch from ${this.accConfig.configPath}` +
        ` (key: decompose). Press Ctrl+C to stop.`,
    );
  }

  /**
   * Stops watching the files.
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
   * Builds one watch target per entry of the decomposed schemas, and logs them.
   *
   * @param {Array<object>} decomposedSchemas - Schemas with a decompose config
   * @returns {Array<{pattern: string, schemaConfig: object, xpath: string}>} The watch targets
   */
  _buildWatchList(decomposedSchemas) {
    const watchTargets = buildWatchTargets(decomposedSchemas);

    for (const { pattern, schemaConfig, xpath } of watchTargets) {
      this.logger.verbose(
        `  Schema ${schemaConfig.schemaId}: watching ${pattern} (xpath: ${xpath})`,
      );
    }

    return watchTargets;
  }

  /**
   * Imports chokidar lazily, in its own method so tests can stub it.
   *
   * @returns {Promise<object>} The chokidar module
   */
  async _importChokidar() {
    return import("chokidar");
  }
}

export default AccInstanceWatch;
