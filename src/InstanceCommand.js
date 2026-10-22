// npm
import { Flags } from "@oclif/core";
import path from "node:path";
// acc
import BaseCommand from "./BaseCommand.js";
import AccInstance from "./services/instance/AccInstance.js";
import { CONFIG_FILENAME } from "./services/config/AccConfig.js";
import { codes } from "./helpers/AccErrors.js";
const { INSTANCE_ALIAS_UNRESOLVED } = codes;

/**
 * Base command for `acc instance ...` subcommands that talk to an instance.
 *
 * Centralizes the shared flags (alias/path/config) via oclif `baseFlags` and
 * the login + AccInstance bootstrap used by pull/check/exec.
 *
 * @class InstanceCommand
 */
export default class InstanceCommand extends BaseCommand {
  static baseFlags = {
    alias: Flags.string({
      char: "a",
      description:
        "Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of acc.config.json.",
    }),
    path: Flags.string({
      char: "p",
      description: "Path where the command should run.",
      default: () => process.cwd(),
      defaultHelp: () => "current working directory", // for generated README
    }),
    config: Flags.string({
      char: "c",
      description: "Path to the configuration file.",
      default: () => path.join(process.cwd(), CONFIG_FILENAME),
      defaultHelp: () => `./${CONFIG_FILENAME}`, // for generated README
    }),
  };

  /**
   * Logs in to the aliased instance and builds a AccInstance.
   * @param {object} flags - parsed CLI flags (alias, config, path, ...)
   * @param {object} [sdkOptionsOverride] - acc-js-sdk connection options merged
   *   over the config ones (e.g. a raised `timeout` for heavy calls)
   * @returns {AccInstance} a new AccInstance, ready to call its methods (pull/check/exec)
   */
  async getInstance(flags, sdkOptionsOverride = {}) {
    const config = this.makeConfig();
    // Only used when acc.config.json is created: the alias of the last
    // `auth init` is then written into it, which pins the project to it.
    config.init(flags.config, flags.alias || this.auth.currentAlias);
    const alias = flags.alias || config.alias;
    if (!alias) {
      throw new INSTANCE_ALIAS_UNRESOLVED();
    }
    if (flags.alias) {
      this.logger.info(`🏷️ Instance alias "${alias}" (from CLI)`);
    } else {
      this.logger.info(`🏷️ Instance alias "${alias}" (from config)`);
    }
    const resolvedFlags = { ...flags, alias };
    const client = await this.auth.login(resolvedFlags, {
      ...config.accJsSdkOptions,
      ...sdkOptionsOverride,
    });
    return new AccInstance(this.logger, client, config, resolvedFlags, (text) =>
      this.spinner(text),
    );
  }
}
