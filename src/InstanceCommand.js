// npm
import { Flags } from "@oclif/core";
import path from "node:path";
// acc
import BaseCommand from "./BaseCommand.js";
import CampaignInstance from "./CampaignInstance.js";
import { codes } from "./helpers/AccErrors.js";
const { INSTANCE_ALIAS_UNRESOLVED } = codes;

/**
 * Base command for `acc instance ...` subcommands that talk to an instance.
 *
 * Centralizes the shared flags (alias/path/config) via oclif `baseFlags` and
 * the login + CampaignInstance bootstrap used by pull/check/exec.
 *
 * @class InstanceCommand
 */
export default class InstanceCommand extends BaseCommand {
  static baseFlags = {
    alias: Flags.string({
      description:
        "Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of acc.config.json.",
    }),
    path: Flags.string({
      description:
        "Path where the command should run. Defaults to current working directory.",
      default: () => process.cwd(),
    }),
    config: Flags.string({
      description:
        "Path to the configuration file. Defaults ./acc.config.json.",
      default: () => path.join(process.cwd(), "acc.config.json"),
    }),
  };

  /**
   * Logs in to the aliased instance and builds a CampaignInstance.
   * @param {object} flags - parsed CLI flags (alias, config, path, ...)
   * @param {object} [sdkOptionsOverride] - acc-js-sdk connection options merged
   *   over the config ones (e.g. a raised `timeout` for heavy calls)
   * @returns {Promise<CampaignInstance>}
   */
  async getInstance(flags, sdkOptionsOverride = {}) {
    const config = this.makeConfig();
    config.init(flags.config);
    const alias = flags.alias || config.alias;
    if (!alias) {
      throw new INSTANCE_ALIAS_UNRESOLVED();
    }
    // Seed the alias into a freshly created config so it needn't be retyped.
    if (flags.alias) {
      config.seedAlias(flags.alias);
      this.logger.info(`🏷️ Instance alias "${alias}" (from CLI)`);
    } else {
      this.logger.info(`🏷️ Instance alias "${alias}" (from config)`);
    }
    const resolvedFlags = { ...flags, alias };
    const client = await this.auth.login(resolvedFlags, {
      ...config.accJsSdkOptions,
      ...sdkOptionsOverride,
    });
    return new CampaignInstance(
      this.logger,
      client,
      config,
      resolvedFlags,
      (text) => this.spinner(text),
    );
  }
}
