# Campaign CLI

**A command-line interface for ACC (Campaign Classic) developers**

Full article in the blog post [Getting started with acc](https://myrosblog.com/adobe-campaign/acc-cli-use-cases?utm_campaign=readme)

## 🚀 Quick Start

### Quick usage

```bash
$ npm install -g campaign-cli

$ acc auth init --host https://instance.com --user username --password --alias staging

$ acc instance check --alias staging
# Downloaded /Administration/Configuration/Form rendering
# Downloaded /Administration/Configuration/Dynamic Javascript pages

$ acc instance pull --alias staging
```

### 🔧 Advanced Configuration

[Advanced use cases with acc](https://myrosblog.com/adobe-campaign/acc-cli-use-cases?utm_campaign=readme)

## 🤝 Contributing

Contributions are welcome! Please open a Pull Request!

### Local development

```bash
# Clone repository
git clone https://github.com/myrosblog/acc-cli.git
cd acc-cli
npm install
npm link
npm test
```

### Project Structure

```
src/
├── main.js               # CLI entry point
├── CampaignAuth.js       # Authentication and instance management
├── CampaignInstance.js   # Data operations (check, pull, download)
└── CampaignError.js      # Custom error handling

test/
├── CampaignAuth.spec.js  # Authentication tests
├── CampaignInstance.spec.js # Data operation tests
└── CampaignError.spec.js  # Error handling tests

bin/
└── acc            # Executable wrapper

config/
└── acc.config.json # Default configuration template
```

## Roadmap

- `acc instance push`

## 🔒 Security

- Credentials are stored securely using `configstore`
- No credentials are logged or transmitted unnecessarily
- All network communications use the official ACC JS SDK
- Regular dependency updates for security patches
