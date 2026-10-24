# Tests

## Test pyramid

| Tier        | Folder              | Boundary                             | Owns                                     |
| ----------- | ------------------- | ------------------------------------ | ---------------------------------------- |
| unit        | `test/unit/`        | everything mocked                    | return shapes, error wrapping, branching |
| integration | `test/integration/` | SDK faked with recorded XML fixtures | multi-unit pipelines without a server    |
| **e2e**     | `test/e2e/`         | **live instance**                    | the CLI stack + SOAP calls               |

## E2E tests: end-to-end

These tests run the `acc` binary as a subprocess against a live
running Adobe Campaign instance. They are the only tier that touches an
external system.

### E2E Running

They are **opt-in** and never part of `npm test` (which needs no instance). Start
the target instance and log in first, then run the dedicated script:

```bash
acc auth login --alias local   # make sure the instance is reachable
npm run test:e2e
```

The suite targets the `local` alias by default. Override it to point at any
configured alias (see `acc auth list`):

```bash
ACC_E2E_ALIAS=staging npm run test:e2e
```

### E2E OAuth Server-to-Server credentials

[e2e/auth-init-s2s.spec.js](e2e/auth-init-s2s.spec.js) is the one suite that talks to
**Adobe IMS** rather than to Campaign. Point it at a credential downloaded from
the Developer Console (Credentials → OAuth Server-to-Server → Download JSON) and
it runs `acc auth init --json-file`: an access token is generated,
persisted, and re-used by a second process.

```bash
ACC_E2E_S2S_JSON=~/Downloads/oauth-s2s.json npm run test:e2e
```

- **Opt-in.** Without `ACC_E2E_S2S_JSON` the suite reports as _pending_, so CI
  and contributors without a credential are not affected.
- **Never touches your config.** The suite runs with `AIO_CONFIG_FILE` pointed
  at a `mkdtemp` directory, so the credential it stores (and the temp copy of
  the client secret) is deleted in `after()`, your `~/.config/aio` is untouched.
- **No Campaign logon by default.** The token is generated before the SOAP
  logon, so the suite targets an intentionally unreachable host and asserts on
  the token generation. Set `ACC_E2E_S2S_HOST` to an IMS-enabled instance to
  also assert a logon.
- **`SOP-330023` on the live logon is skipped, not failed.** That fault is
  Campaign's "you don't have the required rights to view the detail" wrapper:
  it masks the actual exception, which is only in the instance's web log
  (`var/<instance>/log/`, or Adobe support for a hosted instance), usually a
  technical account not mapped to an operator. The test checks the IMS token
  generation first, then skips on that code, so a regression in our own token
  path still fails while a provisioning gap on the instance does not. Any other
  logon error fails normally.
- **Secrets.** The stored config holds `CLIENT_SECRETS`, so assertions target
  individual fields (`CLIENT_ID`, `ORG_ID`), never the whole object, which chai
  would print on failure. Command stderr is safe to print: nothing logs the
  secret, and IMS's own reason ("invalid client_id parameter", an expired
  secret, ...) is what you need when a credential is refused.

### E2E Conventions

- **CLI-only.** Each spec drives the `acc` binary via `runAcc()` (see
  [helpers-cli.js](helpers-cli.js)) and asserts on stdout / stderr / exit code. We do
  **not** add a "class layer" that calls `AccInstance*`/`AccAuth`
  directly: running the binary already exercises those classes against the
  server, and typed return shapes belong in the (mocked, fast) unit tests.
- **stdout = result, stderr = diagnostics.** Assert the command result lands on
  stdout and that login/spinner noise stays on stderr (never leaks to stdout).
  `runAcc()` forces `AIO_LOG_LEVEL=info` so even verbose diagnostics are checked.
- **Throwaway cwd.** Commands that seed an `acc.config.json` in the working
  directory (`instance info`, `instance exec`, ...) must run in a
  `fs.mkdtempSync` dir, cleaned up in `after()`, so nothing lands in the repo.
- **Deterministic assertions.** Prefer values that don't depend on the instance
  (e.g. `--script "context.@result = (1+2)*3"` → `result="9"`). When a value
  must come from the server, read it in the test: [e2e/instance-pull.spec.js](e2e/instance-pull.spec.js)
  counts the records with `acc instance queryDef`, compares `check` and `pull` to
  that count, and skips when the count leaves the range of the case (1 or 2 batches).
- **SDK timeout.** The acc-js-sdk times out a SOAP call after 5 s. A spec whose
  call takes longer sets `"acc-js-sdk": { "timeout": 60000 }` in its throwaway
  `acc.config.json`.

### Adding a new E2E

1. Create `test/e2e/<command>.spec.js`, import `{ ALIAS, runAcc }` from
   [helpers-cli.js](helpers-cli.js) (`writeFile` writes a script or query file in
   the throwaway cwd).
2. Add a happy path and, when the command validates an input after login, a
   failure case (non-zero exit, clear error on stderr). Input rejected before
   login (bad flag, unknown alias) goes to
   [integration/fail-fast.spec.js](integration/fail-fast.spec.js).
3. Register it in [e2e/index.js](e2e/index.js).
