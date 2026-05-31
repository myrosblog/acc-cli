import { expect } from "chai";
import sinon from "sinon";
import MonitorTest from "../../../src/commands/monitor/test.js";
import CampaignMonitor from "../../../src/CampaignMonitor.js";

describe("MonitorTest", () => {
  afterEach(() => sinon.restore());

  it("should have correct description", () => {
    expect(MonitorTest.description).to.include("/r/test");
  });

  it("should have host and alias flags", () => {
    expect(MonitorTest.flags.host).to.exist;
    expect(MonitorTest.flags.alias).to.exist;
  });

  it("host and alias should be mutually exclusive", () => {
    expect(MonitorTest.flags.host.exclusive).to.deep.equal(["alias"]);
    expect(MonitorTest.flags.alias.exclusive).to.deep.equal(["host"]);
  });

  it("should run and print the raw xml", async () => {
    const logStub = sinon.stub(MonitorTest.prototype, "log");
    const testStub = sinon
      .stub(CampaignMonitor.prototype, "test")
      .resolves({ xml: '<redir status="OK"/>', status: "OK" });
    const result = await MonitorTest.run([
      "--host",
      "https://acme.example.com",
    ]);
    expect(result).to.be.undefined;
    expect(testStub.calledOnce).to.be.true;
    expect(logStub.calledWith('<redir status="OK"/>')).to.be.true;
  });

  it("should fail with non-zero exit when status is not OK", async () => {
    sinon.stub(MonitorTest.prototype, "log");
    sinon
      .stub(CampaignMonitor.prototype, "test")
      .resolves({ xml: '<redir status="KO"/>', status: "KO" });
    await expect(MonitorTest.run(["--host", "https://acme.example.com"])).to.be
      .rejected;
  });
});
