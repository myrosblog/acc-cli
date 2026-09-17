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
