import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { AUTH_METHODS } from "../../CampaignAuth.js";

export default class AuthInit extends BaseCommand {
  static description =
    "Initialize authentication for an Adobe Campaign instance";

  static examples = [
    "<%= config.bin %> auth init --alias local --host http://localhost:8080 --method UserPassword --user admin",
    "<%= config.bin %> auth init --alias prod --host https://instance.com --method ImsBearerToken --token eyJ...",
    "<%= config.bin %> auth init --alias prod --host https://instance.com --method ImsServerToServer --json-file ./oauth-s2s.json",
  ];

  static flags = {
    alias: Flags.string({
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
    host: Flags.string({
      description: "URL of Adobe Campaign root, e.g. http://localhost:8080",
    }),
    method: Flags.string({
      options: [
        AUTH_METHODS.USER_PASSWORD,
        AUTH_METHODS.IMS_BEARER_TOKEN,
        AUTH_METHODS.IMS_SERVER_TO_SERVER,
      ],
      description:
        "Authentication method. Defaults to UserPassword. Use ImsServerToServer to login via tokens from the Developer Console OAuth Server-to-Server credentials, or use ImsBearerToken for a token pasted by hand.",
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
        "IMS bearer token (ImsBearerToken method), a JWT starting with 'eyJ'. Omit on an interactive terminal to be prompted securely.",
    }),
    "json-file": Flags.string({
      description:
        "Path to the OAuth Server-to-Server JSON downloaded from the Developer Console (Credentials > OAuth Server-to-Server > Download JSON). Implies --method ImsServerToServer. Keeps the client secret out of your shell history, unlike passing it on the command line.",
    }),
    "ims-env": Flags.string({
      options: ["prod", "stage"],
      description:
        "IMS environment for token generation (ImsServerToServer). Defaults to prod.",
    }),
  };

  async run() {
    const { flags } = await this.parse(AuthInit);
    // Normalize kebab-case CLI flags into the camelCase shape CampaignAuth uses.
    const { "json-file": jsonFile, "ims-env": imsEnv, ...rest } = flags;
    await this.auth.init({ ...rest, jsonFile, imsEnv });
  }
}
