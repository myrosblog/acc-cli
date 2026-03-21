// node
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// modules
import { assert, expect } from "chai";
import sinon from "sinon";
// acc sdk
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
const configDefaultFull = loadJson("acc.config.defaultTemplateFull.json");
const configDefaultSimple = loadJson("acc.config.defaultTemplateSimple.json");
const xtkSqlCreatedb = loadXml("xtk/sql/createdb.sql.xml");
const xtkSchemaDelivery = loadXml("xtk/srcSchema/nms-delivery.xml");
const nmsDelivery554 = loadXml("nms/delivery/DM554.xml");
const nmsViewSubscription = loadXml("nms/includeView/SubscriptionLink.xml");

// acc
import CampaignInstance from "../src/CampaignInstance.js";

describe("CampaignInstance", function () {
  let mockClient,
    instance,
    pathSimple,
    optionsSimple,
    pathFull,
    optionsFull,
    logStub;

  beforeEach(function () {
    // mock client
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
    if (logStub) {
      logStub.restore();
    }
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
        "nms:deliveryMapping",
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
      const folder = instance._getQueryDefForSchema("xtk:folder", baseQueryDef);
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
    it("should check without error without verbose", async () => {
      instance = new CampaignInstance(
        mockClient,
        configDefaultSimple,
        optionsSimple,
      );
      logStub = sinon.stub(instance, "log"); // mock instance log

      await instance.pull(true, optionsSimple);

      // console.log(
      //   "Appels à instance.log :",
      //   logStub.getCalls().map((call) => call.args),
      // );

      expect(logStub.callCount).to.equal(19);

      // Vérifie que `log` a été appelé avec un texte contenant "Access Management"
      // const logs = [
      //   `✅ /Administration/Access Management/Organizational entities/{@name}.xml: 0 nms:localOrgUnit`,
      // ];
      // for (let log of logs) {
      //   // expect(logStub.calledWithMatch(log)).to.be.true;
      //   expect(logStub).to.have.been.calledWith(
      //     sinon.match((text) => text.includes(log)),
      //   );
      // }
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
        const child = DomUtil.getFirstChildElement(xtkSqlCreatedb);
        const schemaConfig = configDefaultSimple["xtk:sql"];
        instance.parse(child, schemaConfig);

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
        const child = DomUtil.getFirstChildElement(nmsDelivery554);
        const schemaConfig = configDefaultSimple["nms:delivery"];
        instance.parse(child, schemaConfig);

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
        const child = DomUtil.getFirstChildElement(xtkSchemaDelivery);
        const schemaConfig = configDefaultSimple["xtk:srcSchema"];
        instance.parse(child, schemaConfig);

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
        const child = DomUtil.getFirstChildElement(xtkSqlCreatedb);
        const schemaConfig = configDefaultFull["xtk:sql"];
        instance.parse(child, schemaConfig);

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
        const child = DomUtil.getFirstChildElement(nmsDelivery554);
        const schemaConfig = configDefaultFull["nms:delivery"];
        instance.parse(child, schemaConfig);

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
        const child = DomUtil.getFirstChildElement(nmsViewSubscription);
        const schemaConfig = configDefaultFull["nms:includeView"];
        instance.parse(child, schemaConfig);

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
