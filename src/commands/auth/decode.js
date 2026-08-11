import { Args } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { decodeJwt, summarizeExpiry, formatExpiry } from "../../helpers/jwt.js";

export default class AuthDecode extends BaseCommand {
  static description =
    "Decode an Adobe IMS access token (JWT) for debugging: base64 → JSON, plus an expiry summary. The signature is NOT verified.";

  static examples = [
    '<%= config.bin %> auth decode "eyJhbGci…"',
    '<%= config.bin %> auth decode "eyJhbGci…" --json',
  ];

  // Enables the built-in oclif `--json` flag: when set, oclif serialises the
  // object returned by run() instead of printing the human report below.
  static enableJsonFlag = true;

  static args = {
    token: Args.string({
      required: true,
      description: "IMS access token / JWT to decode (starts with 'eyJ')",
    }),
  };

  async run() {
    const { args } = await this.parse(AuthDecode);
    // Decodes header+payload without verifying the signature; a malformed token
    // surfaces as AUTH_DECODE_INVALID (rendered by oclif's error handler).
    const { header, payload } = decodeJwt(args.token);
    const expiry = summarizeExpiry(payload);

    if (this.jsonEnabled()) {
      return {
        header,
        payload,
        expiry: {
          // Dates as ISO strings so the JSON stays portable and pipeable.
          issuedAt: expiry.issuedAt ? expiry.issuedAt.toISOString() : null,
          expiresAt: expiry.expiresAt ? expiry.expiresAt.toISOString() : null,
          isExpired: expiry.isExpired,
          expiresInMs: expiry.expiresInMs,
        },
      };
    }

    // Human mode: the decoded claims are the command's data → stdout (this.log).
    // The raw token is never echoed back; only its decoded contents.
    this.log("Header:");
    this.log(JSON.stringify(header, null, 2));
    this.log("\nPayload:");
    this.log(JSON.stringify(payload, null, 2));
    this.log("\nExpiry:");
    this.log(formatExpiry(expiry));
  }
}
