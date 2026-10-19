import BaseCommand from "../../BaseCommand.js";

/**
 * Overrides the `aio config` command:
 * - Don't print the json, as it may include instance information
 * - Show the help to list its subcommands
 *
 * Listed as a command, and its topic is hidden (package.json `oclif.topics`): the aio plugin
 * declares the same topic with its own description, which wins over ours in the root help.
 */
export default class Config extends BaseCommand {
  static description =
    "Manage your authentication file (run `acc auth` for its path), not the project acc.config.json.";

  async run() {
    await this.showTopicHelp("config");
  }
}
