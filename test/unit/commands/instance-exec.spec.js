import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignInstance from "../../../src/CampaignInstance.js";
import InstanceExec from "../../../src/commands/instance/exec.js";

describe("InstanceExec", () => {
  it("should have correct description", () => {
    expect(InstanceExec.description).to.equal(
      "Execute server-side JavaScript on an Adobe Campaign instance (xtk:builder#EvaluateJavaScript)",
    );
  });

  it("should have an optional alias flag", () => {
    expect(InstanceExec.baseFlags.alias.required).to.not.be.true;
  });

  it("should have optional flags", () => {
    expect(InstanceExec.flags.file).to.exist;
    expect(InstanceExec.flags.script).to.exist;
    expect(InstanceExec.flags.name).to.exist;
    expect(InstanceExec.baseFlags.config).to.exist;
  });

  it("should run", async () => {
    const argv = ["--alias", "test", "--script", "logInfo('hi')"];
    const authLoginStub = sinon
      .stub(CampaignAuth.prototype, "login")
      .resolves();
    const configInitStub = sinon
      .stub(CampaignConfig.prototype, "init")
      .resolves();
    const instanceExecStub = sinon
      .stub(CampaignInstance.prototype, "exec")
      .resolves();
    const result = await InstanceExec.run(argv);
    expect(result).to.be.undefined;
    expect(authLoginStub.calledOnce).to.be.true;
    expect(configInitStub.calledOnce).to.be.true;
    expect(instanceExecStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
