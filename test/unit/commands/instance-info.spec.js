import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignInstance from "../../../src/CampaignInstance.js";
import InstanceInfo from "../../../src/commands/instance/info.js";

describe("InstanceInfo", () => {
  afterEach(() => sinon.restore());

  it("should mention the probed SOAP methods in its description", () => {
    expect(InstanceInfo.description).to.contain("xtk:session#TestCnx");
    expect(InstanceInfo.description).to.contain(
      "nl:monitoring#DumpCurrentInstanceState",
    );
  });

  it("should have an optional alias flag", () => {
    expect(InstanceInfo.baseFlags.alias.required).to.not.be.true;
  });

  it("should login with a raised timeout and print the report", async () => {
    const argv = ["--alias", "test"];
    const authLoginStub = sinon
      .stub(CampaignAuth.prototype, "login")
      .resolves();
    sinon.stub(CampaignConfig.prototype, "init").resolves();
    const infoStub = sinon
      .stub(CampaignInstance.prototype, "info")
      .resolves({ text: "== report ==", errors: [] });
    const logStub = sinon.stub(InstanceInfo.prototype, "log");

    const result = await InstanceInfo.run(argv);

    expect(result).to.be.undefined;
    expect(infoStub.calledOnce).to.be.true;
    expect(logStub.calledOnceWith("== report ==")).to.be.true;
    // the heavy dump needs a timeout above the SDK default of 5000ms
    expect(authLoginStub.firstCall.args[1].timeout).to.equal(60000);
  });

  it("should exit non-zero when at least one probe failed", async () => {
    sinon.stub(CampaignAuth.prototype, "login").resolves();
    sinon.stub(CampaignConfig.prototype, "init").resolves();
    sinon
      .stub(CampaignInstance.prototype, "info")
      .resolves({ text: "== report ==", errors: [new Error("boom")] });
    sinon.stub(InstanceInfo.prototype, "log");

    await expect(InstanceInfo.run(["--alias", "test"])).to.be.rejected;
  });
});
