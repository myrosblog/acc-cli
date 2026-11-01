import { expect } from "chai";
import sinon from "sinon";
import AccAuth from "../../../src/services/auth/AccAuth.js";
import AccConfig from "../../../src/services/config/AccConfig.js";
import AccInstancePull from "../../../src/services/instance/AccInstancePull.js";
import InstanceCheck from "../../../src/commands/instance/check.js";

describe("InstanceCheck", () => {
  it("should have correct description", () => {
    expect(InstanceCheck.description).to.contain(
      "Compute how many records will be downloaded",
    );
  });

  it("should have an optional alias flag", () => {
    expect(InstanceCheck.baseFlags.alias.required).to.not.be.true;
  });

  it("should have optional flags", () => {
    expect(InstanceCheck.baseFlags.path).to.exist;
    expect(InstanceCheck.baseFlags.config).to.exist;
    expect(InstanceCheck.flags.metadata).to.exist;
  });

  it("should run", async () => {
    const argv = ["--alias", "test"];
    const authLoginStub = sinon.stub(AccAuth.prototype, "login").resolves();
    const instanceLoginStub = sinon
      .stub(AccInstancePull.prototype, "pull")
      .resolves();
    const configInitStub = sinon.stub(AccConfig.prototype, "init").resolves();
    const result = await InstanceCheck.run(argv);
    expect(result).to.be.undefined;
    expect(authLoginStub.calledOnce).to.be.true;
    expect(configInitStub.calledOnce).to.be.true;
    expect(instanceLoginStub.calledOnce).to.be.true;
    sinon.restore();
  });
});
