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

  // acc instance soap --schema xtk:session --method GetServerTime
  it("calls xtk:session#GetServerTime", async () => {
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
    expect(stdout.trim()).to.not.be.empty;
    expect(stdout).to.match(/\d{4}/); // YYYY
    // diagnostics (login, spinner) go to stderr, never polluting stdout
    expect(stderr).to.contain("Logged in");
    expect(stdout).to.not.contain("Logged in");
  });

  // acc instance soap --schema xtk:session --method GetServerTime --raw
  it("calls xtk:session#GetServerTime --raw", async () => {
    const { stdout } = await acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      "xtk:session",
      "-m",
      "GetServerTime",
      "--raw",
    );
    expect(stdout).to.match(/\d{4}/); // YYYY
    // the envelope keeps the name and the xsi:type of the return value
    expect(stdout).to.contain("GetServerTimeResponse");
    expect(stdout).to.contain("ptmServerTime");
  });

  // acc instance soap -s xtk:builder -m GetDefaultNamespace
  it("calls xtk:builder#GetDefaultNamespace", async () => {
    const { stdout } = await acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      "xtk:builder",
      "-m",
      "GetDefaultNamespace",
    );
    expect(stdout).to.match(/^\w+/); // cus
  });

  // acc instance soap -s xtk:session -m GetDefaultEntity --args '["nms:recipient"]'
  it("calls xtk:session#GetDefaultEntity", async () => {
    const { stdout } = await acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      "xtk:session",
      "-m",
      "GetDefaultEntity",
      "--args",
      '["nms:recipient"]',
    );
    expect(stdout).to.match(/^<recipient/);
    expect(stdout).to.match(/created="\d{4}-\d{2}-\d{2} /);
    expect(stdout).to.contain("</recipient>");
  });

  // acc instance soap -s xtk:session -m GetNewIds --args [5]
  it("calls xtk:session#GetNewIds --args [5]", async () => {
    const { stdout } = await acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      "xtk:session",
      "-m",
      "GetNewIds",
      "--args",
      "[5]",
    );
    const ids = stdout.trim().split(",").map(Number); // 1,2,3,4,5
    expect(ids).to.have.lengthOf(5);
    expect(ids.every(Number.isInteger)).to.be.true;
  });

  // acc instance soap -s xtk:session -m GetOption --args '["Nms_DefaultRcpSchema"]'
  it("calls xtk:session#GetOption --args [Nms_DefaultRcpSchema]", async () => {
    const { stdout } = await acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      "xtk:session",
      "-m",
      "GetOption",
      "--args",
      '["Nms_DefaultRcpSchema"]',
    );
    expect(stdout).to.match(/^[\w:-]+/); // nms:recipient
  });

  // acc instance soap -s nms:delivery -m HtmlToText --args '["<p>Hello</p>"]'
  it("calls nms:delivery#HtmlToText --args ['<p>Hello</p>']", async () => {
    const { stdout } = await acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      "nms:delivery",
      "-m",
      "HtmlToText",
      "--args",
      '["<p>Hello</p>"]',
    );
    expect(stdout).to.match(/^Hello/);
  });
});
