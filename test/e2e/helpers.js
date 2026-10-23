// Shared helpers for the e2e suite (runs the `acc` binary).
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

export const BIN = join(__dirname, "../../bin/acc");
// Default target; override per run with ACC_E2E_ALIAS (see `acc auth list`).
export const ALIAS = process.env.ACC_E2E_ALIAS || "local";

/**
 * Run the `acc` binary as a subprocess.
 *
 * Diagnostics are forced to info level so the stdout(result)/stderr(diagnostics)
 * routing can be asserted; ACC_NO_FILE_LOG is inherited from the e2e entrypoint.
 * OCLIF_COLUMNS is raised because oclif wraps errors at 80 columns when stderr
 * is not a TTY, which would split a message such as "--args is not valid JSON"
 * across two lines and break the assertions.
 * Rejects (like execFile) on a non-zero exit, exposing `code`, `stdout`,
 * `stderr` on the error.
 *
 * @param {string[]} args - CLI args, e.g. ["auth", "login", "--alias", "local"]
 * @param {object} [opts] - extra execFile options (cwd, env, ...)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export const runAcc = (args, opts = {}) =>
  run(process.execPath, [BIN, ...args], {
    maxBuffer: 10 * 1024 * 1024,
    ...opts,
    env: {
      ...process.env,
      AIO_LOG_LEVEL: "info",
      OCLIF_COLUMNS: "1000",
      ...opts.env,
    },
  });

/**
 * Write a file in a directory, typically the throwaway cwd of a spec.
 *
 * @param {string} cwd - directory to write in
 * @param {string} name - file name
 * @param {string} content - file content
 * @returns {string} the absolute path of the file
 */
export const writeFile = (cwd, name, content) => {
  const file = join(cwd, name);
  fs.writeFileSync(file, content);
  return file;
};
