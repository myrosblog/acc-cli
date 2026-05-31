import { expect } from "chai";
import sinon from "sinon";
import InstanceCommand from "../../src/InstanceCommand.js";
import { codes } from "../../src/helpers/AccErrors.js";

const { INSTANCE_ALIAS_UNRESOLVED } = codes;

describe("InstanceCommand", () => {
  let cmd;
  let loginStub;

  const makeCmd = (configAlias) => {
    const cmd = new InstanceCommand([], {});
    loginStub = sinon.stub().resolves({ NLWS: {} });
    cmd._auth = { login: loginStub };
    sinon.stub(cmd, "makeConfig").returns({
      init: sinon.stub(),
      alias: configAlias,
      accJsSdkOptions: {},
    });
    sinon.stub(cmd, "spinner").returns({});
    return cmd;
  };

  afterEach(() => sinon.restore());

  it("should have an optional alias flag", () => {
    expect(InstanceCommand.baseFlags.alias.required).to.not.be.true;
  });

  it("should use the --alias flag when provided", async () => {
    cmd = makeCmd("fromConfig");
    await cmd.getInstance({ config: "acc.config.json", alias: "fromFlag" });
    expect(loginStub.firstCall.args[0].alias).to.equal("fromFlag");
  });

  it("should fall back to the config alias when no flag", async () => {
    cmd = makeCmd("fromConfig");
    await cmd.getInstance({ config: "acc.config.json" });
    expect(loginStub.firstCall.args[0].alias).to.equal("fromConfig");
  });

  it("should throw INSTANCE_ALIAS_UNRESOLVED when neither is set", async () => {
    cmd = makeCmd(undefined);
    await expect(
      cmd.getInstance({ config: "acc.config.json" }),
    ).to.be.rejectedWith(INSTANCE_ALIAS_UNRESOLVED);
    expect(loginStub.called).to.be.false;
  });
});
