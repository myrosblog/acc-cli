import { expect } from "chai";
import sinon from "sinon";
import BaseCommand from "../../../src/BaseCommand.js";
import AuthList from "../../../src/commands/auth/list.js";

describe("AuthList", () => {
  afterEach(() => sinon.restore());

  const rows = [
    {
      alias: "prod",
      host: "http://prod",
      user: "admin",
      method: "UserPassword",
    },
    { alias: "staging", host: "http://stg", user: "ops", method: "Unknown" },
  ];

  // Replaces the lazily-built CampaignAuth with a fake exposing list(), so the
  // command never touches the real aio config on disk.
  function stubAuth(listReturn = rows) {
    const fakeAuth = { list: sinon.stub().returns(listReturn) };
    sinon.stub(BaseCommand.prototype, "auth").get(() => fakeAuth);
    return fakeAuth;
  }

  it("should have correct description", () => {
    expect(AuthList.description).to.match(/^Read credentials/);
  });

  it("should enable the built-in json flag", () => {
    expect(AuthList.enableJsonFlag).to.be.true;
  });

  it("should render a table without leaking secrets in human mode", async () => {
    stubAuth();
    const logStub = sinon.stub(AuthList.prototype, "log");

    const result = await AuthList.run([]);

    expect(result).to.deep.equal(rows);
    const output = logStub
      .getCalls()
      .map((c) => c.args[0])
      .join("\n");
    expect(output).to.include("HOST");
    expect(output).to.include("USER");
    expect(output).to.include("METHOD");
    expect(output).to.include("admin");
    expect(output).to.not.include("password");
  });

  it("should return redacted rows in --json mode", async () => {
    stubAuth();
    sinon.stub(AuthList.prototype, "log");
    sinon.stub(AuthList.prototype, "logJson");

    const result = await AuthList.run(["--json"]);

    expect(result).to.deep.equal(rows);
    expect(JSON.stringify(result)).to.not.include("password");
    result.forEach((r) => expect(r).to.not.have.property("password"));
  });

  it("should show a helpful message when no instances are configured", async () => {
    stubAuth([]);
    const logStub = sinon.stub(AuthList.prototype, "log");

    const result = await AuthList.run([]);

    expect(result).to.deep.equal([]);
    expect(logStub.getCall(0).args[0]).to.match(/No instances configured/);
  });
});
