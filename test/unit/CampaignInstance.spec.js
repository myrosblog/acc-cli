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
import {
  makeClient,
  makeLogger,
  makeSpinner,
  filterSchemas,
} from "../helpers.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const loadJson = (file) => JSON.parse(fs.readFileSync(join(__dirname, file)));
const configPathXml = join(__dirname, "../mocks/acc-js-sdk-xml/");
const loadXml = (file) =>
  DomUtil.getFirstChildElement(
    DomUtil.parse(fs.readFileSync(configPathXml + file)),
  ); // DomUtil.parse returns Document, but all methods use Element, hence the conversion
// mocks
const configDefaultFull = loadJson("../../src/templates/acc.config.json");
const xtkSqlCreatedb = loadXml("xtk/sql/createdb.sql.xml");
const xtkSchemaDelivery = loadXml("xtk/srcSchema/nms-delivery.xml");
const xtkOlapCubes1 = loadXml("xtk/olapCube/olapCubes.1.xml");
const xtkOlapCubes2 = loadXml("xtk/olapCube/olapCubes.2.xml");
const xtkOlapCubes3 = loadXml("xtk/olapCube/olapCubes.3.xml");
// empty collection, as the server returns it past the last record (see Fiddler:
// <delivery-collection/>); getChildElements() yields []
const xtkOlapCubesEmpty = DomUtil.getFirstChildElement(
  DomUtil.parse("<olapCube-collection/>"),
);
const nmsDelivery554 = loadXml("nms/delivery/DM554.xml");
const nmsViewSubscription = loadXml("nms/includeView/SubscriptionLink.xml");
const nmsDeliveryMappingsRecipientAndSubscribe = loadXml(
  "nms/deliveryMapping/recipientAndSubscribe.xml",
);
// acc
import CampaignInstance from "../../src/CampaignInstance.js";

