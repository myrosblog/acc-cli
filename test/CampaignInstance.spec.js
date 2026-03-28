// node
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// modules
import { expect } from "chai";
import sinon from "sinon";
import _ from "lodash";

// acc sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPathJson = join(__dirname, "mocks/config/");
const loadJson = (file) => JSON.parse(fs.readFileSync(configPathJson + file));
const configPathXml = join(__dirname, "mocks/acc-js-sdk-xml/");
const loadXml = (file) =>
  DomUtil.getFirstChildElement(
    DomUtil.parse(fs.readFileSync(configPathXml + file)),
  ); // DomUtil.parse returns DOMDocument, but all methods use DOMElement, hence the conversion
// mocks
const configDefaultFull = loadJson("../../../config/acc.config.json");
const configDefaultSimple = loadJson("acc.config.defaultTemplateSimple.json");
const xtkSqlCreatedb = loadXml("xtk/sql/createdb.sql.xml");
const xtkSchemaDelivery = loadXml("xtk/srcSchema/nms-delivery.xml");
const nmsDelivery554 = loadXml("nms/delivery/DM554.xml");
const nmsViewSubscription = loadXml("nms/includeView/SubscriptionLink.xml");
const nmsDeliveryMappingsRecipientAndSubscribe = loadXml(
  "nms/deliveryMapping/recipientAndSubscribe.xml",
);

// acc
import CampaignInstance from "../src/CampaignInstance.js";

describe("CampaignInstance", function () {
  let mockClient,
    instance,
    pathSimple,
    optionsSimple,
    pathFull,
    optionsFull,
    logStub,
    adapterExecuteQueryStub;

  beforeEach(function () {
    // mock client
    mockClient = {
      DomUtil: DomUtil,
    };

    // mock options
    pathSimple = join(__dirname, "../dist/configSimple/");
    pathFull = join(__dirname, "../dist/configFull/");
    optionsSimple = {
      path: pathSimple,
    };
    optionsFull = {
      path: pathFull,
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Private methods", () => {
    it("_getQueryDefForSchema where.condition.expr", () => {
      instance = new CampaignInstance(
        mockClient,
        configDefaultSimple,
        optionsSimple,
      );
      const baseQueryDef = {
        schema: "nms:deliveryMapping",
        operation: "select",
        select: { node: [] },
      };
      const deliveryMapping = instance._getQueryDefForSchema(
        configDefaultSimple.schemas.find(
          (x) => x.schemaId == "nms:deliveryMapping",
        ),
        baseQueryDef,
      );
      expect(deliveryMapping).to.deep.equal({
        schema: "nms:deliveryMapping",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@builtIn = false" }] },
      });
    });

    it("_getQueryDefForSchema where.condition.expr", () => {
      const baseQueryDef = {
        schema: "xtk:folder",
        operation: "select",
        select: { node: [] },
      };
      const folder = instance._getQueryDefForSchema(
        configDefaultSimple.schemas.find((x) => x.schemaId == "xtk:folder"),
        baseQueryDef,
      );
      expect(folder).to.deep.equal({
        lineCount: 100,
        schema: "xtk:folder",
        operation: "select",
        select: { node: [] },
        where: { condition: [{ expr: "@builtIn = true" }] },
      });
    });
  });

  describe("check", () => {
    // it("should check with logs (nms:localOrgUnit)", async () => {
    //   instance = new CampaignInstance(
    //     mockClient,
    //     configDefaultSimple,
    //     optionsSimple,
    //   );
    //   logStub = sinon.stub(instance, "log"); // mock instance log
    //   adapterExecuteQueryStub = sinon.stub(instance, "adapterCreateAndExecuteQuery");
    //   // mock query
    //   adapterExecuteQueryStub.resolves();
    //   await instance.pull(true);

    //   expect(instance.pullLogs.length).to.equal(18);

    //   const log = instance.pullLogs.find(
    //     (x) => x.schemaConfig.schemaId == "nms:localOrgUnit",
    //   );
    //   expect(log.startTime).to.be.lessThan(log.endTime);
    // });

    it("should check with basic config (nms:deliveryMapping)", async () => {
      // only keep nms:deliveryMapping
      const config = _.clone(configDefaultFull);
      config.schemas = config.schemas.filter(
        (x) => x.schemaId == "nms:deliveryMapping",
      );
      // init
      instance = new CampaignInstance(mockClient, config, optionsSimple);
      logStub = sinon.stub(instance, "log"); // mock instance log
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

      expect(instance.pullLogs[0].elements).to.be.of.length(2);
    });
  });

  describe("parse", () => {
    describe("should parse with simple config", () => {
      it("xtk:sql", async () => {
        instance = new CampaignInstance(
          mockClient,
          configDefaultSimple,
          optionsSimple,
        );
        const schemaConfig = configDefaultSimple.schemas.find(
          (x) => x.schemaId == "xtk:sql",
        );
        instance.parse(xtkSqlCreatedb, schemaConfig);

        const fileRaw = join(
          pathSimple,
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
          mockClient,
          configDefaultSimple,
          optionsSimple,
        );
        const schemaConfig = configDefaultSimple.schemas.find(
          (x) => x.schemaId == "nms:delivery",
        );
        instance.parse(nmsDelivery554, schemaConfig);

        const fileRaw = join(
          pathSimple,
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
          mockClient,
          configDefaultSimple,
          optionsSimple,
        );
        const schemaConfig = configDefaultSimple.schemas.find(
          (x) => x.schemaId == "xtk:srcSchema",
        );
        instance.parse(xtkSchemaDelivery, schemaConfig);

        const fileRaw = join(
          pathSimple,
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
  });
});
