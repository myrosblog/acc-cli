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

  it("should have required flags", () => {
    expect(AuthInit.flags.alias.required).to.be.true;
    expect(AuthInit.flags.host.required).to.be.true;
    expect(AuthInit.flags.user.required).to.be.true;
    expect(AuthInit.flags.pass.required).to.be.true;
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
    const authInitStub = sinon
      .stub(CampaignAuth.prototype, "init")
      .resolves();
    const result = await AuthInit.run(argv);
    expect(result).to.be.undefined;
    expect(authInitStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