describe("CampaignInstance", () => {
  let mockClient,
    mockLogger,
    mockSpinner,
    instance,
    pathFull,
    optionsFull,
    adapterExecuteQueryStub;

  beforeEach(() => {
    // mock client
    mockClient = makeClient();

    // options template
    pathFull = join(__dirname, "../dist/configFull/");

    // mock options
    optionsFull = {
      path: pathFull,
    };

    // mock AioLogger
    mockLogger = makeLogger();

    // mock ora spinner
    mockSpinner = () => makeSpinner();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Private methods", () => {
    it("_getQueryDefForSchema: adds where.condition for nms:deliveryMapping", () => {
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
      );
      const base = {
        schema: "nms:deliveryMapping",
        operation: "select",
        select: { node: [] },
      };
      const result = instance._getQueryDefForSchema(
        configDefaultFull.schemas.find(
          (x) => x.schemaId === "nms:deliveryMapping",
        ),
        base,
      );
      expect(result).to.deep.equal({
        schema: "nms:deliveryMapping",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@builtIn = false" }] },
      });
    });

    it("_getQueryDefForSchema: adds where.condition for xtk:folder", () => {
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
        mockSpinner,
      );
      const base = {
        schema: "xtk:folder",
        operation: "select",
        select: { node: [] },
      };
      const config = {
        schemaId: "xtk:folder",
        filename: "/Explorer/{@name}.meta.xml",
        queryDef: {
          lineCount: 100,
          where: {
            condition: [
              {
                expr: "@builtIn = true",
              },
            ],
          },
        },
      };
      const result = instance._getQueryDefForSchema(config, base);
      expect(result).to.deep.equal({
        lineCount: 100,
        schema: "xtk:folder",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@builtIn = true" }] },
      });
    });

    it("_getQueryDefForSchema: returns base unchanged when schema has no queryDef", () => {
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
      );
      // pick a schema with no queryDef override (e.g. nms:localOrgUnit)
      const schemaWithoutQueryDef = configDefaultFull.schemas.find(
        (x) => !x.queryDef,
      );
      const base = {
        schema: schemaWithoutQueryDef.schemaId,
        operation: "select",
        select: { node: [] },
      };
      const result = instance._getQueryDefForSchema(
        schemaWithoutQueryDef,
        base,
      );
      expect(result).to.deep.equal(base);
    });

    describe("_sanitizeFilenameValue", () => {
      beforeEach(() => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
        );
      });

      it("leaves a clean value untouched", () => {
        expect(instance._sanitizeFilenameValue("myDelivery")).to.equal(
          "myDelivery",
        );
      });

      it("replaces POSIX and Windows path separators", () => {
        expect(instance._sanitizeFilenameValue("a/b\\c")).to.equal("a_b_c");
      });

      it("neutralizes parent-dir refs so they cannot traverse", () => {
        expect(instance._sanitizeFilenameValue("..")).to.equal("__");
        expect(instance._sanitizeFilenameValue(".")).to.equal("_");
        // separators become "_", so "../" can no longer escape the directory
        expect(instance._sanitizeFilenameValue("../../etc")).to.equal(
          ".._.._etc",
        );
      });

      it("strips NUL and control characters", () => {
        expect(instance._sanitizeFilenameValue("a\x00b\x1fc")).to.equal("abc");
      });
    });

    describe("_computeFilename", () => {
      beforeEach(() => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
        );
      });

      const record = (name) =>
        DomUtil.getFirstChildElement(
          DomUtil.parse(`<delivery name="${name}"/>`),
        );

      it("substitutes a clean attribute value", () => {
        expect(
          instance._computeFilename(
            "{@name}.meta.xml",
            ["@name"],
            record("DM42"),
          ),
        ).to.equal("DM42.meta.xml");
      });

      it("keeps subdirectories that come from the template", () => {
        expect(
          instance._computeFilename(
            "/Explorer/{@name}.meta.xml",
            ["@name"],
            record("foo"),
          ),
        ).to.equal("/Explorer/foo.meta.xml");
      });

      it("prevents path traversal injected through the attribute value", () => {
        // a malicious @name must not escape the download directory: every
        // separator becomes "_", so the result stays a single component
        expect(
          instance._computeFilename(
            "{@name}.meta.xml",
            ["@name"],
            record("../../etc/passwd"),
          ),
        ).to.equal(".._.._etc_passwd.meta.xml");
      });

      it("does not interpret $ patterns from the value", () => {
        // record name is XML-escaped; the parsed attribute value is "a$&b"
        expect(
          instance._computeFilename(
            "{@name}.xml",
            ["@name"],
            record("a$&amp;b"),
          ),
        ).to.equal("a$&b.xml");
      });
    });
  });

  describe("check", () => {
    it("should check with basic config (2 nms:deliveryMapping)", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      // init
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );
      // mock query
      adapterExecuteQueryStub.resolves(
        nmsDeliveryMappingsRecipientAndSubscribe,
      );
      // go
      await instance.pull(true);

      expect(instance.pullLogs.length).to.equal(1);
      const pullLog = instance.pullLogs[0];
      expect(pullLog.elements).to.be.of.length(2);
      expect(pullLog.errors).to.be.of.length(0);
      expect(pullLog.parsedFilenames).to.deep.equal([
        "mapRecipient.meta.xml",
        "mapSubscribe.meta.xml",
      ]);
      expect(pullLog.queryDef).to.deep.equal({
        schema: "nms:deliveryMapping",
        operation: "select",
        select: { node: [] },
        lineCount: 20,
        startLine: 0,
        where: { condition: [{ expr: "@builtIn = false" }] },
      });
      expect(pullLog.startTime).to.be.lessThan(pullLog.endTime);
    });

    it("should check with custom lineCount=2 in 3 batches (5 xtk:olapCube)", async () => {
      const config = filterSchemas(configDefaultFull, "xtk:olapCube");
      config.schemas[0].queryDef.lineCount = 2; // force lineCount to 2 to test batching on 5 elements
      // init
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );
      // mock query
      adapterExecuteQueryStub.onFirstCall().resolves(xtkOlapCubes1);
      adapterExecuteQueryStub.onSecondCall().resolves(xtkOlapCubes2);
      adapterExecuteQueryStub.onThirdCall().resolves(xtkOlapCubes3);
      // go
      await instance.pull(true);

      expect(instance.pullLogs.length).to.equal(3);
      // log 1
      const pullLog1 = instance.pullLogs[0];
      expect(pullLog1.elements).to.be.of.length(2);
      expect(pullLog1.errors).to.be.of.length(0);
      expect(pullLog1.parsedFilenames).to.deep.equal([
        "trackinglogrcp.meta.xml",
        "trackingStats.meta.xml",
      ]);
      expect(pullLog1.queryDef).to.deep.equal({
        schema: "xtk:olapCube",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@name NOT LIKE 'xtk%'" }] },
        startLine: 0,
        lineCount: 2,
      });
      expect(pullLog1.startTime).to.be.lessThan(pullLog1.endTime);
      // log 2
      const pullLog2 = instance.pullLogs[1];
      expect(pullLog2.elements).to.be.of.length(2);
      expect(pullLog2.errors).to.be.of.length(0);
      expect(pullLog2.parsedFilenames).to.deep.equal([
        "deliveryLogStats.meta.xml",
        "recipient.meta.xml",
      ]);
      expect(pullLog2.queryDef).to.deep.equal({
        schema: "xtk:olapCube",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@name NOT LIKE 'xtk%'" }] },
        startLine: 2,
        lineCount: 2,
      });
      expect(pullLog2.startTime).to.be.lessThan(pullLog2.endTime);
      // log 3
      const pullLog3 = instance.pullLogs[2];
      expect(pullLog3.elements).to.be.of.length(1);
      expect(pullLog3.errors).to.be.of.length(0);
      expect(pullLog3.parsedFilenames).to.deep.equal([
        "messageCenter.meta.xml",
      ]);
      expect(pullLog3.queryDef).to.deep.equal({
        schema: "xtk:olapCube",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@name NOT LIKE 'xtk%'" }] },
        startLine: 4,
        lineCount: 2,
      });
      expect(pullLog3.startTime).to.be.lessThan(pullLog3.endTime);
    });

    it("should record error in pullLog when adapterCreateAndExecuteQuery rejects", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );

      const sdkError = new Error("SOAP call failed");
      adapterExecuteQueryStub.rejects(sdkError);

      // pull() must not throw — errors are captured in pullLog
      await instance.pull(true);

      expect(instance.pullLogs.length).to.equal(1);
      const pullLog = instance.pullLogs[0];
      expect(pullLog.elements).to.be.of.length(0);
      expect(pullLog.parsedFilenames).to.be.of.length(0);
      expect(pullLog.errors).to.be.of.length(1);
      expect(pullLog.errors[0]).to.equal(sdkError);
    });

    it("should record error in pullLog when adapterCreateAndExecuteQuery rejects", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );

      const sdkError = new Error("SOAP call failed");
      adapterExecuteQueryStub.rejects(sdkError);

      // pull() must not throw — errors are captured in pullLog
      await instance.pull(true);

      expect(instance.pullLogs.length).to.equal(1);
      const pullLog = instance.pullLogs[0];
      expect(pullLog.elements).to.be.of.length(0);
      expect(pullLog.parsedFilenames).to.be.of.length(0);
      expect(pullLog.errors).to.be.of.length(1);
      expect(pullLog.errors[0]).to.equal(sdkError);
    });

    it("should continue pulling next schemas even when one adapter call rejects", async () => {
      // two schemas: first will fail, second will succeed
      const config = filterSchemas(
        configDefaultFull,
        "nms:deliveryMapping",
        "xtk:olapCube",
      );
      // force lineCount=2 on olapCube so the stub sequence is predictable
      const olapCubeConfig = config.schemas.find(
        (x) => x.schemaId === "xtk:olapCube",
      );
      if (olapCubeConfig.queryDef) olapCubeConfig.queryDef.lineCount = 2;

      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );

      // call 1: nms:deliveryMapping batch 1 → error
      adapterExecuteQueryStub.onFirstCall().rejects(new Error("Network error"));
      // call 2: xtk:olapCube batch 1 → 1 record (< lineCount → loop stops)
      adapterExecuteQueryStub.onSecondCall().resolves(xtkOlapCubes3); // has 1 record

      await instance.pull(true);

      // 1 log per batch: 1 failing batch (deliveryMapping) + 1 succeeding (olapCube)
      expect(instance.pullLogs.length).to.equal(2);

      const failLog = instance.pullLogs[0];
      expect(failLog.errors).to.be.of.length(1);
      expect(failLog.elements).to.be.of.length(0);

      const successLog = instance.pullLogs[1];
      expect(successLog.errors).to.be.of.length(0);
      expect(successLog.elements.length).to.be.greaterThan(0);
    });

    it("should skip schemas not listed in --metadata option", async () => {
      const config = filterSchemas(
        configDefaultFull,
        "nms:deliveryMapping",
        "xtk:olapCube",
      );
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        {
          ...optionsFull,
          metadata: "nms:deliveryMapping", // only pull deliveryMapping
        },
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );
      adapterExecuteQueryStub.resolves(
        nmsDeliveryMappingsRecipientAndSubscribe,
      );

      await instance.pull(true);

      // adapter called only once (for deliveryMapping), olapCube skipped
      expect(adapterExecuteQueryStub.callCount).to.equal(1);
      expect(instance.pullLogs.length).to.equal(1);
      expect(instance.pullLogs[0].schemaConfig.schemaId).to.equal(
        "nms:deliveryMapping",
      );
    });

    it("should skip all schemas when --metadata lists an unknown schemaId", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      instance = new CampaignInstance(mockLogger, mockClient, config, {
        ...optionsFull,
        metadata: "xtk:unknown",
      });
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );

      await instance.pull(true);

      expect(adapterExecuteQueryStub.callCount).to.equal(0);
      expect(instance.pullLogs).to.be.of.length(0);
    });

    it("should stop after first batch when it returns fewer than lineCount records", async () => {
      const config = filterSchemas(configDefaultFull, "xtk:olapCube");
      config.schemas[0].queryDef.lineCount = 10;
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );

      // batch 1: only 1 record < lineCount=10 → loop stops immediately
      adapterExecuteQueryStub.onFirstCall().resolves(xtkOlapCubes3); // 1 record

      await instance.pull(true);

      expect(instance.pullLogs.length).to.equal(1);
      expect(adapterExecuteQueryStub.callCount).to.equal(1);
    });

    it("should not journal the trailing empty batch when the total is an exact multiple of lineCount", async () => {
      const config = filterSchemas(configDefaultFull, "xtk:olapCube");
      config.schemas[0].queryDef.lineCount = 2;
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );

      // 2 full batches (2 records each) then, like the console, a trailing
      // empty batch signals end-of-data when the total is a multiple of lineCount.
      adapterExecuteQueryStub.onFirstCall().resolves(xtkOlapCubes1); // 2 records
      adapterExecuteQueryStub.onSecondCall().resolves(xtkOlapCubes2); // 2 records
      adapterExecuteQueryStub.onThirdCall().resolves(xtkOlapCubesEmpty); // 0 records

      await instance.pull(true);

      // the server is queried 3 times (incl. the empty probe at startLine=4)...
      expect(adapterExecuteQueryStub.callCount).to.equal(3);
      // ...but the empty trailing batch is not journaled: only 2 pullLogs
      expect(instance.pullLogs.length).to.equal(2);
      expect(instance.pullLogs[0].queryDef.startLine).to.equal(0);
      expect(instance.pullLogs[1].queryDef.startLine).to.equal(2);
    });

    it("should isolate parse errors: one failing element does not block others", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );
      adapterExecuteQueryStub.resolves(
        nmsDeliveryMappingsRecipientAndSubscribe,
      ); // 2 elements

      // Make parse() throw on the first call only
      const parseStub = sinon.stub(instance, "parse");
      parseStub.onFirstCall().throws(new Error("Parse failure"));
      parseStub.onSecondCall().returns("mapSubscribe.meta.xml");

      await instance.pull(true);

      const pullLog = instance.pullLogs[0];
      expect(pullLog.errors).to.be.of.length(1);
      expect(pullLog.parsedFilenames).to.deep.equal(["mapSubscribe.meta.xml"]);
    });

    it("should reset pullLogs on each pull() call", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );
      adapterExecuteQueryStub.resolves(
        nmsDeliveryMappingsRecipientAndSubscribe,
      );

      await instance.pull(true);
      expect(instance.pullLogs.length).to.equal(1);

      adapterExecuteQueryStub.resolves(
        nmsDeliveryMappingsRecipientAndSubscribe,
      );
      await instance.pull(true);
      // logs from first call must not accumulate
      expect(instance.pullLogs.length).to.equal(1);
    });
  });

  describe("pull", () => {
    it("should not throw when isPreview=false (write mode)", async () => {
      const config = filterSchemas(configDefaultFull, "nms:deliveryMapping");
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        config,
        optionsFull,
        mockSpinner,
      );
      adapterExecuteQueryStub = sinon.stub(
        instance,
        "adapterCreateAndExecuteQuery",
      );
      adapterExecuteQueryStub.resolves(
        nmsDeliveryMappingsRecipientAndSubscribe,
      );

      // Stub fs.outputFileSync to avoid real disk writes in test
      sinon.stub(fs, "outputFileSync");

      await instance.pull(false); // isPreview = false

      expect(instance.pullLogs.length).to.equal(1);
      expect(instance.pullLogs[0].errors).to.be.of.length(0);
    });
  });

  describe("parse", () => {
    describe("should parse with simple config", () => {
      it("xtk:sql", async () => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
          mockSpinner,
        );
        const config = {
          schemaId: "xtk:sql",
          filename:
            "/Administration/Configuration/SQL scripts/{@namespace}/{@name}.sql",
          queryDef: {
            where: {
              condition: [
                {
                  expr: "@namespace NOT IN ('xtk', 'nl', 'ncm','nms', 'sfdc', 'crm', 'acx', 'adb')",
                },
              ],
            },
          },
        };
        instance.parse(xtkSqlCreatedb, config);

        const fileRaw = join(
          pathFull,
          "Administration/Configuration/SQL scripts/xtk/createdb.sql.sql",
        );
        const fileExists = await fs.pathExists(fileRaw);
        expect(fileExists).to.be.true;
        const content = fs.readFileSync(fileRaw, "utf8");
        expect(content).to.contain(
          `<sql xmlns="urn:xtk:queryDef" entitySchema="xtk:sql"`,
        );
        expect(content).to.contain(`md5="ABCDEF" name="createdb.sql"`);
        expect(content).to.contain(`<data><![CDATA[-- comment here`);
        expect(content).to.contain(`CREATE DATABASE $DatabaseName;`);
        expect(content).to.contain(`]]></data></sql>`);
      });

      it("nms:delivery", async () => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
          mockSpinner,
        );
        const config = {
          schemaId: "nms:delivery",
          filename: "/Campaign Management/Deliveries/{@internalName}.html",
          queryDef: {
            where: {
              condition: [{ expr: "@builtIn = false AND @isModel = true" }],
            },
          },
        };
        instance.parse(nmsDelivery554, config);

        const fileRaw = join(
          pathFull,
          "Campaign Management/Deliveries/DM554.html",
        );
        const fileExists = await fs.pathExists(fileRaw);
        expect(fileExists).to.be.true;
        const content = fs.readFileSync(fileRaw, "utf8");
        expect(content).to.contain(`<delivery xtkschema="nms:delivery"`); // main element + attribute
        expect(content).to.contain(`<folder _cs="`); // link
        expect(content).to.contain(`<properties deliveryState="0"`); // element
        expect(content).to.contain(`cryptedId`);

        expect(content).to.contain(`@encrypted`);
        expect(content).to.contain(`<content`); // no decomposition
      });

      it("xtk:srcSchema", async () => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
          mockSpinner,
        );
        const schemaConfig = configDefaultFull.schemas.find(
          (x) => x.schemaId == "xtk:srcSchema",
        );
        instance.parse(xtkSchemaDelivery, schemaConfig);

        const fileRaw = join(
          pathFull,
          "Administration/Configuration/Data schemas/nms/delivery.xml",
        );
        const fileExists = await fs.pathExists(fileRaw);
        expect(fileExists).to.be.true;
        const content = fs.readFileSync(fileRaw, "utf8");
        expect(content).to.contain(
          `<srcSchema name="delivery" namespace="nms"`,
        ); // main element + attribute
        expect(content).to.contain(`<methods>`); // element
      });
    });

    describe("should parse with full config", () => {
      it("xtk:sql (meta)", async () => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
        );
        const schemaConfig = configDefaultFull.schemas.find(
          (x) => x.schemaId == "xtk:sql",
        );
        instance.parse(xtkSqlCreatedb, schemaConfig);

        const fileSql = join(
          pathFull,
          "Administration/Configuration/SQL scripts/xtk/createdb.sql.sql",
        );
        const fileSqlExists = await fs.pathExists(fileSql);
        expect(fileSqlExists).to.be.true;
        const fileMeta = join(
          pathFull,
          "/Administration/Configuration/SQL scripts/xtk/createdb.sql.meta.xml",
        );
        const fileMetaExists = await fs.pathExists(fileMeta);
        expect(fileMetaExists).to.be.true;
        const contentSql = fs.readFileSync(fileSql, "utf8");
        const contentMeta = fs.readFileSync(fileMeta, "utf8");
        expect(contentMeta).to.contain(
          `<sql xmlns="urn:xtk:queryDef" entitySchema="xtk:sql"`,
        );
        expect(contentMeta).to.contain(`xtkschema="xtk:sql"`);
        expect(contentMeta).to.contain(`<data/>`);
        expect(contentMeta).to.not.contain(`CREATE DATABASE $DatabaseName`);

        expect(contentSql).to.contain(`-- comment here`);
        expect(contentSql).to.contain(`CREATE DATABASE $DatabaseName;`);
        expect(contentSql).to.not.contain(`<`);
        expect(contentSql).to.not.contain(`>`);
      });

      it("nms:delivery (meta)", async () => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
        );
        const schemaConfig = configDefaultFull.schemas.find(
          (x) => x.schemaId == "nms:delivery",
        );
        instance.parse(nmsDelivery554, schemaConfig);

        // html
        const basename = "Campaign Management/Deliveries/DM554";
        const fileHtml = join(pathFull, basename + ".html");
        const fileHtmlExists = await fs.pathExists(fileHtml);
        expect(fileHtmlExists).to.be.true;
        // text
        const fileText = join(pathFull, basename + ".txt");
        const fileTextExists = await fs.pathExists(fileText);
        expect(fileTextExists).to.be.true;
        // meta
        const fileMeta = join(pathFull, basename + ".meta.xml");
        const fileMetaExists = await fs.pathExists(fileMeta);
        expect(fileMetaExists).to.be.true;

        // contents
        const contentHtml = fs.readFileSync(fileHtml, "utf8");
        const contentText = fs.readFileSync(fileText, "utf8");
        const contentMeta = fs.readFileSync(fileMeta, "utf8");

        expect(contentHtml).to.contain(`<p>Dear {{recipient.firstName}},</p>`);
        expect(contentHtml).to.contain(`<a href="https`);
        expect(contentHtml).to.not.contain(`<delivery`);
        expect(contentHtml).to.not.contain(`<source`);

        expect(contentText).to.contain(`Dear {{recipient.firstName}},`);
        expect(contentText).to.contain(`https`);
        expect(contentHtml).to.not.contain(`<delivery`);
        expect(contentHtml).to.not.contain(`<source`);

        expect(contentMeta).to.contain(`<delivery xtkschema`);
        expect(contentMeta).to.contain(`<html`);
        expect(contentMeta).to.contain(`cryptedId`);
        expect(contentMeta).to.not.contain(`@encrypted`);
        expect(contentMeta).to.not.contain(
          `<p>Dear {{recipient.firstName}},</p>`,
        );
        expect(contentMeta).to.not.contain(`<a href="https`);
      });

      it("nms:includeView (meta)", async () => {
        instance = new CampaignInstance(
          mockLogger,
          mockClient,
          configDefaultFull,
          optionsFull,
        );
        const schemaConfig = configDefaultFull.schemas.find(
          (x) => x.schemaId == "nms:includeView",
        );
        instance.parse(nmsViewSubscription, schemaConfig);

        const basename =
          "Resources/Campaign Management/Personalization blocks/SubscriptionLink";

        const fileHtml = join(pathFull, basename + ".html");
        const fileHtmlExists = await fs.pathExists(fileHtml);
        expect(fileHtmlExists).to.be.true;
        const fileText = join(pathFull, basename + ".txt");
        const fileTextExists = await fs.pathExists(fileText);
        expect(fileTextExists).to.be.true;
        const fileMeta = join(pathFull, basename + ".meta.xml");
        const fileMetaExists = await fs.pathExists(fileMeta);
        expect(fileMetaExists).to.be.true;
        const contentHtml = fs.readFileSync(fileHtml, "utf8");
        const contentText = fs.readFileSync(fileText, "utf8");
        const contentMeta = fs.readFileSync(fileMeta, "utf8");

        expect(contentMeta).to.contain(`<includeView xmlns="`);
        expect(contentMeta).to.contain(`name="SubscriptionLink"`);
        expect(contentMeta).to.contain(`<html/>`);
        expect(contentMeta).to.contain(`<text/>`);
        expect(contentMeta).to.not.contain(`<a href="`);
        expect(contentMeta).to.not.contain(`<%@ include view='Subscription`);
        expect(contentMeta).to.not.contain(`To register`);

        expect(contentHtml).to.contain(`<a href="`);
        expect(contentHtml).to.contain(`<%@ include view='Subscription`);
        expect(contentHtml).to.contain(`To register`);
        expect(contentHtml).to.not.contain(`CDATA`);
        expect(contentHtml).to.not.contain(`<html`);

        expect(contentText).to.contain(`<%@ include view='Subscription`);

        expect(contentText).to.contain(`Use this link`);
        expect(contentText).to.not.contain(`<a href="`);
        expect(contentText).to.not.contain(`CDATA`);
        expect(contentText).to.not.contain(`<html`);
      });
    });

    it("should empty textContent when excludeXPath targets an element node", () => {
      instance = new CampaignInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
      );
      sinon.stub(fs, "outputFileSync"); // no disk write

      // xtkSqlCreatedb has a <data> element — target it without '@' prefix
      const schemaConfig = {
        ...configDefaultFull.schemas.find((x) => x.schemaId === "xtk:sql"),
        excludeXPaths: ["data"], // element, NOT an attribute
      };

      // reload XML to avoid mutation from other tests
      const freshXml = loadXml("xtk/sql/createdb.sql.xml");

      instance.parse(freshXml, schemaConfig, true);

      // The <data> element's textContent must have been blanked
      const serialized = DomUtil.toXMLString(freshXml);
      expect(serialized).to.match(/<data\s*\/>/); // self-closing = empty textContent
      expect(serialized).to.not.contain("CREATE DATABASE");
    });
  });

  describe("parse all mocks", () => {});

  describe("exec", () => {
    const newInstance = () =>
      new CampaignInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
        mockSpinner,
      );

    it("should evaluate an inline script and return the serialized context", async () => {
      instance = newInstance();
      const outputContext = DomUtil.fromJSON(
        "context",
        { result: "ok" },
        "SimpleJson",
      );
      const adapterStub = sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .resolves(outputContext);

      const result = await instance.exec({ script: "logInfo('hi')" });

      expect(adapterStub.calledOnce).to.be.true;
      const [name, script] = adapterStub.firstCall.args;
      expect(name).to.equal("acc-cli");
      expect(script).to.equal("logInfo('hi')");
      expect(result).to.contain("result");
      // The result is returned (for the command to print on stdout) and only
      // mirrored into the verbose diagnostic trace — never logged at info.
      expect(mockLogger.verbose.calledWith(result)).to.be.true;
    });

    it("should read --file and derive the name from its basename", async () => {
      instance = newInstance();
      const adapterStub = sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .resolves(DomUtil.fromJSON("context", {}, "SimpleJson"));

      // use this spec file itself as a guaranteed-existing JS file
      await instance.exec({ file: __filename });

      const [name, script] = adapterStub.firstCall.args;
      expect(name).to.equal("CampaignInstance.spec.js");
      expect(script).to.contain("describe");
    });

    it("should prefer an explicit --name over the file basename", async () => {
      instance = newInstance();
      const adapterStub = sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .resolves(DomUtil.fromJSON("context", {}, "SimpleJson"));

      await instance.exec({ file: __filename, name: "myScript" });

      expect(adapterStub.firstCall.args[0]).to.equal("myScript");
    });

    it("should throw INSTANCE_EXEC_NO_SCRIPT when neither file nor script", async () => {
      instance = newInstance();
      await expect(instance.exec({})).to.be.rejectedWith(/no script provided/);
    });

    it("should throw INSTANCE_EXEC_BOTH_SCRIPT when both file and script", async () => {
      instance = newInstance();
      await expect(
        instance.exec({ file: __filename, script: "x" }),
      ).to.be.rejectedWith(/mutually exclusive/);
    });

    it("should throw INSTANCE_EXEC_FILE_NOT_FOUND when file is missing", async () => {
      instance = newInstance();
      await expect(
        instance.exec({ file: "/does/not/exist.js" }),
      ).to.be.rejectedWith(/script file not found/);
    });

    it("should rethrow and fail the spinner when the adapter rejects", async () => {
      instance = newInstance();
      sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .rejects(new Error("boom"));
      await expect(
        instance.exec({ script: "logInfo('hi')" }),
      ).to.be.rejectedWith(/boom/);
    });

    it("adapterEvaluateJavaScript should wrap SDK errors as INSTANCE_EXEC_SDK_EVALUATE_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xtkBuilder: {
            evaluateJavaScript: sinon.stub().rejects(new Error("soap down")),
          },
        },
      };
      await expect(
        instance.adapterEvaluateJavaScript("n", "s", {}),
      ).to.be.rejectedWith(/EvaluateJavaScript error/);
    });
  });

  describe("info", () => {
    const newInstance = () =>
      new CampaignInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
        mockSpinner,
      );
    const cnxInfoEl = DomUtil.getFirstChildElement(
      DomUtil.parse('<infos><cnx login="admin"/></infos>'),
    );
    const stateEl = DomUtil.getFirstChildElement(
      DomUtil.parse('<elemMonitoring currentInstance="instance1"/>'),
    );

    const stubAll = (i) => {
      sinon.stub(i, "adapterTestCnx").resolves(null);
      sinon
        .stub(i, "adapterGetServerTime")
        .resolves(new Date("2026-06-06T14:00:00.000Z"));
      sinon.stub(i, "adapterGetCnxInfo").resolves(cnxInfoEl);
      sinon.stub(i, "adapterDumpCurrentInstanceState").resolves(stateEl);
    };

    it("should render all four sections with no errors on success", async () => {
      instance = newInstance();
      stubAll(instance);

      const { text, errors } = await instance.info();

      expect(errors).to.be.empty;
      expect(text).to.contain("xtk:session#TestCnx");
      expect(text).to.contain("✅ reachable");
      expect(text).to.contain("2026-06-06T14:00:00.000Z");
      expect(text).to.contain("<cnx");
      expect(text).to.contain("elemMonitoring");
      // returned for the command to print; mirrored only into verbose trace
      expect(mockLogger.verbose.calledWith(text)).to.be.true;
    });

    it("should keep going when one probe fails (best-effort) and collect the error", async () => {
      instance = newInstance();
      stubAll(instance);
      instance.adapterDumpCurrentInstanceState.restore();
      sinon
        .stub(instance, "adapterDumpCurrentInstanceState")
        .rejects(new Error("timeout of 5000ms exceeded"));

      const { text, errors } = await instance.info();

      expect(errors).to.have.lengthOf(1);
      expect(errors[0].message).to.contain("timeout");
      // other sections still rendered
      expect(text).to.contain("✅ reachable");
      // the failed section shows the warning instead of a body
      expect(text).to.contain("⚠️ timeout of 5000ms exceeded");
    });

    it("adapterTestCnx should wrap SDK errors as INSTANCE_INFO_SDK_TESTCNX_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: { xtkSession: { testCnx: sinon.stub().rejects(new Error("x")) } },
      };
      await expect(instance.adapterTestCnx()).to.be.rejectedWith(
        /TestCnx error/,
      );
    });

    it("adapterDumpCurrentInstanceState should wrap SDK errors as INSTANCE_INFO_SDK_DUMPSTATE_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xml: {
            nlMonitoring: {
              dumpCurrentInstanceState: sinon.stub().rejects(new Error("x")),
            },
          },
        },
      };
      await expect(
        instance.adapterDumpCurrentInstanceState(),
      ).to.be.rejectedWith(/DumpCurrentInstanceState error/);
    });
  });
});
