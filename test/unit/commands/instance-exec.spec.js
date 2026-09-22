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

  it("should run and print the result on stdout", async () => {
    const argv = ["--alias", "test", "--script", "logInfo('hi')"];
    const authLoginStub = sinon
      .stub(CampaignAuth.prototype, "login")
      .resolves();
    const configInitStub = sinon
      .stub(CampaignConfig.prototype, "init")
      .resolves();
    const instanceExecStub = sinon
      .stub(CampaignInstance.prototype, "exec")
      .resolves("<context result='ok'/>");
    // this.log is oclif's stdout writer: the result must go there, raw.
    const logStub = sinon.stub(InstanceExec.prototype, "log");
    const result = await InstanceExec.run(argv);
    expect(result).to.be.undefined;
    expect(authLoginStub.calledOnce).to.be.true;
    expect(configInitStub.calledOnce).to.be.true;
    expect(instanceExecStub.calledOnce).to.be.true;
    expect(logStub.calledOnceWith("<context result='ok'/>")).to.be.true;
    sinon.restore();
  });

  describe("--file/--script validation", () => {
    // Flag validation must reject before login: a missing/conflicting flag
    // is a pure input mistake and shouldn't cost a network round trip.
    afterEach(() => sinon.restore());

    it("rejects with neither --file nor --script, without logging in", async () => {
      const authLoginStub = sinon.stub(CampaignAuth.prototype, "login");
      const argv = ["--alias", "test"];

      await expect(InstanceExec.run(argv)).to.be.rejectedWith(
        /Exactly one of the following must be provided: --file, --script/,
      );
      expect(authLoginStub.called).to.be.false;
    });

    it("rejects with both --file and --script, without logging in", async () => {
      const authLoginStub = sinon.stub(CampaignAuth.prototype, "login");
      const argv = [
        "--alias",
        "test",
        "--file",
        "./script.js",
        "--script",
        "logInfo('hi')",
      ];

      await expect(InstanceExec.run(argv)).to.be.rejectedWith(
        /--script cannot also be provided when using --file/,
      );
      expect(authLoginStub.called).to.be.false;
    });
  });
});
