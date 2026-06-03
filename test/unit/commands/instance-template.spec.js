import { expect } from "chai";
import sinon from "sinon";
import CampaignConfig from "../../../src/CampaignConfig.js";
import InstanceTemplate from "../../../src/commands/instance/template.js";

describe("InstanceTemplate", () => {
  it("should have correct description", () => {
    expect(InstanceTemplate.description).to.equal(
      "Generate a template configuration file",
    );
  });

  it("should have no flags", () => {
    expect(InstanceTemplate.flags).to.be.undefined;
  });

  it("should run and print the template on stdout", async () => {
    const argv = [];
    const configTemplateStub = sinon
      .stub(CampaignConfig.prototype, "template")
      .returns('{"schemas": []}');
    // this.log is oclif's stdout writer: the template must go there, raw,
    // so `acc instance template > acc.config.json` yields a clean file.
    const logStub = sinon.stub(InstanceTemplate.prototype, "log");
    const result = await InstanceTemplate.run(argv);
    expect(result).to.be.undefined;
    expect(configTemplateStub.calledOnce).to.be.true;
    expect(logStub.calledOnceWith('{"schemas": []}')).to.be.true;
    sinon.restore();
  });
});
