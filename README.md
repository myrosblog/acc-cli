![Downloads](https://img.shields.io/npm/dm/campaign-cli)
![Code Coverage](https://img.shields.io/codecov/c/github/myrosblog/acc-cli)

# acc, the command line interface for Adobe Campaign developers

Save time, reduce risk, and improve code health with `acc`! This CLI tool helps you build on Adobe Campaign Classic platform. It quickly downloads Adobe Campaign **configuration, campaigns and online resources**. You can also use it to automate many common development tasks.

Full documentation available on [Getting started with acc](https://myrosblog.com/adobe-campaign/acc-cli?utm_campaign=readme)

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
# Interactive: prompts for any missing value; the password is entered hidden
# (never stored in your shell history or visible in the process list).
acc auth init
# Host (i.e. https://instance1.campaign.adobe.com):
# Username:
# Password:
# Alias (i.e. staging):
```

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

```bash
# Run server-side JavaScript (xtk:builder#EvaluateJavaScript)
acc instance exec --alias staging --script "context.@result = application.instanceName"
acc instance exec --alias staging --script "context.@result = getOption('NmsEmail_DefaultFromAddr')"
acc instance exec --alias staging --file ./Administration/Configuration/JavaScript codes/mynamespace/my-script.js
```

## 📤 Output & logging

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

## 🗓️ Roadmap

Read the [Project Roadmap](https://myrosblog.com/adobe-campaign/acc-cli-roadmap?utm_campaign=readme).

## 🔒 Architecture & Security

Read the [Architecture & Security documentation](https://myrosblog.com/adobe-campaign/acc-cli-architecture?utm_campaign=readme).

## 📋 Changelog

Read the [Changelog](https://myrosblog.com/adobe-campaign/acc-cli-changelog?utm_campaign=readme).

## 🤝 Contributing

Contributions are welcome! Please open a Github Pull Request!

### 🛠️ Local development

```bash
# Clone repository
git clone https://github.com/myrosblog/acc-cli.git && cd acc-cli
npm install && npm test
```

### Importing from `@adobe/acc-js-sdk`

Always import from the package's public entry point so the code only depends on
the SDK's documented, semver-protected API:

```js
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil, ConnectionParameters } = accSdk;
```

A few classes used internally (`Client`, `EntityAccessor`, `XPath`,
`XPathElement`, `DomException`) are **not** re-exported by the public entry, so
they are imported directly from the package internals
(`@adobe/acc-js-sdk/src/...`). These deep imports are a deliberate, known
trade-off: they reach past the public API and may break on any SDK release.
Prefer the public entry whenever a symbol is available there, and keep the list
of internal imports as small as possible.

### Dependency injection

External dependencies (SDK, config, prompt, cache, spinner) are passed into the
service classes (`CampaignAuth`, `CampaignInstance`, ...) rather than created
inside them, with a sensible default applied when the argument is omitted. This
keeps the production call sites simple while letting tests inject stubs — so the
suite never touches the network or the filesystem.

When a dependency has a side effect on construction (e.g. `AccCache` creates its
directory on disk), inject a **factory** instead of an instance, so the resource
is only built lazily when actually needed:

```js
constructor(logger, sdk, config, prompt, makeCache) {
  this.prompt = prompt || new PromptAdapter();
  this.makeCache = makeCache || (() => new AccCache()); // built on login(), not here
}
```
