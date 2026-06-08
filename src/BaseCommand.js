// npm
import { Command } from "@oclif/core";
import path from "node:path";
import ora from "ora";
// sdk
import sdk from "@adobe/acc-js-sdk";
import Config from "@adobe/aio-lib-core-config/src/Config.js";
// acc
import makeLogger from "./helpers/makeLogger.js";
import CampaignAuth from "./CampaignAuth.js";
import CampaignConfig from "./CampaignConfig.js";
import CampaignMonitor from "./CampaignMonitor.js";

/**
 * Base oclif command for acc.
 *
 * Provides lazily-constructed shared services (logger, auth, spinner) and a
 * config factory, so that *importing* a command (e.g. for help generation or
 * in unit tests) has no side effects — services are only built on first use,
 * inside run().
 *
 * Lives in src/ (NOT src/commands/) on purpose: every file under src/commands
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
   * @type {CampaignAuth}
   */
  get auth() {
    return (this._auth ??= new CampaignAuth(this.logger, sdk, new Config()));
  }

  /**
   * @type {CampaignMonitor}
   */
  get monitor() {
    return (this._monitor ??= new CampaignMonitor(this.logger, sdk, this.auth));
  }

  /**
   * Builds a fresh config rooted at ./acc.config.json.
   * @returns {CampaignConfig}
   */
  makeConfig() {
    return new CampaignConfig(
      this.logger,
      path.join(process.cwd(), "acc.config.json"),
    );
  }

  /**
   * Ora spinner factory (kept as a method for easy injection in tests).
   * @param {string} text
   */
  spinner(text) {
    return ora(text);
  }
}
