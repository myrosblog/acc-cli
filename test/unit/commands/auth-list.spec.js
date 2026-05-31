import { expect } from "chai";
import sinon from "sinon";
import { Config } from "@oclif/core";
import AuthList from "../../../src/commands/auth/list.js";
import { AUTH_INSTANCES_KEY } from "../../../src/CampaignAuth.js";

describe("AuthList", () => {
  afterEach(() => sinon.restore());

  it("should have correct description", () => {
    expect(AuthList.description).to.equal(
      "List configured Adobe Campaign instances",
    );
  });

  it("should have json and yaml flags", () => {
    expect(AuthList.flags.json.char).to.equal("j");
    expect(AuthList.flags.yaml.char).to.equal("y");
  });

  it("should delegate to config:get on the instances key", async () => {
    const runCommandStub = sinon
      .stub(Config.prototype, "runCommand")
      .resolves();
    const result = await AuthList.run([]);
    expect(result).to.be.undefined;
    expect(runCommandStub.calledOnce).to.be.true;
    expect(runCommandStub.firstCall.args[0]).to.equal("config:get");
    expect(runCommandStub.firstCall.args[1]).to.deep.equal([AUTH_INSTANCES_KEY]);
  });

  it("should forward the --json flag", async () => {
    const runCommandStub = sinon
      .stub(Config.prototype, "runCommand")
      .resolves();
    await AuthList.run(["--json"]);
    expect(runCommandStub.firstCall.args[1]).to.deep.equal([
      AUTH_INSTANCES_KEY,
      "--json",
    ]);
  });
});
