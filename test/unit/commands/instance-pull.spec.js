import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignInstance from "../../../src/CampaignInstance.js";
import InstancePull from "../../../src/commands/instance/pull.js";

describe("InstancePull", () => {
  it("should have correct description", () => {
    expect(InstancePull.description).to.equal(
      "Pull data from Adobe Campaign instance",
    );
  });

  it("should have required alias flag", () => {
    expect(InstancePull.baseFlags.alias.required).to.be.true;
  });

  it("should have optional flags", () => {
    expect(InstancePull.baseFlags.path).to.exist;
    expect(InstancePull.baseFlags.config).to.exist;
    expect(InstancePull.flags.metadata).to.exist;
  });

  it("should run", async () => {
    const argv = ["--alias", "test"];
    const authLoginStub = sinon
      .stub(CampaignAuth.prototype, "login")
      .resolves();
    const configInitStub = sinon
      .stub(CampaignConfig.prototype, "init")
      .resolves();
    const instanceLoginStub = sinon
      .stub(CampaignInstance.prototype, "pull")
      .resolves();
    const result = await InstancePull.run(argv);
    expect(result).to.be.undefined;
    expect(authLoginStub.calledOnce).to.be.true;
    expect(configInitStub.calledOnce).to.be.true;
    expect(instanceLoginStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
