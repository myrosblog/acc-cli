// e2e for `acc instance soap` against a live instance: invokes an arbitrary
// SOAP method via the acc-js-sdk NLWS proxy. xtk:session#GetServerTime is a
// static, read-only, no-argument method that exists on every instance, which
// makes a safe, universal probe. Suite docs (how to run, gating): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "./helpers.js";

describe(`acc instance soap (e2e CLI, alias=${ALIAS})`, function () {
  this.timeout(30000);

  // Throwaway cwd: the command seeds an acc.config.json in the working
  // directory, which must not land in the repo.
  let cwd;
  before(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-"));
  });
  after(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const acc = (...args) => runAcc(args, { cwd });

  it("calls a static no-arg method and prints the result on stdout", async () => {
    const { stdout, stderr } = await acc(
      "instance",
      "soap",
      "--alias",
      ALIAS,
      "--schema",
      "xtk:session",
      "--method",
      "GetServerTime",
    );

    // stdout carries the result only: the server time, which contains a year
    expect(stdout.trim()).to.not.be.empty;
    expect(stdout).to.match(/\d{4}/);

    // diagnostics (login, spinner) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

  it("fails fast when the required --method flag is missing", async () => {
    const err = await acc(
      "instance",
      "soap",
      "--alias",
      ALIAS,
      "--schema",
      "xtk:session",
    ).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/method/i);
  });

  it("fails with a clear error when --args is not valid JSON", async () => {
    const err = await acc(
      "instance",
      "soap",
      "--alias",
      ALIAS,
      "--schema",
      "xtk:session",
      "--method",
      "GetServerTime",
      "--args",
      "not-json",
    ).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/args is not valid JSON/i);
  });
});
