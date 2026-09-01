import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignInstance from "../../../src/CampaignInstance.js";
import InstanceSoap from "../../../src/commands/instance/soap.js";

describe("InstanceSoap", () => {
  afterEach(() => sinon.restore());

  it("should have correct description", () => {
    expect(InstanceSoap.description).to.match(/SOAP method/);
  });

  it("should enable the built-in json flag", () => {
    expect(InstanceSoap.enableJsonFlag).to.be.true;
  });

  it("should have an optional alias flag", () => {
    expect(InstanceSoap.baseFlags.alias.required).to.not.be.true;
  });

  it("should require schema and method, and have an optional args flag", () => {
    expect(InstanceSoap.flags.schema.required).to.be.true;
    expect(InstanceSoap.flags.method.required).to.be.true;
    expect(InstanceSoap.flags.args.required).to.not.be.true;
    expect(InstanceSoap.baseFlags.config).to.exist;
  });

  // Keeps getInstance() off the network/disk: stubs login + config.init.
  function stubBootstrap() {
    sinon.stub(CampaignAuth.prototype, "login").resolves();
    sinon.stub(CampaignConfig.prototype, "init").resolves();
  }

  it("should print the raw XML result on stdout in human mode", async () => {
    stubBootstrap();
    const soapStub = sinon
      .stub(CampaignInstance.prototype, "soap")
      .resolves("<preview/>");
    const logStub = sinon.stub(InstanceSoap.prototype, "log");

    const argv = [
      "--alias",
      "test",
      "--schema",
      "nms:delivery",
      "--method",
      "BuildPreviewFromId",
      "--args",
      "[1234]",
    ];
    const result = await InstanceSoap.run(argv);

    expect(result).to.be.undefined; // nothing returned in human mode
    expect(soapStub.calledOnce).to.be.true;
    // the instance is asked for XML (json:false) in human mode
    expect(soapStub.firstCall.args[0].json).to.equal(false);
    expect(soapStub.firstCall.args[0].schema).to.equal("nms:delivery");
    expect(soapStub.firstCall.args[0].method).to.equal("BuildPreviewFromId");
    expect(soapStub.firstCall.args[0].args).to.equal("[1234]");
    expect(logStub.calledOnceWith("<preview/>")).to.be.true;
  });

  it("should return the SimpleJson object in --json mode (no stdout log)", async () => {
    stubBootstrap();
    const jsonResult = { serverTime: "2026-06-26" };
    const soapStub = sinon
      .stub(CampaignInstance.prototype, "soap")
      .resolves(jsonResult);
    const logStub = sinon.stub(InstanceSoap.prototype, "log");
    sinon.stub(InstanceSoap.prototype, "logJson"); // oclif prints it

    const argv = [
      "--alias",
      "test",
      "--schema",
      "xtk:session",
      "--method",
      "GetServerTime",
      "--json",
    ];
    const result = await InstanceSoap.run(argv);

    expect(result).to.deep.equal(jsonResult);
    // json:true is forwarded so the instance returns SimpleJson
    expect(soapStub.firstCall.args[0].json).to.equal(true);
    expect(logStub.called).to.be.false; // raw XML is never written in json mode
  });
});
