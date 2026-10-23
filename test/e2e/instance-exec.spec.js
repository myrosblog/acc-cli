// e2e for `acc instance exec` against a live instance: evaluates server-side JS
// (xtk:builder#EvaluateJavaScript) and echoes the result context on stdout.
// Suite docs (how to run, gating, conventions): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc, writeFile } from "./helpers.js";

describe(`acc instance exec (e2e CLI, alias=${ALIAS})`, function () {
  this.timeout(30000);

  // Throwaway cwd: `instance exec` initializes/seeds an acc.config.json in the
  // working directory, which must not land in the repo.
  let cwd;
  before(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-"));
  });
  after(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const acc = (...args) => runAcc(args, { cwd });

  it("fails fast when neither --script nor --file is given", async () => {
    const err = await acc("instance", "exec", "--alias", ALIAS).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/script/i);
  });

  it("fails fast when --script and --file are combined", async () => {
    const err = await acc(
      "instance",
      "exec",
      "--alias",
      ALIAS,
      "--script",
      "context.@result = 1",
      "--file",
      "whatever.js",
    ).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    // rejected by the oclif `exactlyOne` flag validation, before any login
    expect(err.stderr).to.match(/cannot also be provided/i);
  });

  // acc instance exec --alias staging --script "context.@result = (1+2)*3"
  it("computes 1+2*3 and prints as attribute", async () => {
    const { stdout, stderr } = await acc(
      "instance",
      "exec",
      "--alias",
      ALIAS,
      "--script",
      "context.@result = (1+2)*3",
    );
    expect(stdout).to.contain("<context");
    expect(stdout).to.contain('result="9"');
    // diagnostics (login, spinner) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

  // acc instance exec --alias staging --script "context.res = application.instanceName"
  it("reads application.instanceName variable", async () => {
    const { stdout } = await acc(
      "instance",
      "exec",
      "-a",
      ALIAS,
      "-s",
      "context.res = application.instanceName",
    );
    expect(stdout).to.contain("<context ");
    expect(stdout).to.match(/<res>[\w-]+<\/res>/); // instance1
  });

  // acc instance exec --alias staging --script "context.res = application.getSchema(nms:recipient).namespace"
  it("reads application.getSchema(nms:recipient)", async () => {
    const { stdout } = await acc(
      "instance",
      "exec",
      "-a",
      ALIAS,
      "-s",
      "context.res = application.getSchema('nms:recipient').namespace",
    );
    expect(stdout).to.contain("<context ");
    expect(stdout).to.contain("<res>nms</res>");
  });

  // acc instance exec -s "context.res = getOption('Nms_DefaultRcpSchema')"
  it("reads getOption(Nms_DefaultRcpSchema)", async () => {
    const { stdout } = await acc(
      "instance",
      "exec",
      "-a",
      ALIAS,
      "-s",
      "context.res = getOption('Nms_DefaultRcpSchema')",
    );
    expect(stdout).to.contain("<context ");
    expect(stdout).to.match(/<res>[\w:-]+<\/res>/); // nms:recipient
  });

  // acc instance exec -s "const N = 5;var s = '';for(var i=0;i<N;i++){s+=i;}context.res = s"
  it("computes statements with for-loop, const, var", async () => {
    const { stdout } = await acc(
      "instance",
      "exec",
      "-a",
      ALIAS,
      "-s",
      "const N = 5;var s = '';for(var i=0;i<N;i++){s+=i;}context.res = s",
    );
    expect(stdout).to.contain("<context ");
    expect(stdout).to.contain("<res>01234</res>");
  });

  // acc instance exec -f getOption.js
  const GET_OPTION_SCRIPT = `context.res = getOption('Nms_DefaultRcpSchema')`;
  it("reads --file getOption.js", async () => {
    const file = writeFile(cwd, "get-option.js", GET_OPTION_SCRIPT);
    const { stdout } = await acc("instance", "exec", "-a", ALIAS, "-f", file);
    expect(stdout).to.contain("<context ");
    expect(stdout).to.match(/<res>[\w:-]+<\/res>/); // nms:recipient
  });

  // acc instance exec -s "const N = 5;var s = '';for(var i=0;i<N;i++){s+=i;}context.res = s"
  const FOR_LOOP_SCRIPT = `const N = 5;var s = "";for(var i=0;i<N;i++){s+=i;}context.res = s`;
  it("computes statements -f for-loop.js", async () => {
    const file = writeFile(cwd, "for-loop.js", FOR_LOOP_SCRIPT);
    const { stdout } = await acc("instance", "exec", "-a", ALIAS, "-f", file);
    expect(stdout).to.contain("<context ");
    expect(stdout).to.contain("<res>01234</res>");
  });
});
