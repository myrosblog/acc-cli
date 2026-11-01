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
import { makeLogger, makeSchema } from "../../../helpers.js";
// acc
import AccInstancePush from "../../../../src/services/instance/AccInstancePush.js";

const javascriptSchema = makeSchema(`<schema namespace="xtk" name="javascript">
  <element name="javascript">
    <key name="id" internal="true"><keyfield xpath="@id"/></key>
    <attribute name="id" type="long"/>
  </element>
</schema>`);

const idKey = [{ xpath: "@id", attributeName: "id", value: "456" }];

describe("AccInstancePush", () => {
  let projectPath, mockLogger, accInstancePush;

  beforeEach(() => {
    projectPath = fs.mkdtempSync(join(os.tmpdir(), "acc-push-"));
    mockLogger = makeLogger();
    accInstancePush = new AccInstancePush(mockLogger, { path: projectPath });
  });

  afterEach(() => {
    fs.removeSync(projectPath);
    sinon.restore();
  });

  describe("constructor", () => {
    it("should default the project path to the current directory", () => {
      expect(new AccInstancePush(mockLogger, {}).projectPath).to.equal(
        process.cwd(),
      );
    });
  });

  describe("build", () => {
    it("should build the update payload with the content and the key", () => {
      const { payloadDocument } = accInstancePush.build(
        join(projectPath, "cus", "myScript.js"),
        "data",
        "// code",
        javascriptSchema,
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

    it("should declare every field of a composite key", () => {
      const { payloadDocument } = accInstancePush.build(
        join(projectPath, "cus", "myScript.js"),
        "data",
        "// code",
        javascriptSchema,
        [
          { xpath: "@name", attributeName: "name", value: "myScript" },
          { xpath: "@namespace", attributeName: "namespace", value: "cus" },
        ],
      );

      const payload = payloadDocument.documentElement;
      expect(payload.getAttribute("_key")).to.equal("@name,@namespace");
      expect(payload.getAttribute("name")).to.equal("myScript");
      expect(payload.getAttribute("namespace")).to.equal("cus");
    });

    it("should write the payload to dist, mirroring the file path", () => {
      const { payloadDocument, distPath } = accInstancePush.build(
        join(projectPath, "cus", "myScript.js"),
        "data",
        "// code",
        javascriptSchema,
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
      const html = accInstancePush.build(
        join(projectPath, "Deliveries", "DM42.html"),
        "content/html/source",
        "<p>html</p>",
        javascriptSchema,
        idKey,
      );
      const text = accInstancePush.build(
        join(projectPath, "Deliveries", "DM42.txt"),
        "content/text/source",
        "text",
        javascriptSchema,
        idKey,
      );

      expect(html.distPath).to.not.equal(text.distPath);
      expect(fs.existsSync(html.distPath)).to.be.true;
      expect(fs.existsSync(text.distPath)).to.be.true;
    });
  });
});
