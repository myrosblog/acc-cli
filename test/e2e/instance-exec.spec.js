// e2e for `acc instance exec` against a live instance
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "./helpers.js";

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

  it("evaluates a script and prints the result context on stdout", async () => {
    const { stdout, stderr } = await acc(
      "instance",
      "exec",
      "--alias",
      ALIAS,
      "--script",
      "context.@result = (1+2)*3",
    );

    // stdout carries the result only: the echoed context with the computed value
    expect(stdout).to.contain("<context");
    expect(stdout).to.contain('result="9"');

    // diagnostics (login, spinner) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

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
    expect(err.stderr).to.match(/mutually exclusive/i);
  });
});
