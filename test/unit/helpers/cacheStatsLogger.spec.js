// npm
import { expect } from "chai";
// acc
import logCacheStats from "../../../src/helpers/cacheStatsLogger.js";
import { makeLogger } from "../../helpers.js";

const makeCache = (stats) => ({ _stats: stats });

describe("logCacheStats", function () {
  let logger;

  beforeEach(function () {
    logger = makeLogger();
  });

  it("logs one verbose line per cache with all counters", function () {
    const client = {
      _entityCache: makeCache({
        reads: 1,
        writes: 2,
        removals: 3,
        clears: 4,
        memoryHits: 5,
        storageHits: 6,
        loads: 7,
        saves: 8,
      }),
      _methodCache: makeCache({
        reads: 10,
        writes: 20,
        removals: 30,
        clears: 40,
        memoryHits: 50,
        storageHits: 60,
        loads: 70,
        saves: 80,
      }),
      _optionCache: makeCache({
        reads: 0,
        writes: 0,
        removals: 0,
        clears: 0,
        memoryHits: 0,
        storageHits: 0,
        loads: 0,
        saves: 0,
      }),
    };

    logCacheStats(logger, client);

    expect(logger.verbose.calledThrice).to.be.true;
    expect(logger.verbose.firstCall.args[0]).to.equal(
      "CACHE-Stats📊 entityCache reads=1 writes=2 removals=3 clears=4 memoryHits=5 storageHits=6 loads=7 saves=8",
    );
    expect(logger.verbose.secondCall.args[0]).to.equal(
      "CACHE-Stats📊 methodCache reads=10 writes=20 removals=30 clears=40 memoryHits=50 storageHits=60 loads=70 saves=80",
    );
    expect(logger.verbose.thirdCall.args[0]).to.equal(
      "CACHE-Stats📊 optionCache reads=0 writes=0 removals=0 clears=0 memoryHits=0 storageHits=0 loads=0 saves=0",
    );
  });

  it("skips caches that are missing", function () {
    const client = {
      _entityCache: undefined,
      _methodCache: makeCache({
        reads: 1,
        writes: 0,
        removals: 0,
        clears: 0,
        memoryHits: 0,
        storageHits: 0,
        loads: 0,
        saves: 0,
      }),
      _optionCache: undefined,
    };

    logCacheStats(logger, client);

    expect(logger.verbose.calledOnce).to.be.true;
    expect(logger.verbose.firstCall.args[0]).to.include("methodCache");
  });

  it("skips caches that have no _stats", function () {
    const client = {
      _entityCache: {},
      _methodCache: {},
      _optionCache: {},
    };

    logCacheStats(logger, client);

    expect(logger.verbose.called).to.be.false;
  });
});
