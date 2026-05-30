import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";

export default class AuthLogin extends BaseCommand {
  static description = "Login to an Adobe Campaign instance";

  static flags = {
    alias: Flags.string({
      required: true,
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
  };

  async run() {
    const { flags } = await this.parse(AuthLogin);
    await this.auth.login(flags);
  }
}
