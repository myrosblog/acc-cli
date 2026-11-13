// node
import fs from "node:fs";
import os from "node:os";
import { join } from "node:path";
// npm
import { expect } from "chai";
import sinon from "sinon";
// helpers
import { makeLogger } from "../../../helpers.js";

// acc
import AccInstanceWatch from "../../../../src/services/instance/AccInstanceWatch.js";
import { getDecomposedSchemas } from "../../../../src/helpers/watchTargets.js";

// Test configuration with decomposed schemas
const testConfig = {
  schemas: [
    {
      schemaId: "xtk:javascript",
      filename: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
      decompose: {
        data: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
      },
    },
    {
      schemaId: "xtk:jst",
      filename:
        "/Admin/Config/JavaScript templates/{@namespace}/{@name}.meta.xml",
      decompose: {
        code: "/Admin/Config/JavaScript templates/{@namespace}/{@name}.js",
      },
    },
    {
      schemaId: "nms:delivery",
      filename: "/Campaign Management/Deliveries/{@internalName}.meta.xml",
      decompose: {
        "content/html/source":
          "/Campaign Management/Deliveries/{@internalName}.html",
        "content/text/source":
          "/Campaign Management/Deliveries/{@internalName}.txt",
      },
    },
    {
      schemaId: "xtk:folder",
      filename: "/Explorer/{@name}.meta.xml",
      // No decompose - should be filtered out
    },
  ],
};

// Test configuration with NO decomposed schemas
const testConfigNoDecompose = {
  schemas: [
    {
      schemaId: "xtk:folder",
      filename: "/Explorer/{@name}.meta.xml",
    },
  ],
};

