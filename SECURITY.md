# Security Policy

## Reporting a vulnerability

- Report privately with the "Report a vulnerability" button under the repository Security tab. Do not open a public issue.
- `acc` is a community CLI, not an Adobe product. Report Adobe Campaign Classic vulnerabilities to Adobe (https://helpx.adobe.com/security/alertus.html), and `@adobe/acc-js-sdk` or `@adobe/aio-*` vulnerabilities to their own repositories.

## Supported versions

- Only the latest NPM published version of `campaign-cli` receives security fixes. Older minors have no maintenance branch.
- Supported runtimes are the Node.js versions declared in `package.json` under `engines`.
- Dependency advisories are tracked with Dependabot.

## Out of scope

- `acc instance exec` runs server-side JavaScript (`xtk:builder#EvaluateJavaScript`) with the rights of the authenticated operator. Where the instance security zones allow it, this reaches OS commands and arbitrary SQL. Restrict it with Campaign operator rights and security zones.
- Credentials are stored in clear text in the aio configuration file (`@adobe/aio-lib-core-config`), as in the other aio CLIs. Treat that file and every alias as credentials for the instance and its host: keep them on a per-user account with restrictive file permissions.
- `acc.log`, the SDK cache and pulled sources hold instance data. SOAP traces are secret-redacted by the SDK, pulled files are not: keep them out of public repositories.
- `acc auth decode` reads JWT claims without verifying the signature. It is a debugging aid, not an authorization check.
