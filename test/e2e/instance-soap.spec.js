// e2e for `acc instance soap` against a live instance, on static read-only
// methods grouped by schema.
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "../helpers-cli.js";

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

  /**
   * Calls a static method of a schema, with optional JSON arguments.
   * @param {string} schema - schema id, e.g. "xtk:session"
   * @param {string} method - method name
   * @param {Array} [args] - positional arguments, serialized to --args
   * @param {...string} flags - extra flags, e.g. "--raw"
   * @returns {Promise<{stdout: string, stderr: string}>} the command output
   */
  const soap = (schema, method, args, ...flags) =>
    acc(
      "instance",
      "soap",
      "-a",
      ALIAS,
      "-s",
      schema,
      "-m",
      method,
      ...(args ? ["--args", JSON.stringify(args)] : []),
      ...flags,
    );

  describe("errors", () => {
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

    it("fails with a clear error on a schema not found", async () => {
      const err = await soap("xtk:accE2eNotFound", "GetServerTime").then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.contain("INSTANCE_SOAP_SDK_CALL_FAILED");
      expect(err.stderr).to.contain("schema 'xtk:accE2eNotFound'");
      expect(err.stdout).to.equal("");
    });

    it("fails with a clear error on a method not found", async () => {
      const err = await soap("xtk:session", "AccE2eNotFound").then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.contain(
        "Unknown method 'AccE2eNotFound' of schema 'xtk:session'",
      );
      expect(err.stdout).to.equal("");
    });
  });

  describe("xtk:session", () => {
    // acc instance soap --schema xtk:session --method GetServerTime
    it("calls GetServerTime", async () => {
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

    // acc instance soap -s xtk:session -m GetServerTime --raw
    it("calls GetServerTime --raw", async () => {
      const { stdout } = await soap(
        "xtk:session",
        "GetServerTime",
        undefined,
        "--raw",
      );
      expect(stdout).to.match(/\d{4}/); // YYYY
      // the envelope keeps the name and the xsi:type of the return value
      expect(stdout).to.contain("GetServerTimeResponse");
      expect(stdout).to.contain("ptmServerTime");
    });

    // acc instance soap -s xtk:session -m TestCnx
    it("calls TestCnx (no return value)", async () => {
      const { stdout } = await soap("xtk:session", "TestCnx");
      expect(stdout.trim()).to.equal("");
    });

    // acc instance soap -s xtk:session -m GetDefaultEntity --args '["nms:recipient"]'
    it("calls GetDefaultEntity", async () => {
      const { stdout } = await soap("xtk:session", "GetDefaultEntity", [
        "nms:recipient",
      ]);
      expect(stdout).to.match(/^<recipient/);
      expect(stdout).to.match(/created="\d{4}-\d{2}-\d{2} /);
      expect(stdout).to.contain("</recipient>");
    });

    // acc instance soap -s xtk:session -m GetNewIds --args [5]
    it("calls GetNewIds --args [5]", async () => {
      const { stdout } = await soap("xtk:session", "GetNewIds", [5]);
      const ids = stdout.trim().split(",").map(Number); // 1,2,3,4,5
      expect(ids).to.have.lengthOf(5);
      expect(ids.every(Number.isInteger)).to.be.true;
    });

    // acc instance soap -s xtk:session -m GetNewIdsEx --args '[3, "xtkNewId"]'
    it("calls GetNewIdsEx --args [3, xtkNewId]", async () => {
      const { stdout } = await soap("xtk:session", "GetNewIdsEx", [
        3,
        "xtkNewId",
      ]);
      const ids = stdout.trim().split(",").map(Number); // 4210,4211,4212
      expect(ids).to.have.lengthOf(3);
      expect(ids.every(Number.isInteger)).to.be.true;
    });

    // acc instance soap -s xtk:session -m GetOption --args '["Nms_DefaultRcpSchema"]'
    it("calls GetOption --args [Nms_DefaultRcpSchema]", async () => {
      const { stdout } = await soap("xtk:session", "GetOption", [
        "Nms_DefaultRcpSchema",
      ]);
      expect(stdout).to.match(/^[\w:-]+/); // nms:recipient
    });

    // acc instance soap -s xtk:session -m GetOption --args '["acc_e2e_not_found"]'
    it("calls GetOption on an option not found", async () => {
      const { stdout } = await soap("xtk:session", "GetOption", [
        "acc_e2e_not_found",
      ]);
      // GetOption returns [value, type], one per line: an empty value, type 0
      expect(stdout.trimEnd().split("\n")).to.deep.equal(["", "0"]);
    });

    // acc instance soap -s xtk:session -m GetUserInfo
    it("calls GetUserInfo", async () => {
      const { stdout } = await soap("xtk:session", "GetUserInfo");
      expect(stdout).to.match(/^<userInfo/);
      expect(stdout).to.match(/ login="[^"]+"/);
    });

    // acc instance soap -s xtk:session -m GetCnxInfo
    it("calls GetCnxInfo", async () => {
      const { stdout } = await soap("xtk:session", "GetCnxInfo");
      // The session of this call is one of the connections
      expect(stdout).to.match(/^<infos/);
      expect(stdout).to.contain("<cnx ");
    });
  });

  describe("xtk:builder", () => {
    // acc instance soap -s xtk:builder -m GetDefaultNamespace
    it("calls GetDefaultNamespace", async () => {
      const { stdout } = await soap("xtk:builder", "GetDefaultNamespace");
      expect(stdout).to.match(/^\w+/); // cus
    });

    // acc instance soap -s xtk:builder -m CheckTableExists --args '["default", "XtkOption"]'
    it("calls CheckTableExists on an existing table", async () => {
      const { stdout } = await soap("xtk:builder", "CheckTableExists", [
        "default",
        "XtkOption",
      ]);
      expect(stdout.trim()).to.equal("true");
    });

    // acc instance soap -s xtk:builder -m CheckTableExists --args '["default", "AccE2eNotFound"]'
    it("calls CheckTableExists on a table not found", async () => {
      const { stdout } = await soap("xtk:builder", "CheckTableExists", [
        "default",
        "AccE2eNotFound",
      ]);
      expect(stdout.trim()).to.equal("false");
    });
  });

  describe("xtk:queryDef", () => {
    // acc instance soap -s xtk:queryDef -m EvaluateExpr --args '["1+1"]'
    it("calls EvaluateExpr --args [1+1]", async () => {
      const { stdout } = await soap("xtk:queryDef", "EvaluateExpr", ["1+1"]);
      expect(stdout.trim()).to.equal("2");
    });
  });

  describe("xtk:persist", () => {
    // acc instance soap -s xtk:persist -m GetEntityIfMoreRecent --args '["xtk:option|XtkDatabaseId", "", false]'
    it("calls GetEntityIfMoreRecent on an xtk:option", async () => {
      // An empty md5 never matches, so the entity is always returned
      const { stdout } = await soap("xtk:persist", "GetEntityIfMoreRecent", [
        "xtk:option|XtkDatabaseId",
        "",
        false,
      ]);
      expect(stdout).to.match(/^<option/);
      expect(stdout).to.contain('name="XtkDatabaseId"');
    });

    // acc instance soap -s xtk:persist -m GetActiveApplicationMenus
    it("calls GetActiveApplicationMenus", async () => {
      const { stdout } = await soap("xtk:persist", "GetActiveApplicationMenus");
      expect(stdout).to.match(/^<app/);
    });
  });


  describe("nms:delivery", () => {
    // acc instance soap -s nms:delivery -m HtmlToText --args '["<p>Hello</p>"]'
    it("calls HtmlToText --args ['<p>Hello</p>']", async () => {
      const { stdout } = await soap("nms:delivery", "HtmlToText", [
        "<p>Hello</p>",
      ]);
      expect(stdout).to.match(/^Hello/);
    });
  });
});
