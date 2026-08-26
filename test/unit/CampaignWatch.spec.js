// node
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
import { makeLogger, makeSpinner, makeClient, makeSchema } from "../helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// acc
import CampaignWatch from "../../src/CampaignWatch.js";

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

// An entity schema as the SDK returns it: an internal key on @id, an external
// key on @name + @namespace
const javascriptSchemaXml = `<schema namespace="xtk" name="javascript">
  <element name="javascript">
    <key name="id" internal="true"><keyfield xpath="@id"/></key>
    <key name="name"><keyfield xpath="@name"/><keyfield xpath="@namespace"/></key>
    <attribute name="id" type="long"/>
    <attribute name="name" type="string"/>
    <attribute name="namespace" type="string"/>
  </element>
</schema>`;

describe("CampaignWatch", () => {
  let mockClient, mockLogger, mockSpinner, watcher, cliOptions;

  beforeEach(() => {
    // mock client
    mockClient = makeClient();
    mockClient.NLWS = {
      xml: {
        xtkSession: {
          write: sinon.stub().resolves({}),
        },
      },
    };

    // mock AioLogger
    mockLogger = makeLogger();

    // mock ora spinner
    mockSpinner = makeSpinner();

    // default cli options
    cliOptions = {
      path: __dirname,
    };

    // create watcher instance
    watcher = new CampaignWatch(
      mockLogger,
      mockClient,
      testConfig,
      cliOptions,
      () => mockSpinner,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Constructor", () => {
    it("should initialize with provided dependencies", () => {
      expect(watcher.logger).to.equal(mockLogger);
      expect(watcher.client).to.equal(mockClient);
      expect(watcher.accConfig).to.equal(testConfig);
      expect(watcher.watchPath).to.equal(__dirname);
    });

    it("should use process.cwd() when no path provided", () => {
      const watcherNoPath = new CampaignWatch(
        mockLogger,
        mockClient,
        testConfig,
        {},
        () => mockSpinner,
      );
      expect(watcherNoPath.watchPath).to.equal(process.cwd());
    });
  });

  describe("_getDecomposedSchemas", () => {
    it("should return only schemas with decompose configuration", () => {
      const decomposed = watcher._getDecomposedSchemas();
      expect(decomposed).to.have.lengthOf(3);
      expect(decomposed.map((s) => s.schemaId)).to.include.members([
        "xtk:javascript",
        "xtk:jst",
        "nms:delivery",
      ]);
    });

    it("should return empty array when no schemas have decompose", () => {
      const watcherNoDecompose = new CampaignWatch(
        mockLogger,
        mockClient,
        testConfigNoDecompose,
        cliOptions,
        () => mockSpinner,
      );
      const decomposed = watcherNoDecompose._getDecomposedSchemas();
      expect(decomposed).to.have.lengthOf(0);
    });

    it("should handle empty decompose object", () => {
      const configWithEmptyDecompose = {
        schemas: [
          {
            schemaId: "xtk:javascript",
            filename:
              "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
            decompose: {},
          },
        ],
      };
      const watcherEmpty = new CampaignWatch(
        mockLogger,
        mockClient,
        configWithEmptyDecompose,
        cliOptions,
        () => mockSpinner,
      );
      const decomposed = watcherEmpty._getDecomposedSchemas();
      expect(decomposed).to.have.lengthOf(0);
    });
  });

  describe("_convertTemplateToGlob", () => {
    it("should convert simple template to glob", () => {
      const result = watcher._convertTemplateToGlob("/path/to/{@name}.js");
      expect(result).to.equal("path/to/*.js");
    });

    it("should convert template with namespace to glob", () => {
      const result = watcher._convertTemplateToGlob(
        "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
      );
      expect(result).to.equal("Admin/Config/JavaScript codes/*/*.js");
    });

    it("should convert template without @ prefix to glob", () => {
      const result = watcher._convertTemplateToGlob("/path/to/{name}.js");
      expect(result).to.equal("path/to/*.js");
    });
  });

  describe("_buildWatchList", () => {
    it("should build one target per decompose entry", () => {
      const decomposedSchemas = watcher._getDecomposedSchemas();
      const watchTargets = watcher._buildWatchList(decomposedSchemas);

      // 1 xtk:javascript + 1 xtk:jst + 2 nms:delivery
      expect(watchTargets).to.have.lengthOf(4);
      expect(watchTargets.map((target) => target.pattern)).to.have.members([
        "Admin/Config/JavaScript codes/*/*.js",
        "Admin/Config/JavaScript templates/*/*.js",
        "Campaign Management/Deliveries/*.html",
        "Campaign Management/Deliveries/*.txt",
      ]);
    });

    it("should carry the schema config and xpath of each entry", () => {
      const decomposedSchemas = watcher._getDecomposedSchemas();
      const watchTargets = watcher._buildWatchList(decomposedSchemas);

      const htmlTarget = watchTargets.find((target) =>
        target.pattern.endsWith(".html"),
      );
      expect(htmlTarget.schemaConfig.schemaId).to.equal("nms:delivery");
      expect(htmlTarget.xpath).to.equal("content/html/source");
    });

    it("should build patterns relative to the watch path", () => {
      const decomposedSchemas = watcher._getDecomposedSchemas();
      const watchTargets = watcher._buildWatchList(decomposedSchemas);

      watchTargets.forEach(({ pattern }) => {
        expect(pattern).to.not.include(__dirname);
        expect(pattern.startsWith("/")).to.be.false;
      });
    });
  });

  describe("_findSchemaForFile", () => {
    beforeEach(() => {
      watcher.watchTargets = watcher._buildWatchList(
        watcher._getDecomposedSchemas(),
      );
    });

    it("should find the schema and xpath for a matching file", () => {
      const result = watcher._findSchemaForFile(
        "Admin/Config/JavaScript codes/cus/myScript.js",
      );

      expect(result.schemaConfig.schemaId).to.equal("xtk:javascript");
      expect(result.xpath).to.equal("data");
    });

    it("should discriminate two xpaths of the same schema by extension", () => {
      const html = watcher._findSchemaForFile(
        "Campaign Management/Deliveries/DM42.html",
      );
      const text = watcher._findSchemaForFile(
        "Campaign Management/Deliveries/DM42.txt",
      );

      expect(html.xpath).to.equal("content/html/source");
      expect(text.xpath).to.equal("content/text/source");
    });

    it("should match filenames containing glob metacharacters", () => {
      // Record values are not glob-escaped on pull, so "[" reaches the filesystem
      const result = watcher._findSchemaForFile(
        "Campaign Management/Deliveries/promo[2024].html",
      );

      expect(result.schemaConfig.schemaId).to.equal("nms:delivery");
    });

    it("should accept native path separators", () => {
      const result = watcher._findSchemaForFile(
        join("Admin", "Config", "JavaScript codes", "cus", "myScript.js"),
      );

      expect(result.schemaConfig.schemaId).to.equal("xtk:javascript");
    });

    it("should not let a single wildcard cross a directory", () => {
      const result = watcher._findSchemaForFile(
        "Campaign Management/Deliveries/2024/DM42.html",
      );

      expect(result).to.be.null;
    });

    it("should return null for non-matching file path", () => {
      expect(watcher._findSchemaForFile("some/random/path/file.js")).to.be.null;
    });

    it("should return null when no watch list was built", () => {
      watcher.watchTargets = [];
      expect(
        watcher._findSchemaForFile("Admin/Config/JavaScript codes/cus/a.js"),
      ).to.be.null;
    });

    it("should warn when several patterns claim the same file", () => {
      const ambiguousConfig = {
        schemas: [
          {
            schemaId: "xtk:javascript",
            filename: "/Shared/{@name}.meta.xml",
            decompose: { data: "/Shared/{@name}.js" },
          },
          {
            schemaId: "xtk:jst",
            filename: "/Shared/{@name}.meta.xml",
            decompose: { code: "/Shared/{@name}.js" },
          },
        ],
      };
      const ambiguousWatcher = new CampaignWatch(
        mockLogger,
        mockClient,
        ambiguousConfig,
        cliOptions,
        () => mockSpinner,
      );
      ambiguousWatcher.watchTargets = ambiguousWatcher._buildWatchList(
        ambiguousWatcher._getDecomposedSchemas(),
      );

      const result = ambiguousWatcher._findSchemaForFile("Shared/both.js");

      expect(result.schemaConfig.schemaId).to.equal("xtk:javascript");
      expect(mockLogger.warn).to.have.been.calledWithMatch(
        /matches 2 decompose patterns/,
      );
    });
  });

  describe("_getMetaFilePath", () => {
    it("should generate meta file path from decomposed file path", () => {
      const metaFilename =
        "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml";
      const decomposedFilePath = join("some", "path", "cus", "myScript.js");

      const result = watcher._getMetaFilePath(decomposedFilePath, metaFilename);

      // Should replace .js with .meta.xml in the same directory
      expect(result).to.equal(join("some", "path", "cus", "myScript.meta.xml"));
    });

    it("should handle files with multiple dots in name", () => {
      const metaFilename = "/path/to/{@name}.meta.xml";
      const decomposedFilePath = join("some", "path", "my.file.js");

      const result = watcher._getMetaFilePath(decomposedFilePath, metaFilename);

      expect(result).to.equal(join("some", "path", "my.file.meta.xml"));
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

    it("should throw if already running", async () => {
      watcher.isRunning = true;

      try {
        await watcher.startWatching();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("already running");
      }
    });

    it("should throw if no decomposed schemas found", async () => {
      const watcherNoDecompose = new CampaignWatch(
        mockLogger,
        mockClient,
        testConfigNoDecompose,
        cliOptions,
        () => mockSpinner,
      );

      try {
        await watcherNoDecompose.startWatching();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.message).to.include("No schemas with 'decompose'");
      }
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
      expect(options.cwd).to.equal(__dirname);
      expect(options.ignoreInitial).to.be.true;
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

    it("should route add and change events to _onFileChange", async () => {
      const onFileChange = sinon.stub(watcher, "_onFileChange").resolves();
      await watcher.startWatching();

      const handlers = Object.fromEntries(
        mockChokidarWatcher.on.getCalls().map((call) => call.args),
      );
      handlers.add("a.js");
      handlers.change("b.js");

      expect(onFileChange).to.have.been.calledTwice;
      expect(onFileChange).to.have.been.calledWith("a.js");
      expect(onFileChange).to.have.been.calledWith("b.js");
    });

    it("should log a deleted file without pushing it", async () => {
      await watcher.startWatching();

      const handlers = Object.fromEntries(
        mockChokidarWatcher.on.getCalls().map((call) => call.args),
      );
      handlers.unlink("Campaign Management/Deliveries/DM42.html");

      expect(mockLogger.verbose).to.have.been.calledWithMatch(/File deleted/);
      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
    });

    it("should survive a watcher error raised before any file change", async () => {
      await watcher.startWatching();

      const handlers = Object.fromEntries(
        mockChokidarWatcher.on.getCalls().map((call) => call.args),
      );
      // No spinner exists yet: the handler must not throw on it
      handlers.error(new Error("EMFILE"));

      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Watcher error: EMFILE/,
      );
    });
  });

  describe("_getMetadataDocument", () => {
    let tempDir;

    beforeEach(async () => {
      // Create a temporary directory for test files
      tempDir = join(__dirname, "../dist/campaignWatcherTest");
      await fs.ensureDir(tempDir);

      // Create a meta file
      const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
        <javascript id="123" name="testScript" namespace="cus">
          <data></data>
        </javascript>`;
      await fs.writeFile(join(tempDir, "testScript.meta.xml"), metaXml);

      // Create a decomposed file
      await fs.writeFile(
        join(tempDir, "testScript.js"),
        "const test = 'hello';",
      );

      // _getMetadataDocument reports progress on the spinner started by _onFileChange
      watcher.spinner = mockSpinner;
    });

    afterEach(async () => {
      // Clean up
      await fs.remove(tempDir).catch(() => {});
    });

    it("should return the parsed meta document", async () => {
      const schemaConfig = testConfig.schemas[0]; // xtk:javascript
      const filePath = join(tempDir, "testScript.js");

      const result = await watcher._getMetadataDocument(
        schemaConfig,
        filePath,
        "data",
        "const test = 'hello';",
      );

      expect(result).to.not.be.null;
      const rootElement = result.documentElement;
      expect(rootElement.tagName).to.equal("javascript");
      expect(rootElement.getAttribute("id")).to.equal("123");
      expect(rootElement.getAttribute("namespace")).to.equal("cus");
    });

    it("should throw if meta file not found", async () => {
      const schemaConfig = testConfig.schemas[0];

      try {
        await watcher._getMetadataDocument(
          schemaConfig,
          "/nonexistent/path/file.js",
          "data",
          "const test = 'hello';",
        );
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.code).to.equal("INSTANCE_WATCH_META_FILE_MISSING");
        expect(err.message).to.include("file.meta.xml");
      }
    });

    it("should return the meta document even when the xpath is absent", async () => {
      // A meta file without the target node: the xpath is only used to build the payload
      const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
        <javascript id="123" name="testScript" namespace="cus">
        </javascript>`;
      await fs.writeFile(join(tempDir, "noData.meta.xml"), metaXml);

      const result = await watcher._getMetadataDocument(
        testConfig.schemas[0],
        join(tempDir, "noData.js"),
        "nonexistent",
        "const test = 'hello';",
      );

      expect(result.documentElement.tagName).to.equal("javascript");
    });
  });

  describe("_getWriteKey", () => {
    const parseMeta = (xml) => DomUtil.parse(xml).documentElement;

    it("should reconcile on the internal key over the external one", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(
        `<javascript id="456" name="myScript" namespace="cus"/>`,
      );

      const { key, keyValues } = watcher._getWriteKey(schema, rootElement);

      expect(key.name).to.equal("id");
      expect(key.isInternal).to.be.true;
      expect(keyValues).to.deep.equal([
        { xpath: "@id", attributeName: "id", value: "456" },
      ]);
    });

    it("should use the external key when the schema has no internal one", () => {
      const schema = makeSchema(`<schema namespace="xtk" name="javascript">
        <element name="javascript">
          <key name="name"><keyfield xpath="@name"/><keyfield xpath="@namespace"/></key>
          <attribute name="name" type="string"/>
          <attribute name="namespace" type="string"/>
        </element>
      </schema>`);
      const rootElement = parseMeta(
        `<javascript name="myScript" namespace="cus"/>`,
      );

      const { key, keyValues } = watcher._getWriteKey(schema, rootElement);

      expect(key.name).to.equal("name");
      expect(key.isInternal).to.be.false;
      // composite fields, in keyfield order
      expect(keyValues.map(({ value }) => value)).to.deep.equal([
        "myScript",
        "cus",
      ]);
    });

    it("should throw when the key attribute is absent", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(
        `<javascript name="myScript" namespace="cus"/>`,
      );

      expect(() => watcher._getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "id"/,
      );
    });

    it("should throw when the key attribute is empty", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(
        `<javascript id="" name="myScript" namespace="cus"/>`,
      );

      expect(() => watcher._getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "id"/,
      );
    });

    it("should resolve a keyfield nested under an element", () => {
      const schema = makeSchema(`<schema namespace="nms" name="delivery">
        <element name="delivery">
          <key name="content"><keyfield xpath="content/@code"/></key>
          <element name="content"><attribute name="code" type="string"/></element>
        </element>
      </schema>`);
      const rootElement = parseMeta(
        `<delivery><content code="DM123"/></delivery>`,
      );

      const { keyValues } = watcher._getWriteKey(schema, rootElement);

      expect(keyValues).to.deep.equal([
        { xpath: "content/@code", attributeName: "code", value: "DM123" },
      ]);
    });

    it("should reject a key whose keyfield is an element", () => {
      const schema = makeSchema(`<schema namespace="cus" name="thing">
        <element name="thing">
          <key name="byElement"><keyfield xpath="label"/></key>
          <element name="label" type="string"/>
        </element>
      </schema>`);
      const rootElement = parseMeta(`<thing><label>hello</label></thing>`);

      expect(() => watcher._getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "byElement"/,
      );
    });

    it("should name the schema and the key it could not read", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(`<javascript label="orphan"/>`);

      try {
        watcher._getWriteKey(schema, rootElement);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.code).to.equal("INSTANCE_WATCH_NO_WRITE_KEY");
        expect(err.message).to.include("xtk:javascript");
        expect(err.message).to.include('"id"');
      }
    });

    it("should throw when the schema defines no key at all", () => {
      const schema = makeSchema(`<schema namespace="cus" name="keyless">
        <element name="keyless"><attribute name="id" type="long"/></element>
      </schema>`);
      const rootElement = parseMeta(`<keyless id="1"/>`);

      expect(() => watcher._getWriteKey(schema, rootElement)).to.throw(
        /\(none defined\)/,
      );
    });
  });

  describe("_formatKeyValues", () => {
    it("should render a single field as its bare value", () => {
      const formatted = watcher._formatKeyValues([
        { attributeName: "internalName", value: "DM123" },
      ]);

      expect(formatted).to.equal("DM123");
    });

    it("should render name and namespace as namespace:name", () => {
      const formatted = watcher._formatKeyValues([
        { attributeName: "name", value: "New" },
        { attributeName: "namespace", value: "cus" },
      ]);

      expect(formatted).to.equal("cus:New");
    });

    it("should render namespace:name whatever the keyfield order", () => {
      const formatted = watcher._formatKeyValues([
        { attributeName: "namespace", value: "cus" },
        { attributeName: "name", value: "New" },
      ]);

      expect(formatted).to.equal("cus:New");
    });

    it("should join any other composite key with a comma", () => {
      const formatted = watcher._formatKeyValues([
        { attributeName: "internalName", value: "DM123" },
        { attributeName: "messageType", value: "email" },
      ]);

      expect(formatted).to.equal("DM123, email");
    });
  });

  describe("Integration: File change flow", () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = join(__dirname, "../dist/campaignWatcherIntegration");
      await fs.ensureDir(tempDir);

      // Pull writes the decomposed files under the template directory
      const scriptDir = join(
        tempDir,
        "Admin",
        "Config",
        "JavaScript codes",
        "test",
      );
      await fs.ensureDir(scriptDir);

      const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
        <javascript id="456" name="integrationTest" namespace="test">
          <data></data>
        </javascript>`;
      await fs.writeFile(join(scriptDir, "integrationTest.meta.xml"), metaXml);
      await fs.writeFile(join(scriptDir, "integrationTest.js"), "// initial");

      mockClient.application = {
        getSchema: sinon.stub().resolves(makeSchema(javascriptSchemaXml)),
      };

      // Create watcher rooted on the temp dir
      cliOptions = { path: tempDir };
      watcher = new CampaignWatch(
        mockLogger,
        mockClient,
        testConfig,
        cliOptions,
        () => mockSpinner,
      );
      watcher.watchTargets = watcher._buildWatchList(
        watcher._getDecomposedSchemas(),
      );
    });

    afterEach(async () => {
      await fs.remove(tempDir).catch(() => {});
    });

    it("should push the changed content to the server", async () => {
      const relativePath =
        "Admin/Config/JavaScript codes/test/integrationTest.js";
      await fs.writeFile(join(tempDir, relativePath), "// updated content");

      await watcher._onFileChange(relativePath);

      expect(mockClient.NLWS.xml.xtkSession.write).to.have.been.calledOnce;
      const payload = mockClient.NLWS.xml.xtkSession.write.firstCall.args[0];
      const xml = DomUtil.toXMLString(payload.documentElement);
      expect(xml).to.include('xtkschema="xtk:javascript"');
      expect(xml).to.include('_operation="update"');
      expect(xml).to.include("// updated content");
      // Reconciled on the internal key only
      expect(xml).to.include('_key="@id"');
      expect(xml).to.include('id="456"');
      expect(xml).to.not.include("namespace=");
    });

    it("should push a composite key as _key and both attributes", async () => {
      mockClient.application.getSchema.resolves(
        makeSchema(`<schema namespace="xtk" name="javascript">
          <element name="javascript">
            <key name="name"><keyfield xpath="@name"/><keyfield xpath="@namespace"/></key>
            <attribute name="name" type="string"/>
            <attribute name="namespace" type="string"/>
          </element>
        </schema>`),
      );

      await watcher._onFileChange(
        "Admin/Config/JavaScript codes/test/integrationTest.js",
      );

      const payload = mockClient.NLWS.xml.xtkSession.write.firstCall.args[0];
      const xml = DomUtil.toXMLString(payload.documentElement);
      expect(xml).to.include('_key="@name,@namespace"');
      expect(xml).to.include('name="integrationTest"');
      expect(xml).to.include('namespace="test"');
      expect(xml).to.not.include("id=");
    });

    it("should report a meta file that cannot supply the key", async () => {
      await fs.writeFile(
        join(
          tempDir,
          "Admin/Config/JavaScript codes/test/integrationTest.meta.xml",
        ),
        `<?xml version="1.0" encoding="UTF-8"?>
        <javascript name="integrationTest" namespace="test">
          <data></data>
        </javascript>`,
      );

      await watcher._onFileChange(
        "Admin/Config/JavaScript codes/test/integrationTest.js",
      );

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch(
        /no value for the key "id"/,
      );
    });

    it("should report an unknown schema", async () => {
      mockClient.application.getSchema.resolves(null);

      await watcher._onFileChange(
        "Admin/Config/JavaScript codes/test/integrationTest.js",
      );

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Schema xtk:javascript not found/,
      );
    });

    it("should stop before pushing when the meta file is missing", async () => {
      const relativePath = "Campaign Management/Deliveries/DM42.html";
      await fs.outputFile(join(tempDir, relativePath), "<p>orphan</p>");

      await watcher._onFileChange(relativePath);

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch({
        code: "INSTANCE_WATCH_META_FILE_MISSING",
      });
    });

    it("should report a failed push without throwing", async () => {
      mockClient.NLWS.xml.xtkSession.write.rejects(new Error("SOAP down"));
      const relativePath =
        "Admin/Config/JavaScript codes/test/integrationTest.js";

      await watcher._onFileChange(relativePath);

      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Failed to push integrationTest.js/,
      );
    });

    it("should skip a file outside the decompose configuration", async () => {
      await fs.writeFile(join(tempDir, "notWatched.js"), "// noise");

      await watcher._onFileChange("notWatched.js");

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch({
        code: "INSTANCE_WATCH_FILE_NOT_IN_SCOPE",
      });
    });
  });
});
