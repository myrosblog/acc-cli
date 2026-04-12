import { expect } from "chai";
import sinon from "sinon";
import AuthLogin from "../../../src/commands/auth/login.js";
import CampaignAuth from "../../../src/CampaignAuth.js";

describe("AuthLogin", () => {
  it("should have correct description", () => {
    expect(AuthLogin.description).to.equal(
      "Login to an Adobe Campaign instance",
    );
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
});
