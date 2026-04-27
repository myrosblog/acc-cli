// node
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// npm
import { expect } from "chai";
import sinon from "sinon";
// helpers
import { makeClient, makeLogger, makeSpinner, loadXml } from "../helpers.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const loadJson = (file) => JSON.parse(fs.readFileSync(join(__dirname, file)));
const dir = "mocks/acc-js-sdk-xml/xtk/queryDef/executeQuery/";

// mocks
const configDefaultFull = loadJson("../../src/templates/acc.config.json");
// acc
import CampaignInstance from "../../src/CampaignInstance.js";

/** Shallow-clone config and keep only the given schemaIds */
const filterSchemas = (config, schemaId, filename = "") => ({
  ...config,
  schemas: config.schemas.filter(
    (x) =>
      schemaId === x.schemaId &&
      (filename === undefined || x.filename.includes(filename)),
  ),
});

/**
 * Returns true if a schema entry in acc.config.json matches a fixture descriptor.
 * Same predicate used both for filterSchemas() and for removal from configCloned.
 */
const schemaMatches = (schemaEntry, { schemaId, filename }) =>
  schemaEntry.schemaId === schemaId &&
  (!filename || schemaEntry.filename.includes(filename));

// mapping fixture
const mappingFixtures = [
  {
    schemaId: "nms:localOrgUnit",
    xml: loadXml(dir, "nms-localOrgUnit.xml"),
    parsedFilenames: ["localOrgUnit1.meta.xml", "localOrgUnit2.meta.xml"],
  },
  {
    schemaId: "xtk:operator",
    filename: "Operator groups",
    xml: loadXml(dir, "xtk-operator_group.xml"),
    parsedFilenames: ["group1.meta.xml", "group2.meta.xml"],
  },
  {
    schemaId: "xtk:operator",
    filename: "Named rights",
    xml: loadXml(dir, "xtk-operator_right.xml"),
    parsedFilenames: ["right1.meta.xml", "right2.meta.xml"],
  },
  {
    schemaId: "nms:deliveryMapping",
    xml: loadXml(dir, "nms-deliveryMapping.xml"),
    parsedFilenames: ["deliveryMapping1.meta.xml", "deliveryMapping2.meta.xml"],
  },
  {
    schemaId: "nms:typology",
    xml: loadXml(dir, "nms-typology.xml"),
    parsedFilenames: ["typology1.meta.xml", "typology2.meta.xml"],
  },
  {
    schemaId: "nms:typologyRule",
    xml: loadXml(dir, "nms-typologyRule.xml"),
    parsedFilenames: ["typologyRule1.meta.xml", "typologyRule2.meta.xml"],
  },
  {
    schemaId: "nms:stock",
    xml: loadXml(dir, "nms-stock.xml"),
    parsedFilenames: ["stock1.meta.xml", "stock2.meta.xml"],
  },
  {
    schemaId: "xtk:olapCube",
    xml: loadXml(dir, "xtk-olapCube.xml"),
    parsedFilenames: ["olapCube1.meta.xml", "olapCube2.meta.xml"],
  },

  {
    schemaId: "xtk:srcSchema",
    xml: loadXml(dir, "xtk-srcSchema.xml"),
    parsedFilenames: ["srcSchema1.xml", "srcSchema2.xml"], // not decomposed
  },
  {
    schemaId: "xtk:enum",
    xml: loadXml(dir, "xtk-enum.xml"),
    parsedFilenames: ["enum1.meta.xml", "enum2.meta.xml"],
  },
  {
    schemaId: "xtk:counter",
    xml: loadXml(dir, "xtk-counter.xml"),
    parsedFilenames: ["counter1.meta.xml", "counter2.meta.xml"],
  },
  {
    schemaId: "xtk:jssp",
    xml: loadXml(dir, "xtk-jssp.xml"),
    parsedFilenames: ["jssp1.meta.xml", "jssp2.meta.xml"],
  },
  {
    schemaId: "xtk:jst",
    xml: loadXml(dir, "xtk-jst.xml"),
    parsedFilenames: ["jst1.meta.xml", "jst2.meta.xml"],
  },
  {
    schemaId: "xtk:formRendering",
    xml: loadXml(dir, "xtk-formRendering.xml"),
    parsedFilenames: ["formRendering1.meta.xml", "formRendering2.meta.xml"],
  },
  {
    schemaId: "xtk:form",
    xml: loadXml(dir, "xtk-form.xml"),
    parsedFilenames: ["form1.xml", "form2.xml"], // not decomposed
  },
  {
    schemaId: "ncm:publishing",
    xml: loadXml(dir, "ncm-publishing.xml"),
    parsedFilenames: ["publishing1.meta.xml", "publishing2.meta.xml"],
  },
  {
    schemaId: "xtk:javascript",
    xml: loadXml(dir, "xtk-javascript.xml"),
    parsedFilenames: ["javascript1.meta.xml", "javascript2.meta.xml"],
  },
  {
    schemaId: "xtk:navtree",
    xml: loadXml(dir, "xtk-navtree.xml"),
    parsedFilenames: ["navtree1.xml", "navtree2.xml"], // not decomposed
  },
  {
    schemaId: "xtk:sql",
    xml: loadXml(dir, "xtk-sql.xml"),
    parsedFilenames: ["sql1.meta.xml", "sql2.meta.xml"],
  },
  {
    schemaId: "xtk:xslt",
    xml: loadXml(dir, "xtk-xslt.xml"),
    parsedFilenames: ["xslt1.meta.xml", "xslt2.meta.xml"],
  },
  {
    schemaId: "xtk:workflow",
    filename: "Campaign workflows",
    xml: loadXml(dir, "xtk-workflow_campaign.xml"),
    parsedFilenames: ["workflowCampaign1.meta.xml", "workflowCampaign2.meta.xml"],
  },
  {
    schemaId: "xtk:workflow",
    filename: "Technical workflows",
    xml: loadXml(dir, "xtk-workflow_technical.xml"),
    parsedFilenames: ["workflowTechnical1.meta.xml", "workflowTechnical2.meta.xml"],
  },
  {
    schemaId: "xtk:workflow",
    filename: "Workflow templates",
    xml: loadXml(dir, "xtk-workflow_template.xml"),
    parsedFilenames: ["workflowTemplate1.meta.xml", "workflowTemplate2.meta.xml"],
  },
  {
    schemaId: "xtk:job",
    filename: "Job templates",
    xml: loadXml(dir, "xtk-job_template.xml"),
    parsedFilenames: ["jobTemplate1.meta.xml", "jobTemplate2.meta.xml"],
  },
  {
    schemaId: "nms:operation",
    filename: "Campaigns",
    xml: loadXml(dir, "nms-operation.xml"),
    parsedFilenames: ["operation1.meta.xml", "operation2.meta.xml"],
  },
  {
    schemaId: "nms:delivery",
    filename: "Deliveries",
    xml: loadXml(dir, "nms-delivery_delivery.xml"),
    parsedFilenames: ["delivery1.meta.xml", "delivery2.meta.xml"],
  },
  {
    schemaId: "nms:delivery",
    filename: "Delivery templates",
    xml: loadXml(dir, "nms-delivery_template.xml"),
    parsedFilenames: [
      "deliveryTemplate1.meta.xml",
      "deliveryTemplate2.meta.xml",
    ],
  },
  {
    schemaId: "nms:includeView",
    filename: "Personalization blocks",
    xml: loadXml(dir, "nms-includeView_block.xml"),
    parsedFilenames: ["block1.meta.xml", "block2.meta.xml", "block3.meta.xml"],
  },
  {
    schemaId: "nms:includeView",
    filename: "Content templates",
    xml: loadXml(dir, "nms-includeView_template.xml"),
    parsedFilenames: ["template1.meta.xml", "template2.meta.xml"],
  },
  {
    schemaId: "nms:deliveryCustomization",
    xml: loadXml(dir, "nms-deliveryCustomization.xml"),
    parsedFilenames: [
      "deliveryCustomization1.meta.xml",
      "deliveryCustomization2.meta.xml",
    ],
  },
  {
    schemaId: "nms:webApp",
    xml: loadXml(dir, "nms-webApp.xml"),
    parsedFilenames: ["webApp1.xml", "webApp2.xml"], // not decomposed
  },
  {
    schemaId: "xtk:fileRes",
    xml: loadXml(dir, "xtk-fileRes.xml"),
    parsedFilenames: ["fileRes1.meta.xml", "fileRes2.meta.xml"],
  },
  {
    schemaId: "xtk:queryFilter",
    xml: loadXml(dir, "xtk-queryFilter.xml"),
    parsedFilenames: ["queryFilter1.meta.xml", "queryFilter2.meta.xml"],
  },
  {
    schemaId: "nms:service",
    xml: loadXml(dir, "nms-service.xml"),
    parsedFilenames: ["service1.meta.xml", "service2.meta.xml"],
  },
  {
    schemaId: "nms:group",
    xml: loadXml(dir, "nms-group.xml"),
    parsedFilenames: ["group1.meta.xml", "group2.meta.xml"],
  },
  {
    schemaId: "xtk:folder",
    xml: loadXml(dir, "xtk-folder.xml"),
    parsedFilenames: ["folder1.meta.xml", "folder2.meta.xml"],
  },
];

