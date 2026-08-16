import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";

export default class AuthLogin extends BaseCommand {
  static description =
    "Read credentials (from local .aio file) and login to an Adobe Campaign instance. Must be ran after `auth init`.";

  static examples = [
    {
      command: "<%= config.bin %> auth login --alias local",
      description:
        "Read credentials for the json key 'local', and login. Usually for a local Adobe Campaign VM.",
    },
    {
      command: "<%= config.bin %> auth login --alias prod",
      description:
        "Read credentials for the json key 'prod', and login. Usually for a production Adobe Campaign instance.",
    },
  ];

  static flags = {
    alias: Flags.string({
      required: true,
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
  };

  async run() {
    const { flags } = await this.parse(AuthLogin);
    await this.auth.login(flags, this.readSdkOptions());
  }

  /**
   * Reads `acc-js-sdk` options from ./acc.config.json when present, so options
   * like `traceAPICalls` apply to the login itself. Returns {} when no config
   * file exists — a bare login must not scaffold a project config.
   * @returns {object}
   */
  readSdkOptions() {
    const config = this.makeConfig();
    if (!config.fileExists(config.defaultConfigPath)) {
      return {};
    }
    config.init(config.defaultConfigPath);
    return config.accJsSdkOptions;
  }
}
