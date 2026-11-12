import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Path of this file, run as a detached worker by sendInBackground.
 * @type {string}
 */
const WORKER_FILE = fileURLToPath(import.meta.url);

/**
 * Posts the event from a detached process, so the CLI exits without waiting
 * for the network. The URL holds the API secret: it goes through the
 * environment, not the arguments listed by `ps`.
 * @param {string} url - Endpoint, with its query string
 * @param {object} payload - Request body
 * @param {Function} [spawnProcess] - child_process.spawn, injected in tests
 * @returns {void}
 */
export function sendInBackground(url, payload, spawnProcess = spawn) {
  const worker = spawnProcess(process.execPath, [WORKER_FILE], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      ACC_TELEMETRY_URL: url,
      ACC_TELEMETRY_PAYLOAD: JSON.stringify(payload),
    },
  });
  // Without a listener, a failed spawn would crash the CLI
  worker.on("error", () => {});
  worker.unref();
}

/**
 * Posts the event. A failure is dropped: telemetry never fails a command.
 * @param {string} url - Endpoint, with its query string
 * @param {string} body - JSON request body
 * @param {Function} [fetchFn] - fetch, injected in tests
 * @returns {Promise<boolean>} true when the endpoint answered with a 2xx status
 */
export async function postEvent(url, body, fetchFn = fetch) {
  try {
    const response = await fetchFn(url, {
      method: "POST",
      body,
      // A slow network or a corporate proxy must not keep the worker alive
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

if (process.argv[1] === WORKER_FILE) {
  await postEvent(
    process.env.ACC_TELEMETRY_URL,
    process.env.ACC_TELEMETRY_PAYLOAD,
  );
}
