import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";

export default class AuthInit extends BaseCommand {
  static description =
    "Initialize authentication for an Adobe Campaign instance";

  static flags = {
    alias: Flags.string({
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
    host: Flags.string({
      description: "URL of Adobe Campaign root, e.g. http://localhost:8080",
    }),
    user: Flags.string({
      description: "Operator username",
    }),
    pass: Flags.string({
      description:
        "Operator password. Omit on an interactive terminal to be prompted securely (avoids leaking it into shell history).",
    }),
  };

  async run() {
    const { flags } = await this.parse(AuthInit);
    await this.auth.init(flags);
  }
}
