import { expect } from "chai";
import sinon from "sinon";
import { ux } from "@oclif/core";
import AccAuth from "../../../src/AccAuth.js";
import AccConfig from "../../../src/AccConfig.js";
import AccInstance from "../../../src/AccInstance.js";
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
    sinon.stub(AccAuth.prototype, "login").resolves();
    sinon.stub(AccConfig.prototype, "init").resolves();
  }

  it("should print the raw XML result on stdout in human mode", async () => {
    stubBootstrap();
    const queryDefStub = sinon
      .stub(AccInstance.prototype, "queryDef")
      .resolves(
        "<recipient-collection><recipient id='1'/></recipient-collection>",
      );
    const logStub = sinon.stub(InstanceQueryDef.prototype, "log");

    const argv = ["--alias", "test", "--query", QUERY];
    const result = await InstanceQueryDef.run(argv);

    expect(result).to.equal(
      "<recipient-collection><recipient id='1'/></recipient-collection>",
    );
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
      .stub(AccInstance.prototype, "queryDef")
      .resolves(jsonResult);
    const stdoutStub = sinon.stub(ux, "stdout");
    sinon.stub(InstanceQueryDef.prototype, "logJson"); // oclif prints it

    const argv = ["--alias", "test", "--query", QUERY, "--json"];
    const result = await InstanceQueryDef.run(argv);

    expect(result).to.deep.equal(jsonResult);
    // json:true is forwarded so the instance returns SimpleJson
    expect(queryDefStub.firstCall.args[0].json).to.equal(true);
    expect(stdoutStub.called).to.be.false; // oclif silences log() in json mode
  });

  describe("--query/--file validation", () => {
    // Flag validation must reject before login: a missing/conflicting flag
    // is a pure input mistake and shouldn't cost a network round trip.
    it("rejects with neither --query nor --file, without logging in", async () => {
      const authLoginStub = sinon.stub(AccAuth.prototype, "login");
      const argv = ["--alias", "test"];

      await expect(InstanceQueryDef.run(argv)).to.be.rejectedWith(
        /Exactly one of the following must be provided: --file, --query/,
      );
      expect(authLoginStub.called).to.be.false;
    });

    it("rejects with both --query and --file, without logging in", async () => {
      const authLoginStub = sinon.stub(AccAuth.prototype, "login");
      const argv = [
        "--alias",
        "test",
        "--query",
        QUERY,
        "--file",
        "./query.json",
      ];

      await expect(InstanceQueryDef.run(argv)).to.be.rejectedWith(
        /--file cannot also be provided when using --query/,
      );
      expect(authLoginStub.called).to.be.false;
    });
  });
});
