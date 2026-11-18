// npm
import os from "node:os";
import path from "node:path";
// sdk
import telemetryLib from "@adobe/aio-cli-plugin-telemetry/src/telemetry-lib.js";
// acc
import { buildGa4Payload } from "../../helpers/telemetryEvent.js";
import { sendInBackground } from "./telemetryWorker.js";

/** GA4 endpoint. Secret only allows sending events, can be shared with the CLI. */
const GA4_URL =
  "https://www.google-analytics.com/mp/collect?measurement_id=G-NXT879WY6P&api_secret=RTPPW7W6Qri6kZMIjgmkrQ";

/** Shown once, on the first run. */
export const TELEMETRY_NOTICE =
  "📊 acc collects anonymous usage data to improve the CLI: command, flag names, duration, versions and shell. " +
  "Never the instance, arguments or flag values. Turn it off with `acc telemetry off`.";

/**
 * Sends anonymous usage data of each command to GA4
 *
 * @class AccTelemetry
 */
class AccTelemetry {
  /**
   * @param {object} [env] - Environment variables, i.e. process.env
   * @param {Function} [send] - Sends a payload to a URL, see sendInBackground
   * @param {object} [lib] - aio telemetry library, see @adobe/aio-cli-plugin-telemetry
   */
  constructor(env, send, lib) {
    this.env = env || process.env;
    this.send = send || sendInBackground;
    this.lib = lib || telemetryLib;
    // Stores the settings under "acc-cli-telemetry"
    this.lib.init(undefined, "acc");
  }

  /**
   * Sends an event
   * @param {object} event - The command call, see buildGa4Payload
   * @param {boolean} [isFirstRun] - true when no opt-in nor opt-out is stored yet
   */
  track(event, isFirstRun) {
    if (!this.lib.isEnabled()) {
      return;
    }
    // Stores the opt-in, so the notice is shown once
    if (isFirstRun) {
      this.lib.enable();
    }
    this.send(
      GA4_URL,
      buildGa4Payload(
        String(this.lib.getClientId()), // GA4 expects a string
        {
          ...event,
          // AI assistant detection from aio-cli-plugin-telemetry
          agent: this.lib.getInvocationContext(this.env).agentName ?? "human",
          // Name without its path; Windows sets no SHELL, except Git Bash
          shell: this.env.SHELL
            ? path.posix.basename(this.env.SHELL)
            : "unknown",
          platform: process.platform,
          osVersion: os.release(),
          nodeVersion: process.versions.node,
        },
      ),
    );
  }
}

export default AccTelemetry;
