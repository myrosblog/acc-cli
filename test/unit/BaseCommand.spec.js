import { expect } from "chai";
import sinon from "sinon";
import { Flags } from "@oclif/core";
import BaseCommand from "../../src/BaseCommand.js";
import AuthLogin from "../../src/commands/auth/login.js";
import { makeLogger } from "../helpers.js";
import { TELEMETRY_NOTICE } from "../../src/services/telemetry/AccTelemetry.js";

describe("BaseCommand", () => {
  describe("finally", () => {
    let cmd, logger;

    beforeEach(() => {
      cmd = new AuthLogin([], {});
      logger = makeLogger();
      cmd._logger = logger;
    });

    it("logs a final cache stats snapshot when the auth client is available", async () => {
      cmd._auth = {
        client: {
          _entityCache: {
            _stats: {
              reads: 3,
              writes: 1,
              removals: 0,
              clears: 0,
              memoryHits: 2,
              storageHits: 0,
              loads: 0,
              saves: 1,
            },
          },
        },
      };

      await cmd.finally(undefined);

      expect(
        logger.verbose.calledWith(
          "CACHE-Stats📊 entityCache reads=3 writes=1 removals=0 clears=0 memoryHits=2 storageHits=0 loads=0 saves=1",
        ),
      ).to.be.true;
    });

    it("does nothing when auth was never used", async () => {
      await cmd.finally(undefined);

      expect(logger.verbose.called).to.be.false;
    });

    it("does nothing when auth exists but login never set a client", async () => {
      cmd._auth = {};

      await cmd.finally(undefined);

      expect(logger.verbose.called).to.be.false;
    });

    it("still logs stats when the command failed", async () => {
      cmd._auth = {
        client: {
          _optionCache: {
            _stats: {
              reads: 1,
              writes: 0,
              removals: 0,
              clears: 0,
              memoryHits: 1,
              storageHits: 0,
              loads: 0,
              saves: 0,
            },
          },
        },
      };

      await cmd.finally(new Error("boom"));

      expect(
        logger.verbose.calledWith(
          "CACHE-Stats📊 optionCache reads=1 writes=0 removals=0 clears=0 memoryHits=1 storageHits=0 loads=0 saves=0",
        ),
      ).to.be.true;
    });

    afterEach(() => sinon.restore());
  });

  describe("trackUsage", () => {
    let cmd, logger;

    // Stands for the oclif config: parse() for telemetry trackUsage
    const config = {
      version: "1.9.0",
      runHook: async () => ({ successes: [] }),
    };

    // A short and a long flag, as the instance commands have
    class FlagCommand extends BaseCommand {
      static flags = { alias: Flags.string({ char: "a" }) };
      static enableJsonFlag = true;
    }

    beforeEach(() => {
      cmd = new FlagCommand(["--json", "-a", "staging"], config);
      cmd.id = "auth:list";
      logger = makeLogger();
      cmd._logger = logger;
    });

    afterEach(() => sinon.restore());

    // Stands for AccTelemetry: isNull() tells whether the notice is due
    const makeTelemetry = (isNull = false) => ({
      track: sinon.stub(),
      lib: { isNull: () => isNull },
    });

    it("sends the command call without flag values nor outcome", async () => {
      cmd._telemetry = makeTelemetry();
      const { track } = cmd._telemetry;

      await cmd.parse(FlagCommand);
      cmd.trackUsage();

      const event = track.firstCall.args[0];
      expect(event).to.include({
        command: "auth:list",
        flags: "json,alias",
        cliVersion: cmd.config.version,
      });
      expect(event).to.have.all.keys(
        "command",
        "flags",
        "durationMs",
        "cliVersion",
      );
      expect(logger.warn.called).to.be.false;
    });

    it("sends no flag when the command failed before parsing", () => {
      cmd._telemetry = makeTelemetry();
      const { track } = cmd._telemetry;

      cmd.trackUsage();

      expect(track.firstCall.args[0].flags).to.equal("");
    });

    it("tracks a failed command through finally", async () => {
      cmd._telemetry = makeTelemetry();
      const { track } = cmd._telemetry;

      await cmd.finally(new Error("boom"));

      expect(track.calledOnce).to.be.true;
    });

    it("shows the notice on the first run", () => {
      cmd._telemetry = makeTelemetry(true);

      cmd.trackUsage();

      expect(logger.warn.calledWith(TELEMETRY_NOTICE)).to.be.true;
      expect(cmd._telemetry.track.firstCall.args[1]).to.be.true;
    });

    it("never fails the command", () => {
      cmd._telemetry = makeTelemetry();
      cmd._telemetry.track.throws(new Error("EACCES"));

      expect(() => cmd.trackUsage()).to.not.throw();
    });

    it("builds the telemetry service lazily", () => {
      expect(cmd.telemetry).to.equal(cmd.telemetry);
    });
  });
});
