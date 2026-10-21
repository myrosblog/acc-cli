import { expect } from "chai";
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import DomUtilAcc from "../../../src/helpers/DomUtilAcc.js";

describe("helpers/DomUtilAcc", () => {
  describe("buildXmlFromPath", () => {
    it("should nest the xpath elements and wrap the content in CDATA", () => {
      const doc = DomUtilAcc.buildXmlFromPath(
        "content/html/source",
        "<p>hello</p>",
        "delivery",
      );

      const xml = DomUtil.toXMLString(doc.documentElement);
      expect(xml).to.include("<delivery>");
      expect(xml).to.include("<content><html><source>");
      expect(xml).to.include("<![CDATA[<p>hello</p>]]>");
    });

    it("should escape the CDATA terminator in content", () => {
      const doc = DomUtilAcc.buildXmlFromPath(
        "data",
        "const test = ']]>';",
        "javascript",
      );

      const xml = DomUtil.toXMLString(doc.documentElement);
      expect(xml).to.include("]]&gt;");
      expect(xml).to.include("const test = ");
    });
  });

  describe("resolveXPathTarget", () => {
    const service = () =>
      DomUtil.parse(`<service mode="0"><social category="1"/></service>`)
        .documentElement;

    it("should resolve an attribute of the start element", () => {
      const root = service();
      const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
        root,
        "@mode",
      );
      expect(node).to.equal(root);
      expect(attributeName).to.equal("mode");
    });

    it("should resolve an attribute of a child element", () => {
      const root = service();
      const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
        root,
        "social/@category",
      );
      expect(node.nodeName).to.equal("social");
      expect(attributeName).to.equal("category");
    });

    it("should resolve an element with no attribute name", () => {
      const root = service();
      const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
        root,
        "social",
      );
      expect(node.nodeName).to.equal("social");
      expect(attributeName).to.be.null;
    });

    it("should return a null node when an element on the way is missing", () => {
      const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
        service(),
        "absent/@mode",
      );
      expect(node).to.be.null;
      expect(attributeName).to.equal("mode");
    });

    it("should return nothing for an empty xpath", () => {
      expect(DomUtilAcc.resolveXPathTarget(service(), "")).to.deep.equal({
        node: null,
        attributeName: null,
      });
    });
  });

  describe("getDecomposedContent", () => {
    const firstChild = (xml) => DomUtil.parse(xml).documentElement.firstChild;

    it("should return the text value", () => {
      const element = firstChild(`<sql><data>SELECT 1;</data></sql>`);
      expect(DomUtilAcc.getDecomposedContent(element)).to.equal("SELECT 1;");
    });

    it("should return the CDATA value", () => {
      const element = firstChild(
        `<sql><data><![CDATA[SELECT '<b>';]]></data></sql>`,
      );
      expect(DomUtilAcc.getDecomposedContent(element)).to.equal(
        "SELECT '<b>';",
      );
    });

    it("should return the element as XML when it holds child elements", () => {
      const element = firstChild(
        `<workflow><activities id="1"><end name="end"/></activities></workflow>`,
      );
      expect(DomUtilAcc.getDecomposedContent(element)).to.equal(
        `<activities id="1"><end name="end"/></activities>`,
      );
    });

    it("should return an empty string for an empty element", () => {
      const element = firstChild(`<workflow><activities/></workflow>`);
      expect(DomUtilAcc.getDecomposedContent(element)).to.equal("");
    });
  });
});
