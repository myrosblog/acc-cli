# README demo (GIF) — runbook

The animated demo in the top-level `README.md` is generated from
[`acc-pull.tape`](acc-pull.tape) with [vhs](https://github.com/charmbracelet/vhs).
The `.tape` is the source of truth; the `.gif` is a build artifact. Re-render it
whenever the CLI output changes.

## Prerequisites (one-time)

```bash
brew install vhs        # pulls in ttyd + ffmpeg
acc --version           # the build you want to film must be on PATH
```

## Prepare a sanitised target (off-camera)

The GIF must not leak a real hostname or credentials. Configure a demo alias
named **`local`** pointing at your local sandbox _before_ recording — the
`acc auth init` step is deliberately not filmed:

```bash
# Use a non-sensitive host (localhost / LAN sandbox). Password is entered hidden.
acc auth init --host http://localhost:8080 --user admin --alias local
acc auth list   # confirm: alias "local" shows, password redacted
```

> The sandbox must be reachable so `acc instance pull --alias local` returns
> real output. Only generic schema paths are shown — no business data.

## Render

```bash
vhs docs/media/acc-pull.tape    # writes acc-pull.gif
```

Check the result:

- weight max **< 2 MB** (README + npm load fast). If too heavy, lower
  `Set Width/Height/FontSize` or shorten the `Sleep`s in the tape.
- no real hostname, user, or password visible in any frame.
