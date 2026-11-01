// e2e for `acc auth login` against a live instance. Suite docs (how to run,
// gating, conventions): see ./README.md
import { expect } from "chai";
import { ALIAS, runAcc } from "../helpers-cli.js";

describe(`acc auth login (e2e CLI, alias=${ALIAS})`, function () {
  this.timeout(30000);

  it("exits 0 and reports the login on stderr, with empty stdout", async () => {
    const { stdout, stderr } = await runAcc([
      "auth",
      "login",
      "--alias",
      ALIAS,
    ]);

    // login yields no result: stdout stays empty (diagnostics go to stderr)
    expect(stdout.trim()).to.equal("");
    expect(stderr).to.match(/Logged in to .+ \(.+ build .+\)/);
  });
});
