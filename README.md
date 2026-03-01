# Campaign CLI

**A command-line interface for ACC (Campaign Classic) developers**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org)
[![npm](https://img.shields.io/badge/npm-CLI-blue.svg)](https://www.npmjs.com/)

## 🚀 Quick Start

### Quick usage

```bash
acc auth init --host https://instance.com --user username --password --alias staging

acc instance pull --alias staging
# Downloaded /Administration/Configuration/Form rendering
# Downloaded /Administration/Configuration/Dynamic Javascript pages
```

### Quick installation

```bash
cd ~/Downloads
git clone https://github.com/myrosblog/campaign-cli.git
cd campaign-cli
npm install
npm link
acc # check installation
```

### Basic Usage

Folder structure recommendation, under a local folder, i.e. `Downloads`

```bash
/Downloads/
├── campaign-cli/                  # Clone of this source code
│
├── instance1-staging/             # Staging Instance 1
│   ├── config/                          # Instance-specific config => automatically created with acc check
│   │   └── acc.config.json
│   └── Administration/Configuration/    # Downloaded schemas => automatically downloaded with acc pull
│       ├── schema1.xml
│       └── schema2.xml
│
└── instance1-production/          # Production Instance 2
    ├── config/
    │   └── acc.config.json
    └── Administration/Configuration/
        ├── schema1.xml
        └── schema2.xml
```

#### Step 1: Configure an ACC Instance

```bash
acc auth init \
  --host http://localhost:8080 \
  --user admin \
  --password admin \
  --alias local
```

This command:
- Saves credentials securely in your config store
- Tests the connection to your ACC instance
- Lists available schemas and record counts

#### Step 2: Pull Data from Your Instance with default configuration

```bash
acc instance check --alias local
acc instance pull --alias local
```

This command:
- Creates a local directory structure
- Downloads schema definitions as XML files
- Preserves original naming conventions
- Implements pagination for large datasets

#### Step 2-bis: Pull Data from Your Instance with custom configuration

Create 
```bash
```

## 📚 Features

### Authentication Management

```bash
# List all configured instances
acc auth list

# Troubleshoot IP via https://api.db-ip.com/v2/free/self @see https://opensource.adobe.com/acc-js-sdk/connecting.html
acc auth ip

# Login to an existing instance
acc auth login --alias prod

# Initialize a new instance
acc auth init --alias staging --host https://staging.example.com
```

### Data Operations

```bash
# Check instance (count records without downloading)
acc instance check --alias prod

# Pull data with custom config
acc instance pull \
  --alias prod \
  --path ./my-project/data \
  --config ./config/acc.config.json
```

### Configuration Management

Create a `acc.config.json` file to customize data pulling:

```json
{
  "default": {
    "filename": "%schema%_%name%.xml"
  },
  "nms:recipient": {
    "filename": "recipients/%name%.xml",
    "queryDef": {
      "where": {"condition": [{ "expr": "@builtIn = false AND @isModel = true" }]},
    }
  }
}
```

## 🎯 Use Cases

### For ACC Developers

```bash
# Setup development environment
acc auth init --alias dev --host http://localhost:8080

# Pull specific schemas
acc instance pull --alias dev

# Regular data refresh
acc instance pull --alias prod --path ./backup/$(date +%Y-%m-%d)
```

### For DevOps Teams

```bash
# CI/CD integration
acc auth init --alias ci --host $ACC_HOST --user $ACC_USER --password $ACC_PASSWORD
acc instance check --alias ci || exit 1

# Automated backups
acc instance pull --alias prod --path /backups/acc/$(date +%Y-%m-%d)
```

### For Data Analysts

```bash
# Quick data extraction
acc instance pull --alias analytics --config ./config/analytics.config.json

# Schema documentation
acc instance check --alias prod > schema_report.txt
```

## 🔧 Advanced Configuration

### Custom Paths and Configs

```bash
acc instance pull \
  --alias staging \
  --path /projects/acc-migration/data \
  --config ./config/migration.config.json
```

### Filename Patterns

Available variables for filename patterns:
- `%schema%` - Schema name (e.g., `nms_recipient`)
- `%namespace%` - Schema namespace
- `%name%` - Schema display name
- `%internalName%` - Internal schema name

## 🛠️ Development

### Prerequisites

- Node.js 22+
- npm 9+
- ACC instance access

### Setup

```bash
# Clone repository
git clone https://github.com/myrosblog/campaign-cli.git
cd campaign-cli

# Install dependencies
npm install

# Link for local development
npm link

# Run tests
npm test
```

### Project Structure

```
src/
├── main.js              # CLI entry point
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

### Running Tests

```bash
# Run all tests
npm test

# Run specific test files
npx mocha test/CampaignAuth.spec.js

# Test with coverage
npm run test
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Commit changes**: `git commit -m 'Add some feature'`
4. **Push to branch**: `git push origin feature/your-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add JSDoc comments for new functions
- Write tests for new features
- Update README for significant changes
- Keep commits focused and descriptive

## Roadmap

- Publish to npm

## 🔒 Security

- Credentials are stored securely using `configstore`
- No credentials are logged or transmitted unnecessarily
- All network communications use the official ACC JS SDK
- Regular dependency updates for security patches

## 📄 License

This project is licensed under the **AGPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for ACC developers
- Inspired by modern CLI tools like Shopify CLI
- Powered by Node.js and the ACC JS SDK

## 📬 Contact

For questions, issues, or contributions:
- **GitHub Issues**: https://github.com/myrosblog/campaign-cli/issues
- **Source Code**: https://github.com/myrosblog/campaign-cli
