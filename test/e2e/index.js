// Entry point for the e2e suite (real instance, opt-in). See ./README.md for how
// to run, gating, and conventions. Kept separate from test/index.js so
// `npm test` never touches a server.
process.env.ACC_NO_FILE_LOG = "1";
process.env.AIO_LOG_LEVEL = process.env.AIO_LOG_LEVEL || "error";

import "./auth-login.spec.js";
import "./instance-exec.spec.js";
import "./instance-querydef.spec.js";
import "./instance-info.spec.js";