describe("CampaignInstance.pull.integration", () => {
  let mockClient,
    mockLogger,
    mockSpinner,
    instance,
    pathFull,
    optionsFull,
    adapterExecuteQueryStub;

  beforeEach(() => {
    mockClient = makeClient();
    pathFull = join(__dirname, "../dist/configFull/");
    optionsFull = { path: pathFull };
    mockLogger = makeLogger();
    mockSpinner = () => makeSpinner();
    sinon.stub(fs, "outputFileSync");
  });

  it("all config schemas must be covered with fixtures", async () => {
    // Deep-clone schemas array so we can splice entries as they are covered.
    // Anything left at the end was in acc.config.json but had no fixture.
    const uncoveredSchemas = configDefaultFull.schemas.map((s) => ({ ...s }));
    // loop through all fixtures
    for (const fixture of mappingFixtures) {
      const { schemaId, filename, xml, parsedFilenames } = fixture;
      const config = filterSchemas(configDefaultFull, schemaId, filename);
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
      adapterExecuteQueryStub.resolves(xml);

      await instance.pull(false); // isPreview = false

      expect(instance.pullLogs[0].errors).to.be.empty;
      const actual = instance.pullLogs[0].parsedFilenames;
      expect(
        actual,
        `parsedFilenames for ${schemaId} (${filename})`,
      ).to.deep.equal(parsedFilenames);

      // ── Mark matched schemas as covered (remove from uncovered list) ──────
      // We find the index rather than using filter() so duplicates
      // (same schemaId, different filename) are removed one at a time,
      // matching exactly as many entries as the fixture covers.
      const idx = uncoveredSchemas.findIndex((s) => schemaMatches(s, fixture));
      if (idx !== -1) uncoveredSchemas.splice(idx, 1);
    }

    const uncoveredIds = uncoveredSchemas.map(
      (s) => `${s.schemaId} (${s.filename})`,
    );
    expect(
      uncoveredSchemas,
      `${uncoveredIds.length} schemas in acc.config.json have no fixture:\n  ${uncoveredIds.join("\n  ")}`,
    ).to.be.empty;
  });
});
