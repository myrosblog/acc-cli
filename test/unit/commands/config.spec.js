import { expect } from "chai";
import sinon from "sinon";
import { Help } from "@oclif/core";
import Config from "../../../src/commands/config/index.js";

describe("Config", () => {
  afterEach(() => sinon.restore());

  it("should show the help instead of listing the stored values", async () => {
    const showHelpStub = sinon.stub(Help.prototype, "showHelp").resolves();
    await Config.run([]);
    expect(showHelpStub).to.have.been.calledOnceWithExactly(["config"]);
  });

  it("should say it is not acc.config.json and point to acc auth", () => {
    expect(Config.description).to.include("not the project acc.config.json");
    expect(Config.description).to.include("`acc auth`");
  });

  it("should not inherit the flags of the aio list command", () => {
    expect(Config.flags).to.be.undefined;
  });
});
