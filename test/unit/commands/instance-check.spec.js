import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignInstance from "../../../src/CampaignInstance.js";
import InstanceCheck from "../../../src/commands/instance/check.js";

describe("InstanceCheck", () => {
  it("should have correct description", () => {
    expect(InstanceCheck.description).to.equal(
      "Check configuration and preview data pull from Adobe Campaign instance",
    );
  });

  it("should have required alias flag", () => {
    expect(InstanceCheck.baseFlags.alias.required).to.be.true;
  });

  it("should have optional flags", () => {
    expect(InstanceCheck.baseFlags.path).to.exist;
    expect(InstanceCheck.baseFlags.config).to.exist;
    expect(InstanceCheck.flags.metadata).to.exist;
  });

  it("should run", async () => {
    const argv = ["--alias", "test"];
    const authLoginStub = sinon
      .stub(CampaignAuth.prototype, "login")
      .resolves();
    const instanceLoginStub = sinon
      .stub(CampaignInstance.prototype, "pull")
      .resolves();
    const configInitStub = sinon
      .stub(CampaignConfig.prototype, "init")
      .resolves();
    const result = await InstanceCheck.run(argv);
    expect(result).to.be.undefined;
    expect(authLoginStub.calledOnce).to.be.true;
    expect(configInitStub.calledOnce).to.be.true;
    expect(instanceLoginStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
