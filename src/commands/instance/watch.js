import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";
import CampaignWatcher from "../../CampaignWatcher.js";

/**
 * Command to watch decomposed files and push changes to Adobe Campaign instance.
 * Only files described by the "decompose" key in acc.config.json are watched.
 * When a file is edited, its content is wrapped in CDATA and pushed to the server.
 *
 * @class InstanceWatch
 * @augments InstanceCommand
 */
export default class InstanceWatch extends InstanceCommand {
  static description =
    "Watch decomposed files and push changes to Adobe Campaign instance. Only files with 'decompose' configuration in acc.config.json are watched.";

  static examples = [
    {
      command: "<%= config.bin %> instance watch --alias staging",
      description:
        "Watch decomposed files and push changes to the staging instance",
    },
    {
      command: "<%= config.bin %> instance watch --alias staging --path ./src",
      description:
        "Watch decomposed files in ./src directory and push changes to the staging instance",
    },
    {
      command: "<%= config.bin %> instance watch --alias local --debounce 500",
      description: "Watch decomposed files with a 500ms debounce delay",
    },
  ];

  static flags = {
    debounce: Flags.integer({
      description:
        "Debounce time in milliseconds to wait after file changes before pushing (default: 300)",
      default: 300,
    }),
  };

  /**
   * CampaignWatcher instance
   * @type {CampaignWatcher | null}
   */
  watcher = null;

  async run() {
    const { flags } = await this.parse(InstanceWatch);

    // Get authenticated instance
    const instance = await this.getInstance(flags);

    // Create watcher with dependency injection
    this.watcher = new CampaignWatcher(
      this.logger,
      instance.client,
      instance.accConfig,
      flags,
      (text) => this.spinner(text),
    );

    // Set up graceful shutdown
    const shutdown = async () => {
      if (this.watcher) {
        await this.watcher.stopWatching();
        this.watcher = null;
      }
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("SIGHUP", shutdown);

    // Start watching
    try {
      await this.watcher.startWatching(flags.debounce);
    } catch (err) {
      this.logger.error(err.message);
      process.exit(1);
    }
  }
}
