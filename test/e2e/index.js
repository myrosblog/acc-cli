// Entry point for the e2e suite (real instance, opt-in)
process.env.ACC_NO_FILE_LOG = "1";
process.env.AIO_LOG_LEVEL = process.env.AIO_LOG_LEVEL || "error";

import "./auth-login.spec.js";
import "./instance-exec.spec.js";
import "./instance-info.spec.js";
import "./instance-template.spec.js";
