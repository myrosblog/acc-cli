// e2e for `acc instance template` (no live instance needed)
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { runAcc } from "./helpers.js";

describe("acc instance template (e2e CLI)", function () {
  this.timeout(30000);

  it("prints syntactically valid JSON on stdout (diagnostics on stderr)", async () => {
    const { stdout } = await runAcc(["instance", "template"]);
    expect(
      () => JSON.parse(stdout),
      "stdout must be valid JSON",
    ).to.not.throw();
  });

  // Schema-validity of the template file itself is covered in-process (and far
  // cheaper) by test/unit/CampaignConfig.spec.js, whose init() copies+AJV-validates
  // src/templates/acc.config.json. Here we only assert the *binary* round-trip.
  it("is accepted by the real loader (template > acc.config.json round-trip)", async () => {
    // Reproduce `acc instance template > acc.config.json` in a throwaway cwd,
    // then run a command that loads + validates the config. A bogus alias makes
    // it stop on the alias lookup, after config parse/validation — so any
    // CONFIG_* error would mean the template itself is invalid.
    const cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-tpl-"));
    try {
      const { stdout } = await runAcc(["instance", "template"]);
      fs.writeFileSync(join(cwd, "acc.config.json"), stdout);

      const err = await runAcc(
        ["instance", "info", "--alias", "does-not-exist"],
        { cwd },
      ).then(
        () => null,
        (e) => e,
      );

      expect(err, "expected a non-zero exit on the bogus alias").to.not.be.null;
      expect(err.stderr).to.match(/alias/i); // failed on the alias…
      expect(err.stderr).to.not.match(/CONFIG_(PARSE|VALIDATE)/); // …not the config
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
