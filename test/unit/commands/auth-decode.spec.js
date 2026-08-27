import { expect } from "chai";
import sinon from "sinon";
import AuthDecode from "../../../src/commands/auth/decode.js";

// Transparent, unsigned fixture token (header.payload.sig).
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const HEADER = { alg: "RS256", x5u: "ims_na1-key-at-1.cer" };
const PAYLOAD = {
  user_id: "abc@AdobeID",
  created_at: "1700000000000",
  expires_in: "86400000",
  scope: "campaign_soap",
};
const TOKEN = `${b64url(HEADER)}.${b64url(PAYLOAD)}.sig`;

describe("AuthDecode", () => {
  afterEach(() => sinon.restore());

  it("should have a description", () => {
    expect(AuthDecode.description).to.match(/decode/i);
  });

  it("should enable the built-in json flag and require the token arg", () => {
    expect(AuthDecode.enableJsonFlag).to.be.true;
    expect(AuthDecode.args.token.required).to.be.true;
  });

  it("should print header, payload and an expiry block in human mode", async () => {
    const logStub = sinon.stub(AuthDecode.prototype, "log");

    const result = await AuthDecode.run([TOKEN]);

    expect(result).to.be.undefined;
    const output = logStub
      .getCalls()
      .map((c) => c.args[0])
      .join("\n");
    expect(output).to.include("Header:");
    expect(output).to.include("ims_na1-key-at-1.cer");
    expect(output).to.include("Payload:");
    expect(output).to.include("abc@AdobeID");
    expect(output).to.include("Expires at:");
    expect(output).to.include("Status:");
    // The raw token itself is never echoed back, only its decoded contents.
    expect(output).to.not.include(TOKEN);
  });

  it("should return { header, payload, expiry } in --json mode", async () => {
    sinon.stub(AuthDecode.prototype, "log");
    sinon.stub(AuthDecode.prototype, "logJson");

    const result = await AuthDecode.run([TOKEN, "--json"]);

    expect(result.header).to.deep.equal(HEADER);
    expect(result.payload).to.deep.equal(PAYLOAD);
    expect(result.expiry).to.have.all.keys(
      "issuedAt",
      "expiresAt",
      "isExpired",
      "expiresInMs",
    );
    // ISO strings, not Date objects, so the JSON stays portable.
    expect(result.expiry.expiresAt).to.be.a("string");
  });

  it("should reject a malformed token with AUTH_DECODE_INVALID", async () => {
    sinon.stub(AuthDecode.prototype, "log");
    await expect(AuthDecode.run(["not-a-jwt"])).to.be.rejectedWith(
      /not a valid JWT/,
    );
  });
});
