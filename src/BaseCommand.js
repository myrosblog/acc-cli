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
   * @type {AioLogger}
   */
  get logger() {
    if (!this._logger) {
      this._logger = makeLogger(this.config?.cacheDir);
      this._logger.info(`📰 Writing logs to ${this.config?.cacheDir}`);
    }
    return this._logger;
  }

  /**
   * @type {AccAuth}
   */
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

  /**
   * @type {AccMonitor}
   */
  get monitor() {
    return (this._monitor ??= new AccMonitor(this.logger, sdk, this.auth));
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
    return super.finally(err);
  }
}
