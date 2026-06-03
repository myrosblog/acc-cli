// npm
import path from "node:path";
import fs from "fs-extra";
import winston from "winston";
// sdk
import AioLogger from "@adobe/aio-lib-core-logging";

/**
 * Every npm log level, used to route the whole console stream to stderr.
 * @type {string[]}
 */
const ALL_LEVELS = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
];

/**
 * Builds the shared "acc" logger with a clean stream separation:
 * - **stderr**: all human diagnostics (connecting, progress, warnings, errors),
 *   filtered by AIO_LOG_LEVEL (default "info"). This keeps **stdout** reserved
 *   for command results emitted via oclif's `this.log()`.
 * - **file**: a rotating `acc.log` under the CLI cache dir capturing the full
 *   trace at all levels, regardless of the console level — for audit/post-mortem.
 *
 * @param {string} [cacheDir] oclif cache dir (`this.config.cacheDir`). When set,
 *   the rotating file transport is added. Skip the file with `ACC_NO_FILE_LOG=1`.
 * @returns {AioLogger}
 */
export default function makeLogger(cacheDir) {
  const consoleLevel = process.env.AIO_LOG_LEVEL || "info";
  const transports = [
    // All console output goes to stderr so stdout carries only command results.
    new winston.transports.Console({
      level: consoleLevel,
      stderrLevels: ALL_LEVELS,
    }),
  ];

  if (cacheDir && process.env.ACC_NO_FILE_LOG !== "1") {
    // winston's File transport does not create parent dirs.
    fs.ensureDirSync(cacheDir);
    transports.push(
      new winston.transports.File({
        level: "silly", // always capture the full trace, whatever the console level
        filename: path.join(cacheDir, "acc.log"),
        maxsize: 1024 * 1024, // 1 MB
        maxFiles: 5,
        tailable: true,
      }),
    );
  }

  // level "silly" keeps the logger gate fully open so the file transport sees
  // every message; each transport then filters by its own level. AIO_LOG_LEVEL
  // still narrows the console transport (and, if set, the logger gate).
  return AioLogger("acc", { level: "silly", transports });
}
