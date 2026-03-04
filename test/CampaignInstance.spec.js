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
const xtkSqlPostgre = loadXml("xtk/sql/postgresql-tmpl-createdb.sql.xml");
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
    it("should parse XML xtk:sql without meta", async function () {
      instance = new CampaignInstance(mockClient, configDefaultNoMeta);
      const child = DomUtil.getFirstChildElement(xtkSqlPostgre);
      const schemaConfig = configDefaultNoMeta["xtk:sql"];
      instance.parse(child, schemaConfig, join(__dirname, "../dist/"), "xtk:sql");

      const filePath = join(__dirname, '../dist/Administration/Configuration/SQL scripts/xtk/postgresql-tmpl-createdb.sql.sql');
      const fileExists = await fs.pathExists(filePath);
      expect(fileExists).to.be.true;
    });
  });
});
