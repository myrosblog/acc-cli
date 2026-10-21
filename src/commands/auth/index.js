import AioConfig from "@adobe/aio-lib-core-config/src/Config.js";
import BaseCommand from "../../BaseCommand.js";
import { logCredentialsFile } from "../../helpers/authConstants.js";

/**
 * Entry point of the `auth` topic: list its subcommands, then log where the authentication file is.
 *
 * Hidden because the root help already lists the `auth` topic (package.json `oclif.topics`).
 * Without it, `auth` would appear twice, as a topic and as a command.
 */
export default class Auth extends BaseCommand {
  static hidden = true;
  static description =
    "Initialize and troubleshoot authentications to your instances.";

  async run() {
    await this.showTopicHelp("auth");
    // Read the path from the aio config directly: no need to build `this.auth` to log it
    logCredentialsFile(this.logger, new AioConfig().reload().global.file);
  }
}
