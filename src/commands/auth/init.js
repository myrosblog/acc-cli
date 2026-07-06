import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { AUTH_METHODS } from "../../CampaignAuth.js";

export default class AuthInit extends BaseCommand {
  static description =
    "Initialize authentication for an Adobe Campaign instance";

  static examples = [
    "<%= config.bin %> auth init --alias local --host http://localhost:8080 --method UserPassword --user admin",
    "<%= config.bin %> auth init --alias prod --host https://instance.com --method ImsBearerToken --token eyJ...",
    '<%= config.bin %> auth init --alias prod --host https://instance.com --method ImsServerToServer --client-id abc --client-secret *** --org-id XXXX@AdobeOrg --scopes "openid,AdobeID,..."',
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
    "client-id": Flags.string({
      description: "IMS OAuth Server-to-Server client id (ImsServerToServer).",
    }),
    "client-secret": Flags.string({
      description:
        "IMS OAuth Server-to-Server client secret (ImsServerToServer). Omit on an interactive terminal to be prompted securely.",
    }),
    "org-id": Flags.string({
      description:
        "IMS organization id, e.g. XXXX@AdobeOrg (ImsServerToServer).",
    }),
    scopes: Flags.string({
      description:
        "Comma-separated IMS scopes copied from the Developer Console credential (ImsServerToServer).",
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
    const {
      "client-id": clientId,
      "client-secret": clientSecret,
      "org-id": orgId,
      "ims-env": imsEnv,
      ...rest
    } = flags;
    await this.auth.init({ ...rest, clientId, clientSecret, orgId, imsEnv });
  }
}
