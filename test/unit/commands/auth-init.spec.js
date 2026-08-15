import { expect } from "chai";
import sinon from "sinon";
import AuthInit from "../../../src/commands/auth/init.js";
import CampaignAuth from "../../../src/CampaignAuth.js";

describe("AuthInit", () => {
  it("should have correct description", () => {
    expect(AuthInit.description).to.equal(
      "Initialize authentication for an Adobe Campaign instance",
    );
  });

  it("should have optional flags (prompted interactively when omitted)", () => {
    expect(AuthInit.flags.alias.required).to.not.be.true;
    expect(AuthInit.flags.host.required).to.not.be.true;
    expect(AuthInit.flags.user.required).to.not.be.true;
    expect(AuthInit.flags.pass.required).to.not.be.true;
    expect(AuthInit.flags.method.required).to.not.be.true;
    expect(AuthInit.flags.token.required).to.not.be.true;
    expect(AuthInit.flags["json-file"].required).to.not.be.true;
    expect(AuthInit.flags["ims-env"].required).to.not.be.true;
  });

  it("should restrict --method to the supported auth methods", () => {
    expect(AuthInit.flags.method.options).to.deep.equal([
      "UserPassword",
      "ImsBearerToken",
      "ImsServerToServer",
    ]);
  });

  it("should run an ImsBearerToken init", async () => {
    const argv = [
      "--alias",
      "test",
      "--host",
      "http://test.com",
      "--method",
      "ImsBearerToken",
      "--token",
      "ims-token",
    ];
    const authInitStub = sinon.stub(CampaignAuth.prototype, "init").resolves();
    const result = await AuthInit.run(argv);
    expect(result).to.be.undefined;
    expect(authInitStub.calledOnce).to.be.true;
    expect(authInitStub.firstCall.args[0]).to.include({
      method: "ImsBearerToken",
      token: "ims-token",
    });
    sinon.restore();
  });

  it("should normalize kebab-case S2S flags to camelCase for init", async () => {
    const argv = [
      "--alias",
      "s2s",
      "--host",
      "http://test.com",
      "--method",
      "ImsServerToServer",
      "--json-file",
      "./oauth-s2s.json",
      "--ims-env",
      "stage",
    ];
    const authInitStub = sinon.stub(CampaignAuth.prototype, "init").resolves();
    await AuthInit.run(argv);
    expect(authInitStub.calledOnce).to.be.true;
    expect(authInitStub.firstCall.args[0]).to.include({
      method: "ImsServerToServer",
      jsonFile: "./oauth-s2s.json",
      imsEnv: "stage",
    });
    // The kebab-case originals must not leak through: CampaignAuth reads
    // camelCase only, so a stray "json-file" key would silently do nothing.
    expect(authInitStub.firstCall.args[0]).to.not.have.property("json-file");
    expect(authInitStub.firstCall.args[0]).to.not.have.property("ims-env");
    sinon.restore();
  });

  it("should have correct flag descriptions", () => {
    expect(AuthInit.flags.alias.description).to.include("Local alias");
    expect(AuthInit.flags.host.description).to.include("URL of Adobe Campaign");
  });

  it("should run", async () => {
    const argv = [
      "--alias",
      "test",
      "--host",
      "http://test.com",
      "--user",
      "test",
      "--pass",
      "test",
    ];
    const authInitStub = sinon.stub(CampaignAuth.prototype, "init").resolves();
    const result = await AuthInit.run(argv);
    expect(result).to.be.undefined;
    expect(authInitStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
