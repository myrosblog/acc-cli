**acc, the command line interface for Adobe Campaign developers**

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

```bash
acc auth init --host https://instance.com --user username --pass --alias staging

acc instance pull --alias staging
# Downloaded /Administration/Configuration/Form rendering
# Doanloaded /Administration/Configuration/Dynamic Javascript pages
```

### 🔧 Advanced Configuration

Read the [Advanced Use Cases documentation](https://myrosblog.com/adobe-campaign/acc-cli-use-cases?utm_campaign=readme)

## 🤝 Contributing

Contributions are welcome! Please open a Github Pull Request!

### Local development

```bash
# Clone repository
git clone https://github.com/myrosblog/acc-cli.git && cd acc-cli
npm install && npm test
```

## Roadmap

- `acc instance push`

## 🔒 Architecture & Security

Read the [Architecture & Security documentation](https://myrosblog.com/adobe-campaign/acc-cli-architecture?utm_campaign=readme).
