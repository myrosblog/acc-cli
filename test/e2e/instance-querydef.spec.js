// e2e for `acc instance queryDef` against a live instance, on xtk:option, present
// on every instance.
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc, writeFile } from "../helpers-cli.js";

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

  it("fails with a non-zero exit on a schema not found", async () => {
    const err = await acc(
      "instance",
      "queryDef",
      "-a",
      ALIAS,
      "-q",
      '<queryDef schema="xtk:accE2eNotFound" operation="select">' +
        '<select><node expr="@name"/></select></queryDef>',
    ).then(
      () => null,
      (e) => e,
    );
    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    // The query is built locally, the server rejects the schema on execute
    expect(err.stderr).to.contain("INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED");
    // The SOAP fault detail names the schema (XFR-180000)
    expect(err.stderr).to.contain(
      "Unable to load the document of identifier 'xtk:accE2eNotFound'",
    );
    expect(err.stdout).to.equal("");
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

  // acc instance queryDef -q '<queryDef schema="xtk:javascript"'
  it("selects an xtk:javascript not found (empty collection)", async () => {
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "-a",
      ALIAS,
      "-q",
      '<queryDef schema="xtk:javascript" operation="select">' +
        '<select><node expr="@name"/></select>' +
        "<where><condition expr=\"@name = 'acc-e2e-not-found.js'\"/></where>" +
        "</queryDef>",
    );
    // No match is a success with an empty collection, not an error
    expect(stdout).to.match(/^<javascript-collection[^>]*\/>/);
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
