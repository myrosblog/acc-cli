// npm
import { expect } from "chai";
import tmp from "tmp";
// acc
import makeLogger from "../../../src/helpers/makeLogger.js";

// Reach into the AioLogger -> WinstonLogger -> winston logger to inspect wiring.
const winstonTransports = (logger) => logger.logger.logger.transports;

describe("makeLogger", function () {
  let savedEnv, savedLogLevel;

  beforeEach(() => {
    savedEnv = process.env.ACC_NO_FILE_LOG;
    savedLogLevel = process.env.AIO_LOG_LEVEL;
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.ACC_NO_FILE_LOG;
    else process.env.ACC_NO_FILE_LOG = savedEnv;
    if (savedLogLevel === undefined) delete process.env.AIO_LOG_LEVEL;
    else process.env.AIO_LOG_LEVEL = savedLogLevel;
  });

  it("returns a logger exposing the usual levels", () => {
    const logger = makeLogger();
    for (const level of ["error", "warn", "info", "verbose", "debug"]) {
      expect(logger[level]).to.be.a("function");
    }
  });

  it("routes the whole console stream to stderr (stdout stays clean)", () => {
    const logger = makeLogger();
    const consoleT = winstonTransports(logger).find(
      (t) => t.constructor.name === "Console",
    );
    // winston stores stderrLevels as a lookup map; info must be in it.
    expect(consoleT.stderrLevels.info).to.be.true;
    expect(consoleT.stderrLevels.error).to.be.true;
  });

  it("defaults the console level to info when AIO_LOG_LEVEL is unset", () => {
    delete process.env.AIO_LOG_LEVEL;
    const consoleT = winstonTransports(makeLogger()).find(
      (t) => t.constructor.name === "Console",
    );
    expect(consoleT.level).to.equal("info");
  });

  it("takes the console level from AIO_LOG_LEVEL", () => {
    process.env.AIO_LOG_LEVEL = "debug";
    const consoleT = winstonTransports(makeLogger()).find(
      (t) => t.constructor.name === "Console",
    );
    expect(consoleT.level).to.equal("debug");
  });

  it("adds a rotating file transport when a cache dir is given", () => {
    delete process.env.ACC_NO_FILE_LOG;
    const dir = tmp.dirSync({ unsafeCleanup: true }).name;
    const logger = makeLogger(dir);
    const types = winstonTransports(logger).map((t) => t.constructor.name);
    expect(types).to.include.members(["Console", "File"]);
  });

  it("logs to console only when no cache dir is given", () => {
    const logger = makeLogger();
    expect(winstonTransports(logger)).to.have.length(1);
  });

  it("skips the file transport when ACC_NO_FILE_LOG=1", () => {
    process.env.ACC_NO_FILE_LOG = "1";
    const dir = tmp.dirSync({ unsafeCleanup: true }).name;
    const logger = makeLogger(dir);
    expect(winstonTransports(logger)).to.have.length(1);
  });
});
