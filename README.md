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
