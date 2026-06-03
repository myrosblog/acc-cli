// npm
import { expect } from "chai";
import tmp from "tmp";
// acc
import makeLogger from "../../../src/helpers/makeLogger.js";

// Reach into the AioLogger -> WinstonLogger -> winston logger to inspect wiring.
const winstonTransports = (logger) => logger.logger.logger.transports;

describe("makeLogger", function () {
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env.ACC_NO_FILE_LOG;
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.ACC_NO_FILE_LOG;
    else process.env.ACC_NO_FILE_LOG = savedEnv;
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
