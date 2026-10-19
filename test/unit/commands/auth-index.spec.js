import { expect } from "chai";
import sinon from "sinon";
import { Help } from "@oclif/core";
import Auth from "../../../src/commands/auth/index.js";
import { useCommandLogger, useMissingCredentialsFile } from "../../helpers.js";

describe("Auth", () => {
  afterEach(() => sinon.restore());

  it("should list its subcommands", async () => {
    useMissingCredentialsFile();
    useCommandLogger();
    const showHelpStub = sinon.stub(Help.prototype, "showHelp").resolves();
    await Auth.run([]);
    expect(showHelpStub).to.have.been.calledOnceWithExactly(["auth"]);
  });

  it("should be hidden, as the root help already lists the auth topic", () => {
    expect(Auth.hidden).to.equal(true);
  });

  it("should log where the credentials file is on this machine", async () => {
    const credentialsFile = useMissingCredentialsFile();
    const logger = useCommandLogger();
    sinon.stub(Help.prototype, "showHelp").resolves();
    await Auth.run([]);
    expect(logger.info).to.have.been.calledOnceWithExactly(
      `🔑 Reading authentication from ${credentialsFile}`,
    );
  });
});
