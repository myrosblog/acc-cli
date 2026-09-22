import { expect } from "chai";
import sinon from "sinon";
import AuthLogin from "../../src/commands/auth/login.js";
import { makeLogger } from "../helpers.js";

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
});
