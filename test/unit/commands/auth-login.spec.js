import { expect } from "chai";
import sinon from "sinon";
import AuthLogin from "../../../src/commands/auth/login.js";
import CampaignAuth from "../../../src/CampaignAuth.js";

describe("AuthLogin", () => {
  it("should have correct description", () => {
    expect(AuthLogin.description).to.match(/^Read credentials/);
  });

  it("should have required alias flag", () => {
    expect(AuthLogin.flags.alias.required).to.be.true;
    expect(AuthLogin.flags.alias.description).to.include("Local alias");
  });

  it("should run", async () => {
    const argv = ["--alias", "test"];
    const authLoginStub = sinon
      .stub(CampaignAuth.prototype, "login")
      .resolves();
    const result = await AuthLogin.run(argv);
    expect(result).to.be.undefined;
    expect(authLoginStub.calledOnce).to.be.true;
    sinon.restore();
  });

  describe("readSdkOptions", () => {
    afterEach(() => sinon.restore());

    it("returns {} when no acc.config.json exists", () => {
      const cmd = new AuthLogin([], {});
      sinon.stub(cmd, "makeConfig").returns({
        defaultConfigPath: "/nope/acc.config.json",
        fileExists: () => false,
        init: sinon.fake.throws("init must not be called"),
      });
      expect(cmd.readSdkOptions()).to.deep.equal({});
    });

    it("reads acc-js-sdk options when acc.config.json exists", () => {
      const cmd = new AuthLogin([], {});
      const init = sinon.fake();
      sinon.stub(cmd, "makeConfig").returns({
        defaultConfigPath: "/here/acc.config.json",
        fileExists: () => true,
        init,
        accJsSdkOptions: { traceAPICalls: false },
      });
      expect(cmd.readSdkOptions()).to.deep.equal({ traceAPICalls: false });
      expect(init.calledOnceWith("/here/acc.config.json")).to.be.true;
    });
  });
});
