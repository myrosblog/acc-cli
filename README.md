![Downloads](https://img.shields.io/npm/dm/campaign-cli)
![Code Coverage](https://img.shields.io/codecov/c/github/myrosblog/acc-cli)
![License](https://img.shields.io/npm/l/campaign-cli)

# acc, the command line interface for Adobe Campaign developers

Save time, reduce risk, and improve code health with `acc`! This CLI tool helps you build on your Adobe Campaign Classic instances. It quickly downloads Adobe Campaign v7 **configuration, campaigns and online resources**. You can also use it to automate many common development tasks.

Full documentation available on [Getting started with acc](https://myrosblog.com/adobe-campaign/acc-cli?utm_campaign=readme)

![acc CLI downloading an Adobe Campaign instance](docs/media/acc-pull.gif)

## Table of contents

- [Features](#features)
- [Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Advanced Configuration](#-advanced-configuration)
- [Command reference](#-command-reference)
- [Roadmap](#️-roadmap)
- [Architecture & Security](#-architecture--security)
- [Changelog](#-changelog)
- [Contributing](#-contributing)

## Features

- Download all Marketing content: Campaigns, Deliveries, Web apps, and more!
- Download all Technical content: Data schemas, Javascript codes & pages, Workflows and more!
- Replace manual exports with scriptable, auditable, and repeatable operations
- Decompose sources into codes (JS, HTML, CSS) and metadata (fields @created, @lastModified…)
- Allow local code checkers, highlighters and linters
- Work on any instance: local, staging, production ; and any OS: Windows, macOS, Linux

## 🚀 Quick Start

### Installation

```bash
npm install -g campaign-cli
```

### Usage

First time authentication:

```bash
# Interactive: prompts for any missing value; the password / IMS token is
# entered hidden (never stored in your shell history or visible in the
# process list).
acc auth init
# Host (i.e. https://instance1.campaign.adobe.com):
# Authentication method: (User / password | IMS bearer token)
# Username:
# Password:
# Alias (i.e. staging):
```

Campaign 8.5+ instances migrating to [IMS](https://experienceleague.adobe.com/en/docs/campaign-classic/using/technotes/ims/ims-migration)
authenticate with an IMS bearer token instead of a password:

```bash
acc auth init --method ImsBearerToken --host https://instance.campaign.adobe.com --token "$IMS_BEARER_TOKEN" --alias prod
```

> The IMS bearer token is stored as-is and is short-lived (typically ~24h).
> Re-run `acc auth init` (or update `acc.auth.instances` via `acc config`) when
> it expires. Existing user/password instances keep working unchanged.

Then, recurring pulls:

```bash
acc instance pull --alias staging
# Downloading
# ✔ /Administration/Configuration/Form rendering: xtk:formRendering
# ✔ /Administration/Configuration/Javascript codes: xtk:javascript
# ✔ /Administration/Campaign Management/Typology management/Typology rules: nms:typologyRule
```

### 🔧 Advanced Configuration

Read the [Advanced Use Cases documentation](https://myrosblog.com/adobe-campaign/acc-cli-use-cases?utm_campaign=readme)

Auth can be fully scripted: `acc auth init --host https://instance.com --user username --pass 's3cret' --alias staging`
(or `--method ImsBearerToken --token '...'` for IMS instances)

```bash
# Run server-side JavaScript (xtk:builder#EvaluateJavaScript)
acc instance exec --alias staging --script "context.@result = application.instanceName"
acc instance exec --alias staging --script "context.@result = getOption('NmsEmail_DefaultFromAddr')"
acc instance exec --alias staging --file ./Administration/Configuration/JavaScript codes/mynamespace/my-script.js
```

```bash
# Diagnostic report: connection test, server time, active connections and
# instance state (xtk:session#TestCnx/#GetServerTime/#GetCnxInfo,
# nl:monitoring#DumpCurrentInstanceState). Best-effort: exits non-zero if any
# probe fails.
acc instance info --alias staging
```

## 📖 Command reference

The full command reference (every command, flag and example) lives in the
[acc Reference](https://myrosblog.com/adobe-campaign/acc-cli?utm_campaign=readme).
You can also run `acc --help` or `acc <topic> --help` for inline help.

## 🗓️ Roadmap

Read the [acc Roadmap](https://myrosblog.com/adobe-campaign/acc-cli-roadmap?utm_campaign=readme).

## 🔒 Architecture & Security

Read the [acc Architecture & Security](https://myrosblog.com/adobe-campaign/acc-cli-architecture?utm_campaign=readme).

## 📋 Changelog

Read the [acc Changelog](https://myrosblog.com/adobe-campaign/acc-cli-changelog?utm_campaign=readme).

## 🤝 Contributing

Contributions are welcome! Please open a Github Pull Request!

### 🛠️ Local development

```bash
# Clone repository
git clone https://github.com/myrosblog/acc-cli.git && cd acc-cli
npm install
npm test # unit tests & integration tests with XML samples
ACC_E2E_ALIAS=local npm run test:e2e # end-to-end tests against a real instance
```

Coding conventions, project structure and contributor guidelines live in
[`AGENTS.md`](AGENTS.md).

### 📤 Output & logging

`acc` follows the Unix convention so its output is safe to script:

- **stdout** carries the command **result only** — e.g. the XML returned by
  `acc instance exec`, or the IP from `acc auth ip` — raw and undecorated, so it
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
