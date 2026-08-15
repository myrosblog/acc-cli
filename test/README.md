# Tests

## Test pyramid

| Tier        | Folder              | Boundary                             | Owns                                     |
| ----------- | ------------------- | ------------------------------------ | ---------------------------------------- |
| unit        | `test/unit/`        | everything mocked                    | return shapes, error wrapping, branching |
| integration | `test/integration/` | SDK faked with recorded XML fixtures | multi-unit pipelines without a server    |
| **e2e**     | `test/e2e/`         | **live instance**                    | the real CLI stack + SOAP calls          |

## E2E tests: end-to-end

These tests run the **real `acc` binary** as a subprocess against a **live
running Adobe Campaign instance**. They are the only tier that touches a genuine
external system.

### E2E Running

They are **opt-in** and never part of `npm test` (which stays hermetic). Start
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

[auth-init-s2s.spec.js](auth-init-s2s.spec.js) is the one suite that talks to
**Adobe IMS** rather than to Campaign. Point it at a credential downloaded from
the Developer Console (Credentials → OAuth Server-to-Server → Download JSON) and
it runs `acc auth init --json-file` for real: a genuine access token is minted,
persisted, and re-used by a second process.

```bash
ACC_E2E_S2S_JSON=~/Downloads/oauth-s2s.json npm run test:e2e
```

- **Opt-in.** Without `ACC_E2E_S2S_JSON` the suite reports as _pending_, so CI
  and contributors without a credential stay green.
- **Never touches your config.** The suite runs with `AIO_CONFIG_FILE` pointed
  at a `mkdtemp` directory, so the credential it stores (and the temp copy of
  the client secret) is deleted in `after()` — your `~/.config/aio` is untouched.
- **No Campaign logon by default.** The token is minted before the SOAP logon,
  so the suite targets an unreachable host on purpose and asserts on the mint.
  Set `ACC_E2E_S2S_HOST` to an IMS-enabled instance to also assert a real logon.
- **`SOP-330023` on the live logon is inconclusive, not red.** That fault is
  Campaign's "you don't have the required rights to view the detail" wrapper:
  it masks the real exception, which only exists in the instance's web log
  (`var/<instance>/log/`, or Adobe support for a hosted instance) — usually a
  technical account not mapped to an operator. The test asserts the IMS mint
  first, then skips on that specific code, so a regression in our own token
  path still fails while an instance-side provisioning gap does not. Any other
  logon error fails normally.
- **Secret hygiene.** The stored config holds `CLIENT_SECRETS`, so assertions
  target individual identifier fields (`CLIENT_ID`, `ORG_ID`) — never the whole
  object, which chai would print on failure. Command stderr is safe to echo:
  nothing logs the secret, and IMS's own reason ("invalid client_id parameter",
  an expired secret, ...) is what you need when a credential is refused.

### E2E Conventions

- **CLI-only.** Each spec drives the `acc` binary via `runAcc()` (see
  [helpers.js](helpers.js)) and asserts on stdout / stderr / exit code. We do
  **not** add a "class layer" that calls `CampaignInstance`/`CampaignAuth`
  directly: running the binary already exercises those classes against the
  server, and typed return shapes belong in the (mocked, fast) unit tests.
- **stdout = result, stderr = diagnostics.** Assert the command result lands on
  stdout and that login/spinner noise stays on stderr (never leaks to stdout).
  `runAcc()` forces `AIO_LOG_LEVEL=info` so even verbose diagnostics are checked.
- **Throwaway cwd.** Commands that seed an `acc.config.json` in the working
  directory (`instance info`, `instance exec`, ...) must run in a
  `fs.mkdtempSync` dir, cleaned up in `after()`, so nothing lands in the repo.
- **Deterministic assertions.** Prefer values that don't depend on the instance
  (e.g. `--script "context.@result = (1+2)*3"` → `result="9"`).

### Adding a new E2E

1. Create `test/e2e/<command>.spec.js`, import `{ ALIAS, runAcc }` from
   [helpers.js](helpers.js).
2. Add a happy path + at least one fail-fast assertion (bad flag / unknown
   alias → non-zero exit).
3. Register it in [index.js](index.js).
