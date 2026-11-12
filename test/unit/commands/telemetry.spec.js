import { expect } from "chai";
import sinon from "sinon";
import Telemetry from "../../../src/commands/telemetry/index.js";
import telemetryLib from "@adobe/aio-cli-plugin-telemetry/src/telemetry-lib.js";
import AccTelemetry from "../../../src/services/telemetry/AccTelemetry.js";

describe("Telemetry", () => {
  afterEach(() => sinon.restore());

  it("should have correct description", () => {
    expect(Telemetry.description).to.match(/^Display or change/);
  });

  it("displays the status without argument", async () => {
    sinon.stub(telemetryLib, "isEnabled").returns(true);
    // Telemetry being on, finally() would otherwise send the call
    sinon.stub(AccTelemetry.prototype, "track");
    const log = sinon.stub(Telemetry.prototype, "log");

    const result = await Telemetry.run([]);

    expect(result).to.deep.equal({ enabled: true });
    expect(log.calledWith("Telemetry is on.")).to.be.true;
  });

  it("turns telemetry off", async () => {
    // Stubbed so the test writes no config file
    const disable = sinon.stub(telemetryLib, "disable");
    // The state comes from AIO_TELEMETRY_DISABLED, set by test/index.js
    const log = sinon.stub(Telemetry.prototype, "log");

    await Telemetry.run(["off"]);

    expect(disable.calledOnce).to.be.true;
    expect(log.calledWith("Telemetry is off.")).to.be.true;
  });

  it("turns telemetry on", async () => {
    const enable = sinon.stub(telemetryLib, "enable");
    sinon.stub(Telemetry.prototype, "log");

    await Telemetry.run(["on"]);

    expect(enable.calledOnce).to.be.true;
  });

  it("rejects another state", async () => {
    await expect(Telemetry.run(["maybe"])).to.be.rejectedWith(
      /Expected maybe to be one of: on, off/,
    );
  });
});
