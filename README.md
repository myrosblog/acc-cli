**acc, the command line interface for Adobe Campaign developers**

Save time, reduce risk, and improve code health with `acc`! This CLI tool helps you build on Adobe Campaign Classic platform. It quickly downloads Adobe Campaign **configuration, campaigns and online resources**. You can also use it to automate many common development tasks.

Full article in the blog post [Getting started with acc](https://myrosblog.com/adobe-campaign/acc-cli-use-cases?utm_campaign=readme)

## Features

- Download all Marketing content: Campaigns, Deliveries, Web apps, and more!
- Download all Technical content: Data schemas, Javascript codes & pages, Workflows and more!
- Replace manual exports with scriptable, auditable, and repeatable operations
- Decompose sources into codes (JS, HTML, CSS) and metadata (fields @created, @lastModified…)
- Allow local code checkers, highlighters and linters
- Work on any instance: local, staging, production ; and any OS: Windows, macOS, Linux

## 🚀 Quick Start

### Quick usage

```bash
$ npm install -g campaign-cli

$ acc auth init --host https://instance.com --user username --password --alias staging

$ acc instance pull --alias staging
# Downloaded /Administration/Configuration/Form rendering
# Doanloaded /Administration/Configuration/Dynamic Javascript pages
```

### 🔧 Advanced Configuration

[Advanced use cases with acc](https://myrosblog.com/adobe-campaign/acc-cli-use-cases?utm_campaign=readme)

## 🤝 Contributing

Contributions are welcome! Please open a Github Pull Request!

### Local development

```bash
# Clone repository
git clone https://github.com/myrosblog/acc-cli.git && cd acc-cli
npm install && npm test
```

### Project Structure

```
src/
├── main.js                  # CLI entry point
├── CampaignAuth.js          # Authentication and instance management
├── CampaignInstance.js      # Data operations (check, pull, download)
└── CampaignError.js         # Custom error handling

test/
├── CampaignAuth.spec.js     # Authentication tests
├── CampaignInstance.spec.js # Data operation tests
└── CampaignError.spec.js    # Error handling tests

bin/
└── acc                      # Executable wrapper

config/
└── acc.config.json          # Default configuration template
```

## Roadmap

- `acc instance push`

## 🔒 Security

- Credentials are stored securely using `configstore` outside of version controlled folders
- No credentials are logged or transmitted unnecessarily
- All network communications use the official ACC JS SDK
- All sensitive information are trimmed by the official ACC JS SDK (headers `x-security-token` and `x-session-token`, session tokens) via `_removeBetween`
