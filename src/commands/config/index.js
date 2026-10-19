import { Command, loadHelpClass } from "@oclif/core";

/**
 * Overrides the `aio config` command:
 * - Don't print the json, as it may include instance information
 * - Show the help to list its subcommands
 */
export default class Config extends Command {
  static description =
    "Manage the aio authentication file (~/.config/aio), not acc.config.json.";

  async run() {
    // run `acc config -h'
    const HelpClass = await loadHelpClass(this.config);
    await new HelpClass(this.config).showHelp(["config"]);
  }
}
