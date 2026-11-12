import { expect } from "chai";
import { buildGa4Payload } from "../../../src/helpers/telemetryEvent.js";

const EVENT = {
  command: "instance:queryDef",
  flags: "alias",
  durationMs: 1200,
  cliVersion: "1.9.0",
  agent: "claude",
  shell: "zsh",
  platform: "darwin",
  osVersion: "25.6.0",
  nodeVersion: "24.0.0",
};

describe("telemetryEvent", () => {
  describe("buildGa4Payload", () => {
    it("sends the command as a page view and the runtime as a device", () => {
      expect(buildGa4Payload("id-1", EVENT)).to.deep.equal({
        client_id: "id-1",
        user_properties: {
          cli_version: { value: "1.9.0" },
          agent: { value: "claude" },
          shell: { value: "zsh" },
        },
        device: {
          category: "desktop",
          operating_system: "darwin",
          operating_system_version: "25.6.0",
          browser: "Node.js",
          browser_version: "24.0.0",
        },
        events: [
          {
            name: "page_view",
            params: {
              page_title: "acc instance queryDef",
              page_location:
                "https://github.com/myrosblog/acc-cli/instance/queryDef",
              flags: "alias",
              duration_ms: 1200,
              engagement_time_msec: 1200,
            },
          },
        ],
      });
    });

    it("sends none without flags and a positive engagement time", () => {
      const { params } = buildGa4Payload("id-1", {
        ...EVENT,
        flags: "",
        durationMs: 0,
      }).events[0];
      expect(params.flags).to.equal("none");
      expect(params.engagement_time_msec).to.equal(1);
    });

    it("truncates values to 100 characters", () => {
      const { params } = buildGa4Payload("id-1", {
        ...EVENT,
        flags: "x".repeat(150),
      }).events[0];
      expect(params.flags).to.have.lengthOf(100);
    });
  });
});
