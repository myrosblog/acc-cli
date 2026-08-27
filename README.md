![Downloads](https://img.shields.io/npm/dm/campaign-cli)
![Code Coverage](https://img.shields.io/codecov/c/github/myrosblog/acc-cli)
![License](https://img.shields.io/npm/l/campaign-cli)

# acc, the command line interface for Adobe Campaign developers

Save time, reduce risk, and improve code health with `acc`! This tool helps you develop on your Adobe Campaign Classic instances. It quickly downloads AC v7/v8 configuration: from **schemas, to deliveries, to workflows** and more! You can also use it to automate many common development tasks: **query records in any schema, call soap methods**...

![acc CLI downloading an Adobe Campaign instance](docs/media/acc-pull.gif)

Full documentation available on [Getting started with acc](https://myrosblog.com/adobe-campaign/acc-cli).

## Table of contents

- [Features](#features)
- [Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Usage](#usage)
- [Changelog](#-changelog)
- [Architecture & Security](#-architecture--security)
- [Command reference](#-command-reference)
- [Advanced configuration](#-advanced-configuration)

## Features

- **Authenticate** to your AC instances via username/password, or OAuth Server-to-Sever
- **Extract** configuration (schemas, deliveries, forms...) from AC as local files (HTML, JS, CSS, XML)
- **Version control** these local files with Git to reduce risk when developing/migrating/upgrading
- **Query** records using read-only queryDef operations. For production target analysis & AI assistants
- **Call SOAP** methods on any schema via the NLWS functionality, for any recurring maintenance
- **Use your tools** like VSCode, syntax checks (prettier) and code checkers (eslint)
- **Work anywhere** on any instance: local, staging, production ; and any OS: Windows, macOS, Linux

`acc` addresses the challenge of managing AC configurations with JavaScript development rather than through the AC Client Console.

## 🚀 Quick Start

`acc` is a NodeJS CLI that is based on the official Adobe Campaign JS SDK (`@adobe/acc-js-sdk`). Install and update with npm.

### Installation

Install `acc` globally by running:

```bash
npm install -g campaign-cli
```

### First time authentication

After installation, initialize the authentication to your instance. This creates a local profile identified by an `--alias`.

```bash
acc auth init
# Host (i.e. https://instance1.campaign.adobe.com):
# Authentication method: (OAuth Server-to-Server, User + password)
# Path to the OAuth Server-to-Server JSON (i.e. ~/Downloads/oauth-s2s.json):
# Alias (i.e. staging):
```

Verify your local aliases by listing your instances:

```bash
acc auth list
# | staging | https://instance1.campaign.adobe.com | OAuth Server-to-Server |
```

### Usage

Once authenticated, download the instance configuration:

```bash
acc instance pull --alias staging
# Downloading
# ✔ /Administration/Configuration/Form rendering: xtk:formRendering
# ✔ /Administration/Configuration/Javascript codes: xtk:javascript
# ✔ /Administration/Campaign Management/Typology management/Typology rules: nms:typologyRule
```

It is best to run `acc` commands from a dedicated project directory. When you run a command like `acc instance pull`, the CLI will:

- Look for an `acc.config.json` in the current directory
- If missing, it automatically generates one with `acc instance template`
- Download files following the AC folder hierarchy (e.g., `/Administration/Configuration/Javascript codes/`)

## 📋 Changelog

Read the [acc Changelog](https://myrosblog.com/adobe-campaign/acc-cli/changelog).

## 🔒 Architecture & Security

Read the [acc Architecture & Security](https://myrosblog.com/adobe-campaign/acc-cli/architecture).

## 📖 Command reference

<!-- commands -->

- [`acc auth decode TOKEN`](#acc-auth-decode-token)
- [`acc auth init`](#acc-auth-init)
- [`acc auth ip`](#acc-auth-ip)
- [`acc auth list`](#acc-auth-list)
- [`acc auth login`](#acc-auth-login)
- [`acc config`](#acc-config)
- [`acc config clear`](#acc-config-clear)
- [`acc config delete KEYS`](#acc-config-delete-keys)
- [`acc config edit`](#acc-config-edit)
- [`acc config get KEY`](#acc-config-get-key)
- [`acc config list`](#acc-config-list)
- [`acc config set key 'a value'       # set key to 'a value'`](#acc-config-set-key-a-value--------set-key-to-a-value)
- [`acc info`](#acc-info)
- [`acc instance check`](#acc-instance-check)
- [`acc instance exec`](#acc-instance-exec)
- [`acc instance info`](#acc-instance-info)
- [`acc instance pull`](#acc-instance-pull)
- [`acc instance queryDef`](#acc-instance-querydef)
- [`acc instance soap`](#acc-instance-soap)
- [`acc instance template`](#acc-instance-template)
- [`acc instance watch`](#acc-instance-watch)
- [`acc monitor test`](#acc-monitor-test)
- [`acc report`](#acc-report)
<!-- commandsstop -->

## 🛠️ Local development

```bash
# Clone repository
git clone https://github.com/myrosblog/acc-cli.git && cd acc-cli
npm install
npm test # unit tests & integration tests with XML samples
ACC_E2E_ALIAS=local npm run test:e2e # end-to-end tests against an instance
ACC_E2E_S2S_JSON=~/oauth-s2s.json npm run test:e2e # also exercise a Developer Console credential
```

Coding conventions, project structure and contributor guidelines live in
[`AGENTS.md`](AGENTS.md).

## 📤 Output & logging

`acc` follows the Unix convention so its output is safe to script:

- **stdout** carries the command **result only**, e.g. the XML returned by
  `acc instance exec` or the IP from `acc auth ip, raw and undecorated, so it
  pipes cleanly.
- **stderr** carries everything else: progress spinners, status, warnings and
  errors. Verbosity is controlled by `AIO_LOG_LEVEL` (`info` by default; set
  `AIO_LOG_LEVEL=debug` to troubleshoot).
- A rotating **`acc.log`** under the CLI cache directory keeps the full trace at
  all levels for audit/post-mortem, regardless of the console verbosity. Disable
  it with `ACC_NO_FILE_LOG=1`.

```bash
# Only the result reaches the pipe; diagnostics stay on the terminal (stderr)
acc instance exec --alias staging --script "context.@result = application.instanceName" | xmllint --format -
```

## 🔧 Advanced Configuration

> For OAuth Server-to-Server, download the credential as JSON from the Adobe
> Developer Console (Credentials → OAuth Server-to-Server → Download JSON) and
> give `acc` its path. `acc` then generates and refreshes the IMS access tokens
> for you. Leave the path empty to paste the JSON instead.

> The IMS bearer token is configured in the Adobe Developer Console and is short-lived (typically ~24h).
> Update `acc.auth.instances` via `acc config` when it expires.
> Debugging an IMS token? Check the advanced section to decode it to JSON and inspect its claims.
> When using user/password instances, no change is expected so keep working unchanged.

Read the [Advanced Use Cases documentation](https://myrosblog.com/adobe-campaign/acc-cli/use-cases)

Auth can be fully scripted: `acc auth init --host https://instance.com --user username --pass 's3cret' --alias staging`
(or `--method ImsBearerToken --token '...'` for a hand-pasted IMS token, or
`--method ImsServerToServer --json-file ./oauth-s2s.json` to generate IMS tokens
automatically from the OAuth Server-to-Server credential downloaded from the
Developer Console.
`--json-file` implies that method and keeps the client secret out of your
shell history)

Store the alias in `acc.config.json` (`{"alias": "staging"}`) to use it as default for all `acc` commands.

```bash
# Run a read-only SQL query with queryDef language
# Ideal as a production-safe data tool, including for AI agents.
acc instance queryDef -q '<queryDef schema="xtk:option" operation="get"><select><node expr="@stringValue" /></select></queryDef>'
# --json uses JSON as input + output; --file reads the queryDef from a .json file
acc instance queryDef -q '{schema:"xtk:option", operation:"get", select:{node:[{expr:"@stringValue"}]}}' --json
# -f to read the query from a file
acc instance queryDef -f scripts/queryDef.option.get.json --json
```

```bash
# Call any SOAP method on any schema (uses the acc-js-sdk NLWS proxy). Static methods only.
acc instance soap --schema xtk:session --method GetServerTime
# --args is a JSON array of the method parameters
acc instance soap -s nms:delivery -m HtmlToText --args '["<p>Hi</p>"]'
# --json switches input + output to JSON (best for methods taking/returning XML)
acc instance soap -s nms:delivery -m BuildPreviewFromId -a '[1234, "<params/>"]' --json
```

```bash
# Run server-side JavaScript (xtk:builder#EvaluateJavaScript). Requires admin rights.
# Use `context` to output results.
acc instance exec -s "context.@result = application.instanceName"
acc instance exec -s "context.@result = getOption('NmsEmail_DefaultFromAddr')"
acc instance exec -f ./Administration/Configuration/JavaScript codes/mynamespace/my-script.js
```

```bash
# Diagnostic report: connection test, server time, active connections and
# instance state (xtk:session#TestCnx/#GetServerTime/#GetCnxInfo,
# nl:monitoring#DumpCurrentInstanceState). Best-effort: exits non-zero if any
# probe fails.
acc instance info --alias staging
```

Check any IMS token whether it is expired (base64 → JSON; the signature is **not** verified):

```bash
acc auth decode eyJhbG...
acc auth decode eyJhbG... --json | jq .expiry
```
