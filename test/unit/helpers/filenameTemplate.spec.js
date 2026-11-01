import { expect } from "chai";
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
import {
  computeFilename,
  getTemplateAttributes,
  sanitizeFilenameValue,
} from "../../../src/helpers/filenameTemplate.js";

describe("filenameTemplate", () => {
  describe("getTemplateAttributes", () => {
    it("returns the placeholder names in template order", () => {
      expect(
        getTemplateAttributes("/Explorer/{@namespace}/{@name}.meta.xml"),
      ).to.deep.equal(["@namespace", "@name"]);
    });

    it("returns an empty array when the template has no placeholder", () => {
      expect(getTemplateAttributes("/Explorer/fixed.xml")).to.deep.equal([]);
    });

    it("returns repeated placeholders once per occurrence", () => {
      expect(getTemplateAttributes("{@name}/{@name}.xml")).to.deep.equal([
        "@name",
        "@name",
      ]);
    });
  });

  describe("sanitizeFilenameValue", () => {
    it("leaves a clean value untouched", () => {
      expect(sanitizeFilenameValue("myDelivery")).to.equal("myDelivery");
    });

    it("replaces POSIX and Windows path separators", () => {
      expect(sanitizeFilenameValue("a/b\\c")).to.equal("a_b_c");
    });

    it("neutralizes parent-dir refs so they cannot traverse", () => {
      expect(sanitizeFilenameValue("..")).to.equal("__");
      expect(sanitizeFilenameValue(".")).to.equal("_");
      // separators become "_", so "../" can no longer escape the directory
      expect(sanitizeFilenameValue("../../etc")).to.equal(".._.._etc");
    });

    it("strips NUL and control characters", () => {
      expect(sanitizeFilenameValue("a\x00b\x1fc")).to.equal("abc");
    });
  });

  describe("computeFilename", () => {
    const record = (name) =>
      DomUtil.getFirstChildElement(DomUtil.parse(`<delivery name="${name}"/>`));

    it("substitutes a clean attribute value", () => {
      expect(
        computeFilename("{@name}.meta.xml", ["@name"], record("DM42")),
      ).to.equal("DM42.meta.xml");
    });

    it("keeps subdirectories that come from the template", () => {
      expect(
        computeFilename("/Explorer/{@name}.meta.xml", ["@name"], record("foo")),
      ).to.equal("/Explorer/foo.meta.xml");
    });

    it("prevents path traversal injected through the attribute value", () => {
      // a malicious @name must not escape the download directory: every
      // separator becomes "_", so the result stays a single component
      expect(
        computeFilename(
          "{@name}.meta.xml",
          ["@name"],
          record("../../etc/passwd"),
        ),
      ).to.equal(".._.._etc_passwd.meta.xml");
    });

    it("does not interpret $ patterns from the value", () => {
      // record name is XML-escaped; the parsed attribute value is "a$&b"
      expect(
        computeFilename("{@name}.xml", ["@name"], record("a$&amp;b")),
      ).to.equal("a$&b.xml");
    });
  });
});
