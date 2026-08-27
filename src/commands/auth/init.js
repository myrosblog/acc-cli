import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { AUTH_METHODS } from "../../CampaignAuth.js";
import { EXAMPLE_INSTANCE, DOC_IMS } from "../../helpers/helpText.js";

export default class AuthInit extends BaseCommand {
  static description =
    "Authenticate an Adobe Campaign instance, save credentials (in local .aio file), and calls `auth login`.\n\n" +
    "The currently supported authentication methods are:\n\n" +
    "- OAuth Server-to-Server (preferred): a JSON file from the Adobe Developer Console, for instances with an IMS identity provider.\n" +
    "- OAuth Access Token: a JWT token pasted by hand, for instances with an IMS identity provider.\n" +
    "- Operator User/Password: the classic operator login, for local instances or instances without IMS.\n" +
    "\n" +
    "The `auth init` command saves credentials in the local .aio file, and then logs in to the instance. " +
    "The `auth login` command can be used later to re-login without re-entering credentials.\n" +
    "\n" +
    DOC_IMS;

  static examples = [
    {
      command: "<%= config.bin %> auth init",
      description: "Initialize authentication with menu selection (preferred).",
    },
    {
      command: `<%= config.bin %> auth init --alias prod --host ${EXAMPLE_INSTANCE} --method ImsServerToServer --json-file ./oauth-s2s.json`,
      description:
        "For CI/CD: Initialize authentication with OAuth Server-to-Server method.",
    },
    {
      command: `<%= config.bin %> auth init --alias prod --host ${EXAMPLE_INSTANCE} --method ImsBearerToken --token eyJ...`,
      description:
        "For CI/CD: Initialize authentication with OAuth Access Token method.",
    },
    {
      command: `<%= config.bin %> auth init --alias local --host ${EXAMPLE_INSTANCE} --method UserPassword --user admin`,
      description:
        "For CI/CD: Initialize authentication with Operator User/Password method.",
    },
  ];

  static flags = {
    alias: Flags.string({
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
    host: Flags.string({
      description: `URL of Adobe Campaign instance, e.g. ${EXAMPLE_INSTANCE}`,
    }),
    method: Flags.string({
      options: [
        AUTH_METHODS.USER_PASSWORD,
        AUTH_METHODS.IMS_BEARER_TOKEN,
        AUTH_METHODS.IMS_SERVER_TO_SERVER,
      ],
      description:
        "Authentication method. Defaults to UserPassword. Use ImsServerToServer to login via JSON from the Developer Console OAuth Server-to-Server credentials, or use ImsBearerToken for a token pasted by hand.",
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
