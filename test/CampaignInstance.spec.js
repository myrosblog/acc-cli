// node
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// modules
import { assert, expect } from "chai";
import sinon from "sinon";
import sdk from "@adobe/acc-js-sdk";
const DomUtil = sdk.DomUtil;
// helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPathJson = join(__dirname, "mocks/config/");
const loadJson = (file) => JSON.parse(fs.readFileSync(configPathJson + file));
const configPathXml = join(__dirname, "mocks/acc-js-sdk-xml/");
const loadXml = (file) => DomUtil.parse(fs.readFileSync(configPathXml + file));
// mocks
const configDefault = loadJson("acc.config.defaultTemplate.json");
const configDefaultNoMeta = loadJson("acc.config.defaultTemplateNoMeta.json");
const xtkSqlCreatedb = loadXml("xtk/sql/createdb.sql.xml");
const xtkSchemaDelivery = loadXml("xtk/srcSchema/nms-delivery.xml");
const nmsDelivery554 = loadXml("nms/delivery/DM554.xml");
// acc
import CampaignInstance from "../src/CampaignInstance.js";
import CampaignError from "../src/CampaignError.js";

describe("CampaignInstance", function () {
  let mockClient, instance;

  beforeEach(function () {
    // Mock client
    mockClient = {
      registerObserver: sinon.stub(),
      NLWS: {
        xtkQueryDef: {
          create: sinon.stub().returns({
            executeQuery: sinon.stub().resolves({ count: 10 }),
            selectAll: sinon.stub().resolves(),
            executeQuery: sinon.stub().resolves({
              // Mock DOMDocument
              childNodes: [],
            }),
          }),
        },
        xml: {
          xtkQueryDef: {
            create: sinon.stub().returns({
              selectAll: sinon.stub().resolves(),
              executeQuery: sinon.stub().resolves({
                // Mock DOMDocument
                childNodes: [],
              }),
            }),
          },
        },
      },
      DomUtil: DomUtil,
    };
  });

  describe("parse", function () {
    it("should parse xtk:sql without meta", async function () {
      instance = new CampaignInstance(mockClient, configDefaultNoMeta);
      const child = DomUtil.getFirstChildElement(xtkSqlCreatedb);
      const schemaConfig = configDefaultNoMeta["xtk:sql"];
      instance.parse(
        child,
        schemaConfig,
        join(__dirname, "../dist/"),
        "xtk:sql",
      );

      const fileRaw = join(
        __dirname,
        "../dist/Administration/Configuration/SQL scripts/xtk/createdb.sql.sql",
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

    it("should parse xtk:sql with meta", async function () {
      instance = new CampaignInstance(mockClient, configDefault);
      const child = DomUtil.getFirstChildElement(xtkSqlCreatedb);
      const schemaConfig = configDefault["xtk:sql"];
      instance.parse(
        child,
        schemaConfig,
        join(__dirname, "../dist/"),
        "xtk:sql",
      );

      const fileSql = join(
        __dirname,
        "../dist/Administration/Configuration/SQL scripts/xtk/createdb.sql.sql",
      );
      const fileSqlExists = await fs.pathExists(fileSql);
      expect(fileSqlExists).to.be.true;
      const fileMeta = join(
        __dirname,
        "../dist/Administration/Configuration/SQL scripts/xtk/createdb.sql.meta.xml",
      );
      const fileMetaExists = await fs.pathExists(fileMeta);
      expect(fileMetaExists).to.be.true;
      const contentSql = fs.readFileSync(fileSql, "utf8");
      const contentMeta = fs.readFileSync(fileMeta, "utf8");
      expect(contentMeta).to.contain(
        `<sql xmlns="urn:xtk:queryDef" entitySchema="xtk:sql"`,
      );
      expect(contentMeta).to.contain(`xtkschema="xtk:sql"/>`);
      expect(contentMeta).to.not.contain(`<data`);
      expect(contentSql).to.contain(`-- comment here`);
      expect(contentSql).to.contain(`CREATE DATABASE $DatabaseName;`);
      expect(contentSql).to.not.contain(`<`);
      expect(contentSql).to.not.contain(`>`);
    });

    it("should parse nms:delivery without meta", async function () {
      instance = new CampaignInstance(mockClient, configDefaultNoMeta);
      const child = DomUtil.getFirstChildElement(nmsDelivery554);
      const schemaConfig = configDefaultNoMeta["nms:delivery"];
      instance.parse(
        child,
        schemaConfig,
        join(__dirname, "../dist/"),
        "nms:delivery",
      );

      const fileRaw = join(
        __dirname,
        "../dist/Campaign Management/Deliveries/DM554.html",
      );
      const fileExists = await fs.pathExists(fileRaw);
      expect(fileExists).to.be.true;
      const content = fs.readFileSync(fileRaw, "utf8");
      expect(content).to.contain(`<delivery _operation="insert"`); // main element + attribute
      expect(content).to.contain(`<folder _cs="`); // link
      expect(content).to.contain(`<properties deliveryState="0"`); // element
      expect(content).to.contain(`<content`); // no decomposition
    });

    it("should parse xtk:srcSchema without meta", async function () {
      instance = new CampaignInstance(mockClient, configDefaultNoMeta);
      const child = DomUtil.getFirstChildElement(xtkSchemaDelivery);
      const schemaConfig = configDefaultNoMeta["xtk:srcSchema"];
      instance.parse(
        child,
        schemaConfig,
        join(__dirname, "../dist/"),
        "xtk:srcSchema",
      );

      const fileRaw = join(
        __dirname,
        "../dist/Administration/Configuration/Data schemas/nms/delivery.xml",
      );
      const fileExists = await fs.pathExists(fileRaw);
      expect(fileExists).to.be.true;
      const content = fs.readFileSync(fileRaw, "utf8");
      expect(content).to.contain(`<srcSchema name="delivery" namespace="nms"`); // main element + attribute
      expect(content).to.contain(`<methods>`); // element
    });
  });
});
