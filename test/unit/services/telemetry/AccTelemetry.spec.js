import { expect } from "chai";
import sinon from "sinon";
import telemetryLib from "@adobe/aio-cli-plugin-telemetry/src/telemetry-lib.js";
import AccTelemetry from "../../../../src/services/telemetry/AccTelemetry.js";

// Stands for the aio library, without its config singleton: no file is read or written
const makeLib = ({ enabled = true } = {}) => ({
  init: sinon.stub(),
  isEnabled: sinon.stub().returns(enabled),
  enable: sinon.stub(),
  disable: sinon.stub(),
  getClientId: sinon.stub().returns(685337164330),
  getInvocationContext: telemetryLib.getInvocationContext,
});

const EVENT = {
  command: "auth:list",
  flags: "",
  durationMs: 10,
  cliVersion: "1.9.0",
};

describe("AccTelemetry", () => {
  afterEach(() => sinon.restore());

  it("stores its settings under acc-cli-telemetry", () => {
    const lib = makeLib();
    expect(new AccTelemetry({}, sinon.stub(), lib).lib).to.equal(lib);
    expect(lib.init.calledWith(undefined, "acc")).to.be.true;
  });

  it("uses the aio library by default", () => {
    sinon.stub(telemetryLib, "init");
    expect(new AccTelemetry().lib).to.equal(telemetryLib);
    expect(telemetryLib.init.calledWith(undefined, "acc")).to.be.true;
  });

  describe("track", () => {
    it("sends nothing when disabled", () => {
      const send = sinon.stub();
      const lib = makeLib({ enabled: false });
      new AccTelemetry({}, send, lib).track(EVENT);
      expect(send.called).to.be.false;
    });

    it("sends nothing with AIO_TELEMETRY_DISABLED, set by test/index.js", () => {
      const send = sinon.stub();
      // The library checks the variable before the config file, so nothing is read
      new AccTelemetry({}, send).track(EVENT);
      expect(send.called).to.be.false;
    });

    it("stores the opt-in and sends the first run", () => {
      const send = sinon.stub();
      const lib = makeLib();
      new AccTelemetry({}, send, lib).track(EVENT, true);
      expect(lib.enable.calledOnce).to.be.true;
      expect(send.calledOnce).to.be.true;
    });

    it("sends the event to GA4", () => {
      const send = sinon.stub();
      const telemetry = new AccTelemetry(
        { CURSOR_AGENT: "", CLAUDECODE: "1", SHELL: "/opt/homebrew/bin/fish" },
        send,
        makeLib(),
      );
      telemetry.track(EVENT);
      const [url, payload] = send.firstCall.args;
      expect(url).to.match(
        /^https:\/\/www\.google-analytics\.com\/mp\/collect\?measurement_id=/,
      );
      expect(payload.client_id).to.equal("685337164330");
      expect(payload.events[0].params.page_title).to.equal("acc auth list");
      expect(payload.device.browser_version).to.equal(process.versions.node);
      expect(payload.user_properties.agent.value).to.equal("claude");
      expect(payload.user_properties.shell.value).to.equal("fish");
    });

    it("sends human and unknown without agent nor SHELL", () => {
      const send = sinon.stub();
      new AccTelemetry({}, send, makeLib()).track(EVENT);
      const { user_properties: userProperties } = send.firstCall.args[1];
      expect(userProperties.agent.value).to.equal("human");
      expect(userProperties.shell.value).to.equal("unknown");
    });
  });
});
