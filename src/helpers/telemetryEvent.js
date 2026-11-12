/**
 * Builds the GA4 Measurement Protocol body of a command call. The command is
 * sent as a page view and the runtime as a device, so the native GA4 reports
 * (Realtime, Pages and screens, Tech) show them without custom definitions.
 * @param {string} clientId - Random id of the machine
 * @param {object} event - The command call
 * @param {string} event.command - oclif command id, i.e. "instance:pull"
 * @param {string} event.flags - Flag names in the typed order, i.e. "json,alias"
 * @param {number} event.durationMs - Command duration in milliseconds
 * @param {string} event.cliVersion - Version of acc
 * @param {string} event.agent - Name of the AI agent, i.e. "claude", or "human"
 * @param {string} event.shell - Login shell, i.e. "zsh", or "unknown"
 * @param {string} event.platform - process.platform, i.e. "darwin"
 * @param {string} event.osVersion - OS release
 * @param {string} event.nodeVersion - Version of Node.js, i.e. "24.14.0"
 * @returns {object} The request body
 */
export function buildGa4Payload(clientId, event) {
  return {
    client_id: clientId,
    user_properties: {
      cli_version: { value: event.cliVersion },
      agent: { value: event.agent },
      shell: { value: event.shell },
    },
    device: {
      category: "desktop",
      operating_system: event.platform,
      operating_system_version: event.osVersion,
      browser: "Node.js",
      browser_version: event.nodeVersion,
    },
    events: [
      {
        // A page view feeds the native GA4 page reports
        name: "page_view",
        params: {
          // Convert oclif command to what was typed, i.e. "acc instance pull"
          page_title: `acc ${event.command.replaceAll(":", " ")}`,
          // Convert oclif command to path, i.e. "/instance/pull"
          // GA4 only reads this URL, no request goes there
          page_location: `https://github.com/myrosblog/acc-cli/${event.command.replaceAll(":", "/")}`,
          // oclif flags, cut to the GA4 limit of 100 characters
          flags: (event.flags || "none").slice(0, 100),
          duration_ms: event.durationMs,
          // GA4 counts a user as active only with a positive engagement time
          engagement_time_msec: Math.max(1, event.durationMs),
        },
      },
    ],
  };
}
