// e2e for `acc instance queryDef` against a live instance: runs a read-only
// query (xtk:queryDef#ExecuteQuery) and echoes the result collection on stdout.
// xtk:option exists on every instance, which makes a safe, universal probe.
// Suite docs (how to run, gating): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "./helpers.js";

describe(`acc instance queryDef (e2e CLI, alias=${ALIAS})`, function () {
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

  // Default (human) mode takes an XML queryDef and returns XML.
  const OPTION_QUERY_XML =
    '<queryDef schema="xtk:option" operation="select" lineCount="1">' +
    '<select><node expr="@name"/></select></queryDef>';
  // --json mode takes a JSON queryDef and returns JSON.
  const OPTION_QUERY_JSON = JSON.stringify({
    schema: "xtk:option",
    operation: "select",
    select: { node: [{ expr: "@name" }] },
    lineCount: 1,
  });

  it("runs a read-only query and prints the XML collection on stdout", async () => {
    const { stdout, stderr } = await acc(
      "instance",
      "queryDef",
      "--alias",
      ALIAS,
      "--query",
      OPTION_QUERY_XML,
    );

    // stdout carries the result only: a collection of <option> rows
    expect(stdout).to.contain("<option");

    // diagnostics (login, spinner) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

  it("emits machine-readable JSON with --json (JSON queryDef in)", async () => {
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "--alias",
      ALIAS,
      "--query",
      OPTION_QUERY_JSON,
      "--json",
    );
    expect(
      () => JSON.parse(stdout),
      `stdout was not JSON: ${stdout}`,
    ).to.not.throw();
  });

  it("fails fast when neither --query nor --file is given", async () => {
    const err = await acc("instance", "queryDef", "--alias", ALIAS).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/no query provided/i);
  });

  it("fails with a non-zero exit on a malformed queryDef", async () => {
    const err = await acc(
      "instance",
      "queryDef",
      "--alias",
      ALIAS,
      "--query",
      "<not a valid queryDef",
    ).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stderr).to.match(/queryDef failed/i);
  });
});
