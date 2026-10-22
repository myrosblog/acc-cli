import { expect } from "chai";
import sinon from "sinon";
import InstanceCommand from "../../src/InstanceCommand.js";
import AccInstance from "../../src/services/instance/AccInstance.js";
import { codes } from "../../src/helpers/AccErrors.js";

const { INSTANCE_ALIAS_UNRESOLVED } = codes;

describe("InstanceCommand", () => {
  let cmd;
  let loginStub;

  let initStub;

  const makeCmd = (configAlias, currentAlias) => {
    const cmd = new InstanceCommand([], {});
    loginStub = sinon.stub().resolves({ NLWS: {} });
    initStub = sinon.stub();
    cmd._auth = { login: loginStub, currentAlias };
    sinon.stub(cmd, "makeConfig").returns({
      init: initStub,
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

  it("should have short flags -a, -p and -c", () => {
    expect(InstanceCommand.baseFlags.alias.char).to.equal("a");
    expect(InstanceCommand.baseFlags.path.char).to.equal("p");
    expect(InstanceCommand.baseFlags.config.char).to.equal("c");
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

  it("should pass the flag alias to config init, to seed a new config", async () => {
    cmd = makeCmd(undefined);
    await cmd.getInstance({ config: "acc.config.json", alias: "fromFlag" });
    expect(initStub.calledOnceWith("acc.config.json", "fromFlag")).to.be.true;
  });

  it("should not pass an alias to config init when no flag and no last auth init alias", async () => {
    cmd = makeCmd("fromConfig");
    await cmd.getInstance({ config: "acc.config.json" });
    expect(initStub.calledOnceWith("acc.config.json", undefined)).to.be.true;
  });

  it("should pass the last auth init alias to config init when no flag alias is given", async () => {
    cmd = makeCmd("fromLastInit", "fromLastInit");
    await cmd.getInstance({ config: "acc.config.json" });
    expect(initStub.calledOnceWith("acc.config.json", "fromLastInit")).to.be
      .true;
    expect(loginStub.firstCall.args[0].alias).to.equal("fromLastInit");
  });

  it("should prefer the --alias flag over the last auth init alias", async () => {
    cmd = makeCmd("fromFlag", "fromLastInit");
    await cmd.getInstance({ config: "acc.config.json", alias: "fromFlag" });
    expect(initStub.calledOnceWith("acc.config.json", "fromFlag")).to.be.true;
  });

  it("should keep the config alias over the last auth init alias", async () => {
    // acc.config.json already exists: the seed is ignored by config.init
    cmd = makeCmd("fromConfig", "fromLastInit");
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

  it("connect should return the logged-in client, the config and the flags with the resolved alias", async () => {
    cmd = makeCmd("fromConfig");
    const { client, config, flags } = await cmd.connect({
      config: "acc.config.json",
      path: "/some/path",
    });
    expect(client).to.deep.equal({ NLWS: {} });
    expect(config.alias).to.equal("fromConfig");
    expect(flags).to.deep.equal({
      config: "acc.config.json",
      path: "/some/path",
      alias: "fromConfig",
    });
  });

  it("connect should merge the sdk options override over the config ones at login", async () => {
    cmd = makeCmd("fromConfig");
    cmd.makeConfig.returns({
      init: initStub,
      alias: "fromConfig",
      accJsSdkOptions: { timeout: 5000, traceAPICalls: true },
    });
    await cmd.connect({ config: "acc.config.json" }, { timeout: 60000 });
    expect(loginStub.firstCall.args[1]).to.deep.equal({
      timeout: 60000,
      traceAPICalls: true,
    });
  });

  it("createSpinner should give the services a factory bound to the command", () => {
    cmd = makeCmd("fromConfig");
    cmd.spinner.returns("spinner");
    expect(cmd.createSpinner("Pulling")).to.equal("spinner");
    expect(cmd.spinner.calledOnceWith("Pulling")).to.be.true;
  });

  it("getInstance should build the AccInstance from the connection", async () => {
    cmd = makeCmd("fromConfig");
    const instance = await cmd.getInstance({
      config: "acc.config.json",
      path: "/some/path",
    });
    expect(instance).to.be.instanceOf(AccInstance);
    expect(instance.client).to.deep.equal({ NLWS: {} });
    expect(instance.accConfig.alias).to.equal("fromConfig");
    expect(instance.downloadPath).to.equal("/some/path");
    // the spinner factory is the command's
    cmd.spinner.returns("spinner");
    expect(instance.createSpinner("Pulling")).to.equal("spinner");
  });
});
