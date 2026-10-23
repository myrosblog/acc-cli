// Runs the `acc` binary as a subprocess (fail-fast integration spec, e2e tier).
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

export const BIN = join(__dirname, "../bin/acc");
// Alias targeted by the e2e tier; override with ACC_E2E_ALIAS.
export const ALIAS = process.env.ACC_E2E_ALIAS || "local";

/**
 * Run the `acc` binary as a subprocess. Logs are forced to info so stdout
 * (result) and stderr (diagnostics) can be asserted, and OCLIF_COLUMNS stops
 * oclif wrapping errors at 80 columns. Rejects on a non-zero exit, with `code`,
 * `stdout` and `stderr` on the error.
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
 * Write a file in a directory and return its path.
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
