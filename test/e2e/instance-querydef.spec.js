// e2e for `acc instance queryDef` against a live instance: runs a read-only
// query (xtk:queryDef#ExecuteQuery) and echoes the result collection on stdout.
// xtk:option exists on every instance, which makes a safe, universal probe.
// Suite docs (how to run, gating): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc, writeFile } from "./helpers.js";

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

  it("fails fast when neither --query nor --file is given", async () => {
    const err = await acc("instance", "queryDef", "--alias", ALIAS).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    // rejected by the oclif `exactlyOne` flag validation, before any login
    expect(err.stderr).to.match(
      /exactly one of the following must be provided/i,
    );
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

  // acc instance queryDef -q '<queryDef'
  const OPTION_QUERY_XML =
    '<queryDef schema="xtk:option" operation="select" lineCount="1">' +
    '<select><node expr="@name"/></select></queryDef>';
  it("selects 1 xtk:option", async () => {
    const { stdout, stderr } = await acc(
      "instance",
      "queryDef",
      "--alias",
      ALIAS,
      "--query",
      OPTION_QUERY_XML,
    );
    expect(stdout).to.match(/^<option/);
    // diagnostics (login, spinner) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

  // acc instance queryDef -q '{}' --json
  const OPTION_QUERY_JSON = JSON.stringify({
    schema: "xtk:option",
    operation: "select",
    select: { node: [{ expr: "@name" }] },
    lineCount: 1,
  });
  it("selects 1 xtk:option --json", async () => {
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "-a",
      ALIAS,
      "-q",
      OPTION_QUERY_JSON,
      "--json",
    );
    expect(
      () => JSON.parse(stdout),
      `stdout was not JSON: ${stdout}`,
    ).to.not.throw();
  });

  // acc instance queryDef -q ''
  const OPTION_GET_XML = `<queryDef schema="xtk:option" operation="get"><select><node expr="@stringValue" /></select></queryDef>`;
  it("gets an xtk:option", async () => {
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "-a",
      ALIAS,
      "-q",
      OPTION_GET_XML,
    );
    expect(stdout).to.match(/^<option/);
    expect(stdout).to.match(/stringValue="[^"]+"/);
  });

  // acc instance queryDef --file query.xml
  it("selects 1 xtk:option from --file (XML)", async () => {
    const file = writeFile(cwd, "query.xml", OPTION_QUERY_XML);
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "-a",
      ALIAS,
      "--file",
      file,
    );
    expect(stdout).to.match(/^<option/);
  });

  // acc instance queryDef --file query.json
  it("selects 1 xtk:option from -f (JSON)", async () => {
    const file = writeFile(cwd, "query.json", OPTION_QUERY_JSON);
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "-a",
      ALIAS,
      "-f",
      file,
      "--json",
    );
    expect(stdout).to.match(/^{\s*"option":\s*\[/);
  });
});
