// e2e for `acc auth ip`: asks api.db-ip.com for the public IP address of the
// machine. It needs the Internet, but no instance and no credential. Suite docs
// (how to run, gating, conventions): see ../README.md
import { join } from "node:path";
import net from "node:net";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { runAcc } from "../helpers-cli.js";

describe("acc auth ip (e2e CLI, api.db-ip.com)", function () {
  this.timeout(30000);

  // Throwaway cwd and aio config file: the command runs without any alias or
  // credential, and must not read the ones of the developer.
  let cwd;
  before(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-ip-"));
  });
  after(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const acc = (env) =>
    runAcc(["auth", "ip"], {
      cwd,
      env: { AIO_CONFIG_FILE: join(cwd, "aio"), ...env },
    });

  // acc auth ip
  it("prints the public IP address on stdout, without any credential", async () => {
    const { stdout, stderr } = await acc();

    // oclif prints the object returned by the SDK: { ipAddress: '203.0.113.7', ... }
    const ipAddress = stdout.match(/ipAddress: '([^']+)'/)?.[1];
    expect(net.isIP(ipAddress), stdout).to.not.equal(0);
    expect(stdout).to.match(/countryCode: '[A-Z]{2}'/);
    // diagnostics go to stderr, never polluting stdout
    expect(stderr).to.contain("Fetching IP address");
    expect(stdout).to.not.contain("Fetching IP address");
  });

  // The proxy points to a closed local port: nothing leaves the machine
  it("exits non-zero and leaves stdout empty when the network is unreachable", async () => {
    const deadProxy = "http://127.0.0.1:1";
    const err = await acc({
      HTTPS_PROXY: deadProxy,
      https_proxy: deadProxy,
      NO_PROXY: "",
      no_proxy: "",
    }).then(
      () => null,
      (e) => e,
    );

    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.code).to.not.equal(0);
    expect(err.stdout.trim()).to.equal("");
    expect(err.stderr).to.contain("Fetching IP address");
  });
});
