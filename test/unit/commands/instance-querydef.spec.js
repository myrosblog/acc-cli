import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignInstance from "../../../src/CampaignInstance.js";
import InstanceQueryDef from "../../../src/commands/instance/queryDef.js";

describe("InstanceQueryDef", () => {
  afterEach(() => sinon.restore());

  const QUERY = '{"schema":"nms:recipient","operation":"select"}';

  it("should have correct description", () => {
    expect(InstanceQueryDef.description).to.match(
      /read-only query.*xtk:queryDef#ExecuteQuery/,
    );
  });

  it("should enable the built-in json flag", () => {
    expect(InstanceQueryDef.enableJsonFlag).to.be.true;
  });

  it("should have an optional alias flag", () => {
    expect(InstanceQueryDef.baseFlags.alias.required).to.not.be.true;
  });

  it("should have query and file flags", () => {
    expect(InstanceQueryDef.flags.query).to.exist;
    expect(InstanceQueryDef.flags.file).to.exist;
    expect(InstanceQueryDef.baseFlags.config).to.exist;
  });

  // Keeps getInstance() off the network/disk: stubs login + config.init.
  function stubBootstrap() {
    sinon.stub(CampaignAuth.prototype, "login").resolves();
    sinon.stub(CampaignConfig.prototype, "init").resolves();
  }

  it("should print the raw XML result on stdout in human mode", async () => {
    stubBootstrap();
    const queryDefStub = sinon
      .stub(CampaignInstance.prototype, "queryDef")
      .resolves(
        "<recipient-collection><recipient id='1'/></recipient-collection>",
      );
    const logStub = sinon.stub(InstanceQueryDef.prototype, "log");

    const argv = ["--alias", "test", "--query", QUERY];
    const result = await InstanceQueryDef.run(argv);

    expect(result).to.be.undefined; // nothing returned in human mode
    expect(queryDefStub.calledOnce).to.be.true;
    // the instance is asked for XML (json:false) in human mode
    expect(queryDefStub.firstCall.args[0].json).to.equal(false);
    expect(queryDefStub.firstCall.args[0].query).to.equal(QUERY);
    expect(
      logStub.calledOnceWith(
        "<recipient-collection><recipient id='1'/></recipient-collection>",
      ),
    ).to.be.true;
  });

  it("should return the SimpleJson object in --json mode (no stdout log)", async () => {
    stubBootstrap();
    const jsonResult = { recipient: [{ id: "1" }] };
    const queryDefStub = sinon
      .stub(CampaignInstance.prototype, "queryDef")
      .resolves(jsonResult);
    const logStub = sinon.stub(InstanceQueryDef.prototype, "log");
    sinon.stub(InstanceQueryDef.prototype, "logJson"); // oclif prints it

    const argv = ["--alias", "test", "--query", QUERY, "--json"];
    const result = await InstanceQueryDef.run(argv);

    expect(result).to.deep.equal(jsonResult);
    // json:true is forwarded so the instance returns SimpleJson
    expect(queryDefStub.firstCall.args[0].json).to.equal(true);
    expect(logStub.called).to.be.false; // raw XML is never written in json mode
  });
});
