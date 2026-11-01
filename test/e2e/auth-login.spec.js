// e2e for `acc auth login` against a live instance. Suite docs (how to run,
// gating, conventions): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "../helpers-cli.js";

describe(`acc auth login (e2e CLI, alias=${ALIAS})`, function () {
  this.timeout(30000);

  // Throwaway cwd: login reads ./acc.config.json, so the repo's must not apply
  let cwd;
  beforeEach(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-"));
  });
  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("with --alias flag", async () => {
    const { stdout, stderr } = await runAcc(
      ["auth", "login", "--alias", ALIAS],
      { cwd },
    );

    // login yields no result: stdout stays empty (diagnostics go to stderr)
    expect(stdout.trim()).to.equal("");
    expect(stderr).to.match(/Logged in to .+ \(.+ build .+\)/);
    // a login without project config must not create one
    expect(fs.readdirSync(cwd)).to.be.empty;
  });
});
