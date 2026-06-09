// e2e for `acc instance info` against a live instance
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "./helpers.js";

describe(`acc instance info (e2e CLI, alias=${ALIAS})`, function () {
  // DumpCurrentInstanceState is heavy (~7s); allow a generous mocha timeout.
  this.timeout(90000);

  // Run in a throwaway cwd: `instance info` initializes/seeds an acc.config.json
  // in the working directory, which must not land in the repo.
  let cwd;
  before(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-"));
  });
  after(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const acc = (...args) => runAcc(args, { cwd });

  it("exits 0 and prints the diagnostic report on stdout", async () => {
    const { stdout, stderr } = await acc("instance", "info", "--alias", ALIAS);

    // stdout carries the result only (repo's Unix-style output convention)
    expect(stdout).to.contain("✅ reachable"); // TestCnx
    expect(stdout).to.contain("Server time"); // GetServerTime section
    expect(stdout).to.contain("<infos"); // GetCnxInfo
    expect(stdout).to.contain("elemMonitoring"); // DumpCurrentInstanceState

    // diagnostics (login, spinners) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

  it("fails fast with a clear error on an unknown alias", async () => {
    const err = await acc("instance", "info", "--alias", "does-not-exist").then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/alias/i);
  });
});
