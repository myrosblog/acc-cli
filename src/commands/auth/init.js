import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { AUTH_METHODS } from "../../CampaignAuth.js";

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
    method: Flags.string({
      options: [AUTH_METHODS.USER_PASSWORD, AUTH_METHODS.IMS_BEARER_TOKEN],
      description:
        "Authentication method. Defaults to UserPassword. Use ImsBearerToken for Campaign 8.5+ IMS.",
    }),
    user: Flags.string({
      description: "Operator username (UserPassword method)",
    }),
    pass: Flags.string({
      description:
        "Operator password (UserPassword method). Omit on an interactive terminal to be prompted securely (avoids leaking it into shell history).",
    }),
    token: Flags.string({
      description:
        "IMS bearer token (ImsBearerToken method). Omit on an interactive terminal to be prompted securely.",
    }),
  };

  async run() {
    const { flags } = await this.parse(AuthInit);
    await this.auth.init(flags);
  }
}
