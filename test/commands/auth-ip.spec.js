import { expect } from "chai";
import sinon from "sinon";
import AuthIp from "../../src/commands/auth/ip.js";
import CampaignAuth from "../../src/CampaignAuth.js";

describe("AuthIp", () => {
  it("should have correct description", () => {
    expect(AuthIp.description).to.equal(
      "Get IP address of the current machine",
    );
  });

  it("should have no flags", () => {
    expect(AuthIp.flags).to.be.undefined;
  });

  it("should run", async () => {
    const argv = [];
    const authIpStub = sinon.stub(CampaignAuth.prototype, "ip").resolves();
    const result = await AuthIp.run(argv);
    expect(result).to.be.undefined;
    expect(authIpStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
