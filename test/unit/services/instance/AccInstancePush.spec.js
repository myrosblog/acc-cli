// node
import fs from "fs-extra";
import os from "node:os";
import { join } from "node:path";
// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
import {
  makeLogger,
  makeSpinner,
  makeClient,
  makeSchema,
} from "../../../helpers.js";
// acc
import AccInstancePush from "../../../../src/services/instance/AccInstancePush.js";

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
      schemaId: "nms:delivery",
      filename: "/Campaign Management/Deliveries/{@internalName}.meta.xml",
      decompose: {
        "content/html/source":
          "/Campaign Management/Deliveries/{@internalName}.html",
      },
    },
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

const idKey = [{ xpath: "@id", attributeName: "id", value: "456" }];

const scriptPath = "Admin/Config/JavaScript codes/test/integrationTest.js";
const metaPath = "Admin/Config/JavaScript codes/test/integrationTest.meta.xml";

describe("AccInstancePush", () => {
  let projectPath, mockClient, mockLogger, mockSpinner, accInstancePush;

  beforeEach(() => {
    projectPath = fs.mkdtempSync(join(os.tmpdir(), "acc-push-"));

    mockClient = makeClient();
    mockClient.NLWS = {
      xml: { xtkSession: { write: sinon.stub().resolves({}) } },
    };
    mockClient.application = {
      getSchema: sinon.stub().resolves(makeSchema(javascriptSchemaXml)),
    };
    mockLogger = makeLogger();
    mockSpinner = makeSpinner();
    sinon.spy(mockSpinner, "succeed");
    sinon.spy(mockSpinner, "warn");

    accInstancePush = new AccInstancePush(
      mockLogger,
      mockClient,
      testConfig,
      { path: projectPath },
      () => mockSpinner,
    );
  });

  afterEach(() => {
    fs.removeSync(projectPath);
    sinon.restore();
  });

  describe("constructor", () => {
    it("should default the project path to the current directory", () => {
      const push = new AccInstancePush(mockLogger, mockClient, testConfig, {});
      expect(push.projectPath).to.equal(process.cwd());
    });
  });

  describe("_findSchemaForFile", () => {
    it("should find the schema and xpath of a decomposed file", () => {
      const target = accInstancePush._findSchemaForFile(
        "Admin/Config/JavaScript codes/cus/myScript.js",
      );

      expect(target.schemaConfig.schemaId).to.equal("xtk:javascript");
      expect(target.xpath).to.equal("data");
    });

    it("should return null for a file outside the decompose configuration", () => {
      expect(accInstancePush._findSchemaForFile("some/random/path/file.js")).to
        .be.null;
    });

    it("should warn when several patterns claim the same file", () => {
      accInstancePush.accConfig = {
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

      const target = accInstancePush._findSchemaForFile("Shared/both.js");

      expect(target.schemaConfig.schemaId).to.equal("xtk:javascript");
      expect(mockLogger.warn).to.have.been.calledWithMatch(
        /matches 2 decompose patterns/,
      );
    });
  });

  describe("_getMetaFilePath", () => {
    it("should generate meta file path from decomposed file path", () => {
      expect(
        accInstancePush._getMetaFilePath(join("some", "cus", "myScript.js")),
      ).to.equal(join("some", "cus", "myScript.meta.xml"));
    });

    it("should handle files with multiple dots in name", () => {
      expect(
        accInstancePush._getMetaFilePath(join("some", "my.file.js")),
      ).to.equal(join("some", "my.file.meta.xml"));
    });
  });

  describe("_getMetadataDocument", () => {
    beforeEach(() => {
      // _getMetadataDocument reports progress on the spinner started by push
      accInstancePush.spinner = mockSpinner;
    });

    it("should return the parsed meta document", async () => {
      fs.writeFileSync(
        join(projectPath, "testScript.meta.xml"),
        `<javascript id="123" name="testScript" namespace="cus"><data/></javascript>`,
      );

      const document = await accInstancePush._getMetadataDocument(
        testConfig.schemas[0],
        join(projectPath, "testScript.js"),
        "data",
      );

      expect(document.documentElement.tagName).to.equal("javascript");
      expect(document.documentElement.getAttribute("id")).to.equal("123");
    });

    it("should throw if meta file not found", async () => {
      await expect(
        accInstancePush._getMetadataDocument(
          testConfig.schemas[0],
          join(projectPath, "file.js"),
          "data",
        ),
      )
        .to.be.rejectedWith(/file\.meta\.xml/)
        .and.eventually.have.property(
          "code",
          "INSTANCE_PUSH_META_FILE_MISSING",
        );
    });
  });

  describe("push", () => {
    beforeEach(() => {
      fs.outputFileSync(
        join(projectPath, metaPath),
        `<javascript id="456" name="integrationTest" namespace="test"><data></data></javascript>`,
      );
      fs.outputFileSync(join(projectPath, scriptPath), "// updated content");
    });

    it("should push the changed content to the server", async () => {
      await accInstancePush.push(scriptPath);

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
      expect(mockSpinner.succeed).to.have.been.calledWithMatch(
        /Write successful to/,
      );

      // The push is journaled for auditing, alongside AccInstancePullLog for pull
      expect(mockLogger.debug).to.have.been.calledOnce;
      const pushLogSummary = mockLogger.debug.firstCall.args[0];
      expect(pushLogSummary.schemaId).to.equal("xtk:javascript");
      expect(pushLogSummary.filePath).to.equal(join(projectPath, scriptPath));
      expect(pushLogSummary.operation).to.equal("update");
      expect(pushLogSummary.payloadXml).to.equal(xml);
      expect(pushLogSummary.error).to.be.undefined;

      // dist holds what was sent
      const distPath = join(projectPath, "dist", `${scriptPath}.xml`);
      expect(pushLogSummary.distPath).to.equal(distPath);
      expect(fs.readFileSync(distPath, "utf8")).to.equal(
        DomUtil.toXMLString(payload),
      );
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

      await accInstancePush.push(scriptPath);

      const payload = mockClient.NLWS.xml.xtkSession.write.firstCall.args[0];
      const xml = DomUtil.toXMLString(payload.documentElement);
      expect(xml).to.include('_key="@name,@namespace"');
      expect(xml).to.include('name="integrationTest"');
      expect(xml).to.include('namespace="test"');
      expect(xml).to.not.include("id=");
    });

    it("should report a meta file that cannot supply the key", async () => {
      fs.outputFileSync(
        join(projectPath, metaPath),
        `<javascript name="integrationTest" namespace="test"><data></data></javascript>`,
      );

      await accInstancePush.push(scriptPath);

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch(
        /no value for the key "id"/,
      );
    });

    it("should report an unknown schema", async () => {
      mockClient.application.getSchema.resolves(null);

      await accInstancePush.push(scriptPath);

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Schema xtk:javascript not found/,
      );
    });

    it("should wrap an error raised outside acc", async () => {
      mockClient.application.getSchema.rejects(new Error("socket hang up"));

      await accInstancePush.push(scriptPath);

      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Failed to push the entity to the server. Cause: socket hang up/,
      );
    });

    it("should not push an xpath that holds child elements", async () => {
      mockClient.application.getSchema.resolves(
        makeSchema(`<schema namespace="xtk" name="javascript">
          <element name="javascript">
            <key name="id" internal="true"><keyfield xpath="@id"/></key>
            <attribute name="id" type="long"/>
            <element name="data"><attribute name="kind" type="string"/></element>
          </element>
        </schema>`),
      );

      await accInstancePush.push(scriptPath);

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.warn).to.have.been.calledWithMatch(/is an XML element/);
      expect(mockSpinner.warn).to.have.been.calledWithMatch(/not pushed/);
    });

    it("should stop before pushing when the meta file is missing", async () => {
      const deliveryPath = "Campaign Management/Deliveries/DM42.html";
      fs.outputFileSync(join(projectPath, deliveryPath), "<p>orphan</p>");

      await accInstancePush.push(deliveryPath);

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch({
        code: "INSTANCE_PUSH_META_FILE_MISSING",
      });
    });

    it("should report a failed push without throwing", async () => {
      mockClient.NLWS.xml.xtkSession.write.rejects(new Error("SOAP down"));

      await accInstancePush.push(scriptPath);

      expect(mockLogger.error).to.have.been.calledWithMatch(
        /Failed to push integrationTest.js/,
      );
      // The payload of a failed push stays auditable
      expect(fs.existsSync(join(projectPath, "dist", `${scriptPath}.xml`))).to
        .be.true;
    });

    it("should skip a file outside the decompose configuration", async () => {
      fs.writeFileSync(join(projectPath, "notWatched.js"), "// noise");

      await accInstancePush.push("notWatched.js");

      expect(mockClient.NLWS.xml.xtkSession.write).to.not.have.been.called;
      expect(mockLogger.error).to.have.been.calledWithMatch({
        code: "INSTANCE_PUSH_FILE_NOT_IN_SCOPE",
      });
    });
  });

  describe("build", () => {
    it("should build the update payload with the content and the key", () => {
      const { payloadDocument } = accInstancePush.build(
        join(projectPath, "cus", "myScript.js"),
        "data",
        "// code",
        makeSchema(javascriptSchemaXml),
        idKey,
      );

      const xml = DomUtil.toXMLString(payloadDocument);
      expect(payloadDocument.documentElement.tagName).to.equal("javascript");
      expect(xml).to.include('xtkschema="xtk:javascript"');
      expect(xml).to.include('_operation="update"');
      expect(xml).to.include('_key="@id"');
      expect(xml).to.include('id="456"');
      expect(xml).to.include("<data><![CDATA[// code]]></data>");
    });

    it("should write the payload to dist, mirroring the file path", () => {
      const { payloadDocument, distPath } = accInstancePush.build(
        join(projectPath, "cus", "myScript.js"),
        "data",
        "// code",
        makeSchema(javascriptSchemaXml),
        idKey,
      );

      expect(distPath).to.equal(
        join(projectPath, "dist", "cus", "myScript.js.xml"),
      );
      expect(fs.readFileSync(distPath, "utf8")).to.equal(
        DomUtil.toXMLString(payloadDocument),
      );
      expect(mockLogger.verbose).to.have.been.calledWithMatch(
        /Payload written to/,
      );
    });

    it("should keep apart the payloads of two files of one entity", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const html = accInstancePush.build(
        join(projectPath, "Deliveries", "DM42.html"),
        "content/html/source",
        "<p>html</p>",
        schema,
        idKey,
      );
      const text = accInstancePush.build(
        join(projectPath, "Deliveries", "DM42.txt"),
        "content/text/source",
        "text",
        schema,
        idKey,
      );

      expect(html.distPath).to.not.equal(text.distPath);
      expect(fs.existsSync(html.distPath)).to.be.true;
      expect(fs.existsSync(text.distPath)).to.be.true;
    });
  });
});