describe("AccInstanceWatch", () => {
  let projectPath, mockLogger, mockPush, watcher, cliOptions;

  beforeEach(() => {
    // temp folder for the watch path, to avoid polluting the real cwd
    projectPath = fs.mkdtempSync(join(os.tmpdir(), "acc-watch-"));
    mockLogger = makeLogger();
    // The push itself is covered by AccInstancePush.spec.js
    mockPush = { push: sinon.stub().resolves() };
    cliOptions = { path: projectPath };

    watcher = new AccInstanceWatch(
      mockLogger,
      testConfig,
      cliOptions,
      mockPush,
    );
  });

  afterEach(() => {
    fs.rmSync(projectPath, { recursive: true, force: true });
    sinon.restore();
  });

  describe("Constructor", () => {
    it("should initialize with provided dependencies", () => {
      expect(watcher.logger).to.equal(mockLogger);
      expect(watcher.accConfig).to.equal(testConfig);
      expect(watcher.watchPath).to.equal(projectPath);
      expect(watcher.accInstancePush).to.equal(mockPush);
    });

    it("should use process.cwd() when no path provided", () => {
      const watcherNoPath = new AccInstanceWatch(
        mockLogger,
        testConfig,
        {},
        mockPush,
      );
      expect(watcherNoPath.watchPath).to.equal(process.cwd());
    });

    it("should warn that watch is in early access", () => {
      expect(mockLogger.warn).to.have.been.calledWithMatch(/early access/);
    });
  });

  describe("_buildWatchList", () => {
    it("should build the targets of the decomposed schemas", () => {
      const watchTargets = watcher._buildWatchList(
        getDecomposedSchemas(testConfig.schemas),
      );

      // 1 xtk:javascript + 1 xtk:jst + 2 nms:delivery
      expect(watchTargets).to.have.lengthOf(4);
    });

    it("should log each target with its schema and xpath", () => {
      watcher._buildWatchList(getDecomposedSchemas(testConfig.schemas));

      expect(mockLogger.verbose).to.have.callCount(4);
      expect(mockLogger.verbose).to.have.been.calledWith(
        "  Schema nms:delivery: watching Campaign Management/Deliveries/*.html (xpath: content/html/source)",
      );
    });
  });

  describe("startWatching and stopWatching", () => {
    let chokidarStub, mockChokidarWatcher;

    beforeEach(() => {
      // Create mock chokidar
      mockChokidarWatcher = {
        on: sinon.stub().returnsThis(),
        close: sinon.stub().resolves({}),
      };

      chokidarStub = {
        default: {
          watch: sinon.stub().returns(mockChokidarWatcher),
        },
      };

      // Stub the dynamic import of chokidar
      sinon.stub(watcher, "_importChokidar").resolves(chokidarStub);
    });

    /**
     * Event handlers registered on the chokidar watcher, by event name.
     * @returns {object} the handlers
     */
    const getHandlers = () =>
      Object.fromEntries(
        mockChokidarWatcher.on.getCalls().map((call) => call.args),
      );

    it("should throw if already running", async () => {
      watcher.isRunning = true;

      await expect(watcher.startWatching()).to.be.rejectedWith(
        /already running/,
      );
    });

    it("should throw if no decomposed schemas found", async () => {
      const watcherNoDecompose = new AccInstanceWatch(
        mockLogger,
        testConfigNoDecompose,
        cliOptions,
        mockPush,
      );

      await expect(watcherNoDecompose.startWatching()).to.be.rejectedWith(
        /No schemas with 'decompose'/,
      );
    });

    it("should watch relative patterns from the watch path", async () => {
      await watcher.startWatching();

      const [patterns, options] = chokidarStub.default.watch.firstCall.args;
      expect(patterns).to.have.members([
        "Admin/Config/JavaScript codes/*/*.js",
        "Admin/Config/JavaScript templates/*/*.js",
        "Campaign Management/Deliveries/*.html",
        "Campaign Management/Deliveries/*.txt",
      ]);
      expect(options.cwd).to.equal(projectPath);
      expect(options.ignoreInitial).to.be.true;
      expect(options.ignored).to.include("**/dist/**");
      expect(watcher.isRunning).to.be.true;
    });

    it("should apply the debounce time to awaitWriteFinish", async () => {
      await watcher.startWatching(750);

      const [, options] = chokidarStub.default.watch.firstCall.args;
      expect(options.awaitWriteFinish.stabilityThreshold).to.equal(750);
    });

    it("should stop watching and clear the targets", async () => {
      await watcher.startWatching();
      await watcher.stopWatching();

      expect(mockChokidarWatcher.close).to.have.been.calledOnce;
      expect(watcher.isRunning).to.be.false;
      expect(watcher.watchTargets).to.have.lengthOf(0);
    });

    it("should do nothing when stopping a watcher that never started", async () => {
      await watcher.stopWatching();
      expect(mockChokidarWatcher.close).to.not.have.been.called;
    });

    it("should warn and give up when no pattern could be built", async () => {
      sinon.stub(watcher, "_buildWatchList").returns([]);

      await watcher.startWatching();

      expect(mockLogger.warn).to.have.been.calledWithMatch(
        /No decomposed files found to watch/,
      );
      expect(chokidarStub.default.watch).to.not.have.been.called;
      expect(watcher.isRunning).to.be.false;
    });

    it("should report a missing chokidar dependency", async () => {
      const importError = new Error("Cannot find package 'chokidar'");
      watcher._importChokidar.rejects(importError);

      await expect(watcher.startWatching()).to.be.rejectedWith(importError);
      expect(mockLogger.error).to.have.been.calledWithMatch(
        /npm install chokidar/,
      );
    });

    it("should push each added or changed file", async () => {
      await watcher.startWatching();

      const handlers = getHandlers();
      handlers.add("a.js");
      handlers.change("b.js");

      expect(mockPush.push).to.have.been.calledTwice;
      expect(mockPush.push).to.have.been.calledWith("a.js");
      expect(mockPush.push).to.have.been.calledWith("b.js");
    });

    it("should log a deleted file without pushing it", async () => {
      await watcher.startWatching();

      getHandlers().unlink("Campaign Management/Deliveries/DM42.html");

      expect(mockLogger.verbose).to.have.been.calledWith(
        "DM42.html: File deleted",
      );
      expect(mockPush.push).to.not.have.been.called;
    });

    it("should log a watcher error", async () => {
      await watcher.startWatching();

      getHandlers().error(new Error("EMFILE"));

      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Watcher error: EMFILE/,
      );
    });
  });
});
