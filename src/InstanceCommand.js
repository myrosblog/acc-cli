// npm
import { Flags } from "@oclif/core";
import path from "node:path";
// acc
import BaseCommand from "./BaseCommand.js";
import CampaignInstance from "./CampaignInstance.js";

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
      required: true,
      description: "Local alias for this instance, e.g. prod, staging, local",
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
   * @returns {Promise<CampaignInstance>}
   */
  async getInstance(flags) {
    const config = this.makeConfig();
    config.init(flags.config);
    const client = await this.auth.login(flags, config.accJsSdkOptions);
    return new CampaignInstance(this.logger, client, config, flags, (text) =>
      this.spinner(text),
    );
  }
}
