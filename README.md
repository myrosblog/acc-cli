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
- [`acc config del KEYS`](#acc-config-del-keys)
- [`acc config delete KEYS`](#acc-config-delete-keys)
- [`acc config edit`](#acc-config-edit)
- [`acc config get KEY`](#acc-config-get-key)
- [`acc config list`](#acc-config-list)
- [`acc config ls`](#acc-config-ls)
- [`acc config rm KEYS`](#acc-config-rm-keys)
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

## `acc auth decode TOKEN`

Decode an access token. Use it to troubleshoot Adobe IMS authentication errors.

```
USAGE
  $ acc auth decode TOKEN [--json]

ARGUMENTS
  TOKEN  IMS Access token (starts with 'eyJ')

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Decode an access token. Use it to troubleshoot Adobe IMS authentication errors.

  Adobe Campaign authentication:
  https://experienceleague.adobe.com/en/docs/campaign-classic/using/technotes/ims/ims-migration

EXAMPLES
  Display the decoded information: issued at, expires at, organization id...

    $ acc auth decode "eyJhbGci…"

  Display the decoded information as a JSON object.

    $ acc auth decode "eyJhbGci…" --json
```

_See code: [src/commands/auth/decode.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/auth/decode.js)_

## `acc auth init`

Authenticate an Adobe Campaign instance, save credentials (in local .aio file), and calls `auth login`.

```
USAGE
  $ acc auth init [--alias <value>] [--host <value>] [--method UserPassword|ImsBearerToken|ImsServerToServer]
    [--user <value>] [--pass <value>] [--token <value>] [--json-file <value>] [--ims-env prod|stage]

FLAGS
  --alias=<value>      Local alias for this instance, e.g. prod, staging, local
  --host=<value>       URL of Adobe Campaign instance, e.g. https://instance1.campaign.adobe.com
  --ims-env=<option>   IMS environment for token generation (ImsServerToServer). Defaults to prod.
                       <options: prod|stage>
  --json-file=<value>  Path to the OAuth Server-to-Server JSON downloaded from the Developer Console (Credentials >
                       OAuth Server-to-Server > Download JSON). Implies --method ImsServerToServer. Keeps the client
                       secret out of your shell history, unlike passing it on the command line.
  --method=<option>    Authentication method. Defaults to UserPassword. Use ImsServerToServer to login via JSON from the
                       Developer Console OAuth Server-to-Server credentials, or use ImsBearerToken for a token pasted by
                       hand.
                       <options: UserPassword|ImsBearerToken|ImsServerToServer>
  --pass=<value>       Operator password (UserPassword method). Omit on an interactive terminal to be prompted securely
                       (avoids leaking it into shell history).
  --token=<value>      IMS bearer token (ImsBearerToken method), a JWT starting with 'eyJ'. Omit on an interactive
                       terminal to be prompted securely.
  --user=<value>       Operator username (UserPassword method)

DESCRIPTION
  Authenticate an Adobe Campaign instance, save credentials (in local .aio file), and calls `auth login`.

  The currently supported authentication methods are:

  - OAuth Server-to-Server (preferred): a JSON file from the Adobe Developer Console, for instances with an IMS identity
  provider.
  - OAuth Access Token: a JWT token pasted by hand, for instances with an IMS identity provider.
  - Operator User/Password: the classic operator login, for local instances or instances without IMS.

  The `auth init` command saves credentials in the local .aio file, and then logs in to the instance. The `auth login`
  command can be used later to re-login without re-entering credentials.

  Adobe Campaign authentication:
  https://experienceleague.adobe.com/en/docs/campaign-classic/using/technotes/ims/ims-migration

EXAMPLES
  Initialize authentication with menu selection (preferred).

    $ acc auth init

  For CI/CD: Initialize authentication with OAuth Server-to-Server method.

    $ acc auth init --alias prod --host https://instance1.campaign.adobe.com --method ImsServerToServer --json-file \
      ./oauth-s2s.json

  For CI/CD: Initialize authentication with OAuth Access Token method.

    $ acc auth init --alias prod --host https://instance1.campaign.adobe.com --method ImsBearerToken --token eyJ...

  For CI/CD: Initialize authentication with Operator User/Password method.

    $ acc auth init --alias local --host https://instance1.campaign.adobe.com --method UserPassword --user admin
```

_See code: [src/commands/auth/init.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/auth/init.js)_

## `acc auth ip`

Call api.db-ip.com and output your public IP address. Use it to troubleshoot IP whitelisting issues.

```
USAGE
  $ acc auth ip

DESCRIPTION
  Call api.db-ip.com and output your public IP address. Use it to troubleshoot IP whitelisting issues.

  Adobe Campaign authentication:
  https://experienceleague.adobe.com/en/docs/campaign-classic/using/technotes/ims/ims-migration

EXAMPLES
  Fetch IP and displays it as JSON. I.e. {ipAddress: "", countryCode: ""}

    $ acc auth ip
```

_See code: [src/commands/auth/ip.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/auth/ip.js)_

## `acc auth list`

Read credentials (from local .aio file) and display configured Adobe Campaign instances.

```
USAGE
  $ acc auth list [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Read credentials (from local .aio file) and display configured Adobe Campaign instances.

  Must be ran after `auth init`.

EXAMPLES
  Display your instances as table

    $ acc auth list

  For CI/CD: Output as json

    $ acc auth list --json
```

_See code: [src/commands/auth/list.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/auth/list.js)_

## `acc auth login`

Read credentials (from local .aio file) and login to an Adobe Campaign instance.

```
USAGE
  $ acc auth login --alias <value>

FLAGS
  --alias=<value>  (required) Local alias for this instance, e.g. prod, staging, local

DESCRIPTION
  Read credentials (from local .aio file) and login to an Adobe Campaign instance.

  Must be ran after `auth init`.

EXAMPLES
  Read credentials for the json key 'local', and login. Usually for a local Adobe Campaign VM.

    $ acc auth login --alias local

  Read credentials for the json key 'prod', and login. Usually for a production Adobe Campaign instance.

    $ acc auth login --alias prod
```

_See code: [src/commands/auth/login.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/auth/login.js)_

## `acc config`

list, get, set, delete, and edit persistent configuration data

```
USAGE
  $ acc config [-l | -g] [-e] [--verbose |  | [-j | -y]]

FLAGS
  -e, --env      environment variables
  -g, --global   global config
  -j, --json     output in json
  -l, --local    local config
  -y, --yaml     output in yaml
      --verbose  show all config values

DESCRIPTION
  list, get, set, delete, and edit persistent configuration data

ALIASES
  $ acc config ls

EXAMPLES
  $ aio config:list

  $ aio config:get KEY

  $ aio config:set KEY VALUE

  $ aio config:delete KEY

  $ aio config:clear
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/index.js)_

## `acc config clear`

clears all persistent config values

```
USAGE
  $ acc config clear [-l | -g] [-f]

FLAGS
  -f, --force   do not prompt for confirmation
  -g, --global  global config
  -l, --local   local config

DESCRIPTION
  clears all persistent config values
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/clear.js)_

## `acc config del KEYS`

deletes persistent config values

```
USAGE
  $ acc config del KEYS... [-l | -g]

FLAGS
  -g, --global  global config
  -l, --local   local config

DESCRIPTION
  deletes persistent config values

ALIASES
  $ acc config del
  $ acc config rm
```

## `acc config delete KEYS`

deletes persistent config values

```
USAGE
  $ acc config delete KEYS... [-l | -g]

FLAGS
  -g, --global  global config
  -l, --local   local config

DESCRIPTION
  deletes persistent config values

ALIASES
  $ acc config del
  $ acc config rm
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/delete.js)_

## `acc config edit`

edit config file

```
USAGE
  $ acc config edit [-l | -g]

FLAGS
  -g, --global  global config
  -l, --local   local config

DESCRIPTION
  edit config file
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/edit.js)_

## `acc config get KEY`

gets a persistent config value

```
USAGE
  $ acc config get KEY [-l | -g] [-j | -y] [-e]

FLAGS
  -e, --env     environment variables
  -g, --global  global config
  -j, --json    output in json
  -l, --local   local config
  -y, --yaml    output in yaml

DESCRIPTION
  gets a persistent config value
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/get.js)_

## `acc config list`

lists all persistent config values

```
USAGE
  $ acc config list [-l | -g] [-e] [--verbose |  | [-j | -y]]

FLAGS
  -e, --env      environment variables
  -g, --global   global config
  -j, --json     output in json
  -l, --local    local config
  -y, --yaml     output in yaml
      --verbose  show all config values

DESCRIPTION
  lists all persistent config values

ALIASES
  $ acc config ls
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/list.js)_

## `acc config ls`

list, get, set, delete, and edit persistent configuration data

```
USAGE
  $ acc config ls [-l | -g] [-e] [--verbose |  | [-j | -y]]

FLAGS
  -e, --env      environment variables
  -g, --global   global config
  -j, --json     output in json
  -l, --local    local config
  -y, --yaml     output in yaml
      --verbose  show all config values

DESCRIPTION
  list, get, set, delete, and edit persistent configuration data

ALIASES
  $ acc config ls

EXAMPLES
  $ aio config:list

  $ aio config:get KEY

  $ aio config:set KEY VALUE

  $ aio config:delete KEY

  $ aio config:clear
```

## `acc config rm KEYS`

deletes persistent config values

```
USAGE
  $ acc config rm KEYS... [-l | -g]

FLAGS
  -g, --global  global config
  -l, --local   local config

DESCRIPTION
  deletes persistent config values

ALIASES
  $ acc config del
  $ acc config rm
```

## `acc config set key 'a value'       # set key to 'a value'`

sets a persistent config value

```
USAGE
  $ acc config set key 'a value'       # set key to 'a value'
  $ acc config set key -f value.json   # set key to the json found in the file value.json
  $ acc config set -j key < value.json # set key to the json found in the file value.json

FLAGS
  -f, --file         value is a path to a file
  -g, --global       global config
  -i, --interactive  prompt for value
  -j, --json         value is json
  -l, --local        local config
  -y, --yaml         value is yaml

DESCRIPTION
  sets a persistent config value
```

_See code: [@adobe/aio-cli-plugin-config](https://github.com/adobe/aio-cli-plugin-config/blob/5.1.0/src/commands/config/set.js)_

## `acc info`

Display dev environment version information

```
USAGE
  $ acc info [-y | -j]

FLAGS
  -j, --json  output raw json
  -y, --yml   output yml

DESCRIPTION
  Display dev environment version information
```

_See code: [@adobe/aio-cli-plugin-info](https://github.com/adobe/aio-cli-plugin-info/blob/4.1.0/src/commands/info.js)_

## `acc instance check`

Check configuration and preview data pull from Adobe Campaign instance

```
USAGE
  $ acc instance check [--alias <value>] [--path <value>] [--config <value>] [--metadata <value>]

FLAGS
  --alias=<value>     Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                      acc.config.json.
  --config=<value>    [default: ./acc.config.json] Path to the configuration file.
  --metadata=<value>  Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation
  --path=<value>      [default: current working directory] Path where the command should run.

DESCRIPTION
  Check configuration and preview data pull from Adobe Campaign instance
```

_See code: [src/commands/instance/check.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/check.js)_

## `acc instance exec`

Execute server-side JavaScript on an Adobe Campaign instance (xtk:builder#EvaluateJavaScript)

```
USAGE
  $ acc instance exec [--alias <value>] [--path <value>] [--config <value>] [-f <value>] [-s <value>] [--name
    <value>]

FLAGS
  -f, --file=<value>    Path to a JavaScript file to execute on the server
  -s, --script=<value>  Inline JavaScript to execute (alternative to --file)
      --alias=<value>   Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                        acc.config.json.
      --config=<value>  [default: ./acc.config.json] Path to the configuration file.
      --name=<value>    Logical name of the script (defaults to the file basename, or 'acc-cli')
      --path=<value>    [default: current working directory] Path where the command should run.

DESCRIPTION
  Execute server-side JavaScript on an Adobe Campaign instance (xtk:builder#EvaluateJavaScript)

EXAMPLES
  $ acc instance exec --alias staging --file ./scripts/cleanup.js

  $ acc instance exec --alias staging --script "context.res = application.instanceName"
```

_See code: [src/commands/instance/exec.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/exec.js)_

## `acc instance info`

Diagnostic report for an Adobe Campaign instance (xtk:session#TestCnx, #GetServerTime, #GetCnxInfo, nl:monitoring#DumpCurrentInstanceState)

```
USAGE
  $ acc instance info [--alias <value>] [--path <value>] [--config <value>]

FLAGS
  --alias=<value>   Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                    acc.config.json.
  --config=<value>  [default: ./acc.config.json] Path to the configuration file.
  --path=<value>    [default: current working directory] Path where the command should run.

DESCRIPTION
  Diagnostic report for an Adobe Campaign instance (xtk:session#TestCnx, #GetServerTime, #GetCnxInfo,
  nl:monitoring#DumpCurrentInstanceState)

EXAMPLES
  $ acc instance info --alias staging
```

_See code: [src/commands/instance/info.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/info.js)_

## `acc instance pull`

Pull data from Adobe Campaign instance

```
USAGE
  $ acc instance pull [--alias <value>] [--path <value>] [--config <value>] [--metadata <value>]

FLAGS
  --alias=<value>     Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                      acc.config.json.
  --config=<value>    [default: ./acc.config.json] Path to the configuration file.
  --metadata=<value>  Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation
  --path=<value>      [default: current working directory] Path where the command should run.

DESCRIPTION
  Pull data from Adobe Campaign instance
```

_See code: [src/commands/instance/pull.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/pull.js)_

## `acc instance queryDef`

Run a read-only query on an Adobe Campaign instance (xtk:queryDef#ExecuteQuery). Pass a queryDef as JSON; it is read-only by construction (no writes, read-only permission compatible), a safe alternative to `instance exec`.

```
USAGE
  $ acc instance queryDef [--json] [--alias <value>] [--path <value>] [--config <value>] [-q <value>] [-f <value>]

FLAGS
  -f, --file=<value>    Path to a .json file containing the queryDef (alternative to --query)
  -q, --query=<value>   queryDef as a JSON string (alternative to --file)
      --alias=<value>   Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                        acc.config.json.
      --config=<value>  [default: ./acc.config.json] Path to the configuration file.
      --path=<value>    [default: current working directory] Path where the command should run.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Run a read-only query on an Adobe Campaign instance (xtk:queryDef#ExecuteQuery). Pass a queryDef as JSON; it is
  read-only by construction (no writes, read-only permission compatible), a safe alternative to `instance exec`.

EXAMPLES
  $ acc instance queryDef --alias staging --query '<queryDef schema="xtk:option" operation="get"><select><node expr="@stringValue" /></select></queryDef>'

  $ acc instance queryDef --alias staging --file ./queries/recipients.json --json
```

_See code: [src/commands/instance/queryDef.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/queryDef.js)_

## `acc instance soap`

Call an arbitrary SOAP method on an Adobe Campaign instance via the acc-js-sdk NLWS proxy (e.g. nms:delivery#BuildPreviewFromId, xtk:session#GetServerTime). The generic escape hatch behind the curated `instance` commands. Static methods only: non-static methods operate on a loaded entity and are not supported; prefer a static *FromId/*ById variant. Powerful: it can reach destructive methods, use with care.

```
USAGE
  $ acc instance soap -s <value> -m <value> [--json] [--alias <value>] [--path <value>] [--config <value>] [-a
    <value>]

FLAGS
  -a, --args=<value>    Method arguments as a JSON array, e.g. '[1234, "<params/>"]'. Omit for methods that take no
                        argument.
  -m, --method=<value>  (required) Method name (PascalCase or camelCase accepted), e.g. BuildPreviewFromId
  -s, --schema=<value>  (required) Schema id, e.g. nms:delivery, xtk:session
      --alias=<value>   Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                        acc.config.json.
      --config=<value>  [default: ./acc.config.json] Path to the configuration file.
      --path=<value>    [default: current working directory] Path where the command should run.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Call an arbitrary SOAP method on an Adobe Campaign instance via the acc-js-sdk NLWS proxy (e.g.
  nms:delivery#BuildPreviewFromId, xtk:session#GetServerTime). The generic escape hatch behind the curated `instance`
  commands. Static methods only: non-static methods operate on a loaded entity and are not supported; prefer a static
  *FromId/*ById variant. Powerful: it can reach destructive methods, use with care.

EXAMPLES
  $ acc instance soap --schema xtk:session --method GetServerTime

  $ acc instance soap --schema nms:delivery --method HtmlToText --args '["<p>Hi</p>"]'

  $ acc instance soap --schema nms:delivery --method BuildPreviewFromId --args '[1234, {"content": "html", "filter": "@id = 1000"}]' --json
```

_See code: [src/commands/instance/soap.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/soap.js)_

## `acc instance template`

Output a template configuration file

```
USAGE
  $ acc instance template

DESCRIPTION
  Output a template configuration file

EXAMPLES
  Output the template in the console.

    $ acc instance template

  Output the template in a file.

    $ acc instance template > acc.config.json
```

_See code: [src/commands/instance/template.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/template.js)_

## `acc instance watch`

Watch decomposed files and push changes to Adobe Campaign instance. Only files with 'decompose' configuration in acc.config.json are watched.

```
USAGE
  $ acc instance watch [--alias <value>] [--path <value>] [--config <value>] [--debounce <value>]

FLAGS
  --alias=<value>     Local alias for this instance, e.g. prod, staging, local. Defaults to the alias field of
                      acc.config.json.
  --config=<value>    [default: ./acc.config.json] Path to the configuration file.
  --debounce=<value>  [default: 300] Debounce time in milliseconds to wait after file changes before pushing (default:
                      300)
  --path=<value>      [default: current working directory] Path where the command should run.

DESCRIPTION
  Watch decomposed files and push changes to Adobe Campaign instance. Only files with 'decompose' configuration in
  acc.config.json are watched.

EXAMPLES
  Watch decomposed files and push changes to the staging instance

    $ acc instance watch --alias staging

  Watch decomposed files in ./src directory and push changes to the staging instance

    $ acc instance watch --alias staging --path ./src

  Watch decomposed files with a 500ms debounce delay

    $ acc instance watch --alias local --debounce 500
```

_See code: [src/commands/instance/watch.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/instance/watch.js)_

## `acc monitor test`

Health-check an instance via the anonymous /r/test endpoint (Apache front, no login)

```
USAGE
  $ acc monitor test [--host <value> | --alias <value>]

FLAGS
  --alias=<value>  Probe the host of a stored instance alias instead of --host
  --host=<value>   Instance root URL to probe anonymously, e.g. https://instance1.campaign.adobe.com

DESCRIPTION
  Health-check an instance via the anonymous /r/test endpoint (Apache front, no login)
```

_See code: [src/commands/monitor/test.js](https://github.com/myrosblog/acc-cli/blob/v1.6.3/src/commands/monitor/test.js)_

## `acc report`

Report an issue with the CLI or submit a feature request

```
USAGE
  $ acc report [-b | -f]

FLAGS
  -b, --bug      report an issue
  -f, --feature  request a feature

DESCRIPTION
  Report an issue with the CLI or submit a feature request
```

_See code: [@adobe/aio-cli-plugin-info](https://github.com/adobe/aio-cli-plugin-info/blob/4.1.0/src/commands/report.js)_
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

Auth can be fully scripted: `acc auth init --host https://instance1.campaign.adobe.com --user username --pass 's3cret' --alias staging`
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
