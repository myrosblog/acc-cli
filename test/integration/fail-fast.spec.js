// Runs the real binary on commands rejected before any login, so no instance is
// needed. The cwd and the credentials file are throwaway.
import fs from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import { runAcc } from "../helpers-cli.js";

describe("CLI fails fast (real binary, no instance)", function () {
  this.timeout(30000);

  // `instance` commands seed an acc.config.json in the cwd
  let cwd;
  before(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-cli-"));
  });
  after(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  // The credentials file is missing, so no alias resolves
  const acc = (...args) =>
    runAcc(args, {
      cwd,
      env: {
        AIO_CONFIG_FILE: join(cwd, "aio-config.json"),
        ACC_NO_FILE_LOG: "1",
      },
    });

  describe("acc auth login", () => {
    it("fails fast with a clear error on an unknown alias", async () => {
      const err = await acc("auth", "login", "--alias", "does-not-exist").then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.match(/alias/i);
    });

    it("requires the --alias flag", async () => {
      const err = await acc("auth", "login").then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.match(/alias/i);
    });
  });

  describe("acc instance exec", () => {
    it("fails fast when neither --script nor --file is given", async () => {
      const err = await acc("instance", "exec").then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.match(/script/i);
    });

    it("fails fast when --script and --file are combined", async () => {
      const err = await acc(
        "instance",
        "exec",
        "--script",
        "context.@result = 1",
        "--file",
        "whatever.js",
      ).then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      // rejected by the oclif `exactlyOne` flag validation, before any login
      expect(err.stderr).to.match(/cannot also be provided/i);
    });
  });

  describe("acc instance queryDef", () => {
    it("fails fast when neither --query nor --file is given", async () => {
      const err = await acc("instance", "queryDef").then(
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
  });

  describe("acc instance soap", () => {
    it("fails fast when the required --method flag is missing", async () => {
      const err = await acc("instance", "soap", "--schema", "xtk:session").then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.match(/method/i);
    });
  });

  describe("acc instance info", () => {
    it("fails fast with a clear error on an unknown alias", async () => {
      const err = await acc(
        "instance",
        "info",
        "--alias",
        "does-not-exist",
      ).then(
        () => null,
        (e) => e,
      );
      expect(err, "expected a non-zero exit").to.not.be.null;
      expect(err.code).to.not.equal(0);
      expect(err.stderr).to.match(/alias/i);
    });
  });
});
