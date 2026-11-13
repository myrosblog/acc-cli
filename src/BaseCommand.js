// npm
import { Command, loadHelpClass } from "@oclif/core";
import path from "node:path";
import ora from "ora";
// sdk
import sdk from "@adobe/acc-js-sdk";
import Config from "@adobe/aio-lib-core-config/src/Config.js";
// acc
import makeLogger from "./helpers/makeLogger.js";
import AccCache from "./helpers/AccCache.js";
import AccAuth from "./services/auth/AccAuth.js";
import AccConfig, { CONFIG_FILENAME } from "./services/config/AccConfig.js";
import AccMonitor from "./services/monitor/AccMonitor.js";
import AccTelemetry, {
  TELEMETRY_NOTICE,
} from "./services/telemetry/AccTelemetry.js";
import logCacheStats from "./helpers/cacheStatsLogger.js";

/**
 * Base oclif command for acc.
 *
 * Provides lazily-constructed shared services (logger, auth, spinner) and a
 * config factory, so that *importing* a command (e.g. for help generation or
 * in unit tests) has no side effects, services are only built on first use,
 * inside run().
 *
 * Lives in src/ (NOT src/commands/): every file under src/commands
 * is registered by oclif as a runnable command.
 *
 * @class BaseCommand
 */
export default class BaseCommand extends Command {
  /**
   * Start of the command, for the telemetry duration.
   * @type {number}
   */
  startedAt = Date.now();

  /**
   * Long names of the flags typed by the user, for the telemetry, i.e. ["alias", "json"].
   * @type {string[]}
   */
  typedFlags = [];

  /** @type {AioLogger} */
  get logger() {
    if (!this._logger) {
      this._logger = makeLogger(this.config?.cacheDir);
      this._logger.info(`📰 Writing logs to ${this.config?.cacheDir}`);
    }
    return this._logger;
  }

  /** @type {AccAuth} */
  get auth() {
    return (this._auth ??= new AccAuth(
      this.logger,
      sdk,
      new Config(),
      undefined,
      // Persist the SDK cache under the per-user oclif cache dir (alongside
      // acc.log), not in the current working directory. Each instance alias
      // gets its own sub-directory, mirroring the Campaign Client Console.
      (alias) =>
        new AccCache(
          path.join(
            this.config.cacheDir,
            "sdk-cache",
            encodeURIComponent(alias),
          ),
        ),
      undefined,
      // Marks each login stage, as InstanceCommand does for the AccInstance* services.
      (text) => this.spinner(text),
    ));
  }

  /** @type {AccMonitor} */
  get monitor() {
    return (this._monitor ??= new AccMonitor(this.logger, sdk, this.auth));
  }

  /** @type {AccTelemetry} */
  get telemetry() {
    return (this._telemetry ??= new AccTelemetry());
  }

  /**
   * Builds a fresh config rooted at ./acc.config.json.
   * @returns {AccConfig} new instance of AccConfig
   */
  makeConfig() {
    return new AccConfig(
      this.logger,
      path.join(process.cwd(), CONFIG_FILENAME),
    );
  }

  /**
   * Ora spinner factory (kept as a method for easy injection in tests).
   * @param {string} text Message shown next to the spinner
   * @returns {ora.Ora} a new spinner instance
   */
  spinner(text) {
    return ora(text);
  }

  /**
   * Prints the help of a topic (same output as `acc <topic> -h`).
   * @param {string} topic the topic whose subcommands are listed, i.e. "auth"
   * @returns {Promise<void>}
   */
  async showTopicHelp(topic) {
    const HelpClass = await loadHelpClass(this.config);
    await new HelpClass(this.config).showHelp([topic]);
  }

  /**
   * Keeps the typed flag names, as oclif does not store the parse output.
   * Its raw tokens hold the flags typed, without the defaults and with -a as alias.
   * @param {object} [options] the command class, i.e. AuthList
   * @param {string[]} [argv] the arguments, this.argv by default
   * @returns {Promise<object>} the oclif parse output
   */
  async parse(options, argv) {
    const parsed = await super.parse(options, argv);
    this.typedFlags = parsed.raw
      .filter((token) => token.type === "flag")
      .map((token) => token.flag);
    return parsed;
  }

  /**
   * Runs after every command invocation, success or failure. Logs a final
   * snapshot of the SDK's internal cache stats so the numbers reflect the
   * command's actual work (schema/method/option lookups), not just the
   * near-zero state right after login.
   * @param {Error} [err] the error the command failed with, if any
   * @returns {Promise<void>}
   */
  async finally(err) {
    if (this._auth?.client) {
      logCacheStats(this.logger, this._auth.client);
    }
    this.trackUsage();
    return super.finally(err);
  }

  /**
   * Sends the command call to telemetry.
   * Uses finally() because oclif runs no "postrun" hook when a command fails.
   * @returns {void}
   */
  trackUsage() {
    try {
      // Display notice if telemetry is not initialized
      const isFirstRun = this.telemetry.lib.isNull();
      if (isFirstRun) {
        this.logger.warn(TELEMETRY_NOTICE);
      }
      this.telemetry.track(
        {
          command: this.id,
          flags: this.typedFlags.join(","),
          durationMs: Date.now() - this.startedAt,
          cliVersion: this.config.version,
        },
        isFirstRun,
      );
    } catch {
      // Any exception must not fail the command
    }
  }
}
