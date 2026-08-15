// e2e for `acc auth init --json-file`, against the real Adobe IMS: it feeds an
// OAuth Server-to-Server credential downloaded from the Developer Console and
// checks an access token comes back. Suite docs (how to run, gating,
// conventions): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect, config as chaiConfig } from "chai";
import { runAcc } from "./helpers.js";

// Path to your own credential file (Developer Console > Credentials > OAuth
// Server-to-Server > Download JSON). Unset => the whole suite is skipped, so
// CI and contributors without a credential are not affected.
const JSON_PATH = process.env.ACC_E2E_S2S_JSON;
// Optional: an IMS-enabled Campaign host. When set, the minted token is also
// used for a real logon; otherwise the suite stops at the IMS round-trip.
const HOST = process.env.ACC_E2E_S2S_HOST;
// Unreachable on purpose. The token is minted and persisted *before* the SOAP
// logon, so an instant ECONNREFUSED separates the IMS exchange from whether
// the instance accepts IMS.
const DEAD_HOST = "http://127.0.0.1:1";
const ALIAS = "e2e-s2s";
const LIVE_ALIAS = "e2e-s2s-live";

describe("acc auth init --json-file (e2e CLI, real IMS)", function () {
  // One IMS call plus a refused connection. 60s is plenty.
  this.timeout(60000);

  let cwd, configFile, credential, truncateThreshold;

  before(function () {
    if (!JSON_PATH) {
      this.skip(); // opt-in, like the rest of the suite
    }
    // When IMS refuses a credential its reason sits deep in a multi-line
    // stderr, which chai would truncate to "…", and that is the part you need.
    // Restored in after() so sibling specs keep the default.
    truncateThreshold = chaiConfig.truncateThreshold;
    chaiConfig.truncateThreshold = 0;
    credential = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
    // `auth init` persists credentials, so this suite gets a throwaway cwd
    // (no acc.config.json in the repo) AND a throwaway aio config file: the
    // developer's real ~/.config/aio must never be written to.
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-s2s-"));
    configFile = join(cwd, "aio");
  });

  after(() => {
    // Deletes the temp copy of the client secret too.
    if (cwd) {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
    if (truncateThreshold !== undefined) {
      chaiConfig.truncateThreshold = truncateThreshold;
    }
  });

  const acc = (...args) =>
    runAcc(args, { cwd, env: { AIO_CONFIG_FILE: configFile } });

  // The aio config file is hjson, so read it back through the bundled config
  // plugin rather than parsing it here. Same env => same isolated file.
  const configGet = async (key) => {
    const { stdout } = await acc("config", "get", key, "--json");
    return stdout.trim() ? JSON.parse(stdout) : undefined;
  };

  // stderr is safe to print on failure: nothing logs the client secret, and at
  // AIO_LOG_LEVEL=info it carries the IMS reason for a refused credential. The
  // config does hold CLIENT_SECRETS, so assert on individual fields there,
  // never on the whole object, which chai would print.

  it("mints a real IMS access token from the Developer Console JSON", async () => {
    const err = await acc(
      "auth",
      "init",
      "--alias",
      ALIAS,
      "--host",
      DEAD_HOST,
      "--method",
      "ImsServerToServer",
      "--json-file",
      JSON_PATH,
    ).then(
      () => null,
      (e) => e,
    );

    // The unreachable host makes the SOAP logon fail, which is expected: the
    // mint before it must have succeeded.
    expect(err, "expected a non-zero exit on the unreachable host").to.not.be
      .null;
    // A credential IMS refuses fails here, and stderr carries its reason
    // ("invalid client_id parameter", expired secret, ...).
    expect(err.stderr, "IMS mint").to.match(/Generated a new IMS access token/);
    expect(err.stderr, "logon against the dead host").to.match(/Login failed/);
  });

  it("stores the credential and caches the token under the alias", async () => {
    const stored = await configGet(`acc.auth.instances.${ALIAS}`);
    expect(stored.authMethod).to.equal("ImsServerToServer");
    expect(stored.host).to.equal(DEAD_HOST);
    // Identifiers only — never assert on (or print) CLIENT_SECRETS.
    expect(stored.json.CLIENT_ID).to.equal(credential.CLIENT_ID);
    expect(stored.json.ORG_ID).to.equal(credential.ORG_ID);
    expect(stored.json.SCOPES).to.deep.equal(credential.SCOPES);
    expect(stored.json.CLIENT_SECRETS).to.have.lengthOf(
      credential.CLIENT_SECRETS.length,
    );

    const cached = await configGet(`acc.auth.imsTokens.${ALIAS}`);
    expect(cached.accessToken, "a token was persisted").to.be.a("string").that
      .is.not.empty;
    expect(cached.expiresAt).to.be.greaterThan(Date.now());
  });

  it("re-uses the cached token in a later process", async () => {
    const err = await acc("auth", "login", "--alias", ALIAS).then(
      () => null,
      (e) => e,
    );

    // Fails on the dead host again, but only after the cache lookup: this is
    // what proves the cross-process reuse that the in-memory IMS cache cannot
    // give a CLI (each invocation is a fresh process).
    expect(err, "expected a non-zero exit on the unreachable host").to.not.be
      .null;
    expect(err.stderr, "token cache hit").to.match(/Re-using IMS access token/);
    expect(err.stderr, "no second mint").to.not.match(
      /Generated a new IMS access token/,
    );
  });

  it("fails fast when the JSON file does not exist", async () => {
    const err = await acc(
      "auth",
      "init",
      "--alias",
      "e2e-s2s-missing",
      "--host",
      DEAD_HOST,
      "--json-file",
      join(cwd, "does-not-exist.json"),
    ).then(
      () => null,
      (e) => e,
    );

    expect(err, "expected a non-zero exit").to.not.be.null;
    expect(err.stderr, "missing file named in the error").to.match(
      /does-not-exist\.json/,
    );
    // Nothing must be persisted when the file cannot be read.
    expect(await configGet("acc.auth.instances.e2e-s2s-missing")).to.be
      .undefined;
  });

  it("logs in to a live IMS-enabled instance (ACC_E2E_S2S_HOST)", async function () {
    if (!HOST) {
      this.skip();
    }
    // Resolve either way: a masked server-side refusal is handled below, so the
    // rejection carries the same { stdout, stderr } shape as a success.
    const result = await acc(
      "auth",
      "init",
      "--alias",
      LIVE_ALIAS,
      "--host",
      HOST,
      "--json-file",
      JSON_PATH,
    ).then(
      (ok) => ok,
      (e) => e,
    );
    const { stdout = "", stderr = "" } = result;

    // Check the mint first, before the SOP-330023 case below: the credential
    // file must still have produced a token. A regression in the --json-file
    // or mint path still fails instead of being hidden by the skip.
    expect(stderr, "IMS mint").to.match(/Generated a new IMS access token/);

    // SOP-330023 is Campaign's "you don't have the required rights to view the
    // detail" wrapper: it caught an exception and masked it. The cause is only
    // in the instance's web log (usually a technical account not mapped to an
    // operator), so the client cannot tell it apart from any other server-side
    // fault, and failing here would point at acc-cli for a server problem.
    // Only this code is skipped: any other logon error still fails.
    if (/SOP-330023/.test(stderr)) {
      console.warn(
        `      ↳ skipped: ${HOST} answered SOP-330023 (masked error). IMS auth\n` +
          `        worked; the cause is in the instance web log (var/<instance>/log/),\n` +
          `        or with Adobe support for a hosted instance.`,
      );
      this.skip();
    }

    // init yields no result: stdout stays empty (diagnostics go to stderr)
    expect(stdout.trim()).to.equal("");
    expect(stderr, "logon").to.match(/Logged in to .+ \(.+ build .+\)/);
  });
});
