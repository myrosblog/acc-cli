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
});
