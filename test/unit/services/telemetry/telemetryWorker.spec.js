import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect } from "chai";
import sinon from "sinon";
import {
  postEvent,
  sendInBackground,
} from "../../../../src/services/telemetry/telemetryWorker.js";

const WORKER_FILE = fileURLToPath(
  new URL(
    "../../../../src/services/telemetry/telemetryWorker.js",
    import.meta.url,
  ),
);

describe("telemetryWorker", () => {
  describe("sendInBackground", () => {
    it("spawns a detached worker that does not hold the CLI", () => {
      const worker = { on: sinon.stub(), unref: sinon.stub() };
      const spawn = sinon.stub().returns(worker);

      sendInBackground("https://example.test/mp", { a: 1 }, spawn);

      const [command, args, options] = spawn.firstCall.args;
      expect(command).to.equal(process.execPath);
      expect(args[0]).to.match(/telemetryWorker\.js$/);
      expect(options).to.include({ detached: true, stdio: "ignore" });
      expect(options.env).to.include({
        ACC_TELEMETRY_URL: "https://example.test/mp",
        ACC_TELEMETRY_PAYLOAD: '{"a":1}',
      });
      expect(worker.on.calledWith("error")).to.be.true;
      expect(worker.unref.calledOnce).to.be.true;
    });
  });

  describe("postEvent", () => {
    it("posts the body", async () => {
      const fetch = sinon.stub().resolves({ ok: true });

      expect(await postEvent("https://example.test/mp", "{}", fetch)).to.be
        .true;
      const [url, options] = fetch.firstCall.args;
      expect(url).to.equal("https://example.test/mp");
      expect(options).to.include({ method: "POST", body: "{}" });
      expect(options.signal).to.be.instanceOf(AbortSignal);
    });

    it("drops a network failure", async () => {
      const fetch = sinon.stub().rejects(new Error("ENOTFOUND"));

      expect(await postEvent("https://example.test/mp", "{}", fetch)).to.be
        .false;
    });
  });

  describe("worker process", () => {
    it("exits cleanly when the post fails", () => {
      // Runs the file as sendInBackground does. fetch rejects the invalid URL
      // before any connection, so the test stays off the network.
      const worker = spawnSync(process.execPath, [WORKER_FILE], {
        env: {
          ...process.env,
          ACC_TELEMETRY_URL: "not a url",
          ACC_TELEMETRY_PAYLOAD: "{}",
        },
        encoding: "utf8",
        timeout: 10000,
      });

      expect(worker.status).to.equal(0);
      expect(worker.stderr).to.equal("");
    });
  });
});
