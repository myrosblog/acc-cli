// e2e for `acc auth login` against a live instance.
import { expect } from "chai";
import { ALIAS, runAcc } from "./helpers.js";

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

  it("fails fast with a clear error on an unknown alias", async () => {
    const err = await runAcc([
      "auth",
      "login",
      "--alias",
      "does-not-exist",
    ]).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/alias/i);
  });

  it("requires the --alias flag", async () => {
    const err = await runAcc(["auth", "login"]).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/alias/i);
  });
});
