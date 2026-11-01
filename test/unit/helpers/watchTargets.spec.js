import { join } from "node:path";
import { expect } from "chai";
import {
  buildWatchTargets,
  findMatchingTargets,
  getDecomposedSchemas,
  templateToGlob,
  toPosixPath,
} from "../../../src/helpers/watchTargets.js";

// Configuration with decomposed schemas
const testSchemas = [
  {
    schemaId: "xtk:javascript",
    filename: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
    decompose: {
      data: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
    },
  },
  {
    schemaId: "xtk:jst",
    filename:
      "/Admin/Config/JavaScript templates/{@namespace}/{@name}.meta.xml",
    decompose: {
      code: "/Admin/Config/JavaScript templates/{@namespace}/{@name}.js",
    },
  },
  {
    schemaId: "nms:delivery",
    filename: "/Campaign Management/Deliveries/{@internalName}.meta.xml",
    decompose: {
      "content/html/source":
        "/Campaign Management/Deliveries/{@internalName}.html",
      "content/text/source":
        "/Campaign Management/Deliveries/{@internalName}.txt",
    },
  },
  {
    schemaId: "xtk:folder",
    filename: "/Explorer/{@name}.meta.xml",
    // No decompose: filtered out
  },
];

describe("helpers/watchTargets", () => {
  describe("getDecomposedSchemas", () => {
    it("should return only schemas with decompose configuration", () => {
      const decomposed = getDecomposedSchemas(testSchemas);
      expect(decomposed).to.have.lengthOf(3);
      expect(decomposed.map((s) => s.schemaId)).to.include.members([
        "xtk:javascript",
        "xtk:jst",
        "nms:delivery",
      ]);
    });

    it("should return empty array when no schemas have decompose", () => {
      const decomposed = getDecomposedSchemas([
        { schemaId: "xtk:folder", filename: "/Explorer/{@name}.meta.xml" },
      ]);
      expect(decomposed).to.have.lengthOf(0);
    });

    it("should handle empty decompose object", () => {
      const decomposed = getDecomposedSchemas([
        {
          schemaId: "xtk:javascript",
          filename:
            "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
          decompose: {},
        },
      ]);
      expect(decomposed).to.have.lengthOf(0);
    });
  });

  describe("templateToGlob", () => {
    it("should convert simple template to glob", () => {
      expect(templateToGlob("/path/to/{@name}.js")).to.equal("path/to/*.js");
    });

    it("should convert template with namespace to glob", () => {
      expect(
        templateToGlob(
          "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
        ),
      ).to.equal("Admin/Config/JavaScript codes/*/*.js");
    });

    it("should convert template without @ prefix to glob", () => {
      expect(templateToGlob("/path/to/{name}.js")).to.equal("path/to/*.js");
    });
  });

  describe("buildWatchTargets", () => {
    const decomposedSchemas = getDecomposedSchemas(testSchemas);

    it("should build one target per decompose entry", () => {
      const watchTargets = buildWatchTargets(decomposedSchemas);

      // 1 xtk:javascript + 1 xtk:jst + 2 nms:delivery
      expect(watchTargets).to.have.lengthOf(4);
      expect(watchTargets.map((target) => target.pattern)).to.have.members([
        "Admin/Config/JavaScript codes/*/*.js",
        "Admin/Config/JavaScript templates/*/*.js",
        "Campaign Management/Deliveries/*.html",
        "Campaign Management/Deliveries/*.txt",
      ]);
    });

    it("should carry the schema config and xpath of each entry", () => {
      const watchTargets = buildWatchTargets(decomposedSchemas);

      const htmlTarget = watchTargets.find((target) =>
        target.pattern.endsWith(".html"),
      );
      expect(htmlTarget.schemaConfig.schemaId).to.equal("nms:delivery");
      expect(htmlTarget.xpath).to.equal("content/html/source");
    });

    it("should build patterns relative to the watch path", () => {
      buildWatchTargets(decomposedSchemas).forEach(({ pattern }) => {
        expect(pattern.startsWith("/")).to.be.false;
      });
    });

    it("should return no target for no schema", () => {
      expect(buildWatchTargets([])).to.deep.equal([]);
    });
  });

  describe("toPosixPath", () => {
    it("should keep a path that already uses /", () => {
      expect(toPosixPath("Admin/Config/a.js")).to.equal("Admin/Config/a.js");
    });

    it("should convert native separators to /", () => {
      expect(toPosixPath(join("Admin", "Config", "a.js"))).to.equal(
        "Admin/Config/a.js",
      );
    });
  });

  describe("findMatchingTargets", () => {
    const watchTargets = buildWatchTargets(getDecomposedSchemas(testSchemas));

    it("should find the target of a matching file", () => {
      const matches = findMatchingTargets(
        watchTargets,
        "Admin/Config/JavaScript codes/cus/myScript.js",
      );

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].schemaConfig.schemaId).to.equal("xtk:javascript");
      expect(matches[0].xpath).to.equal("data");
    });

    it("should discriminate two xpaths of the same schema by extension", () => {
      const [html] = findMatchingTargets(
        watchTargets,
        "Campaign Management/Deliveries/DM42.html",
      );
      const [text] = findMatchingTargets(
        watchTargets,
        "Campaign Management/Deliveries/DM42.txt",
      );

      expect(html.xpath).to.equal("content/html/source");
      expect(text.xpath).to.equal("content/text/source");
    });

    it("should match filenames containing glob metacharacters", () => {
      // Record values are not glob-escaped on pull, so "[" reaches the filesystem
      const [match] = findMatchingTargets(
        watchTargets,
        "Campaign Management/Deliveries/promo[2024].html",
      );

      expect(match.schemaConfig.schemaId).to.equal("nms:delivery");
    });

    it("should accept native path separators", () => {
      const [match] = findMatchingTargets(
        watchTargets,
        join("Admin", "Config", "JavaScript codes", "cus", "myScript.js"),
      );

      expect(match.schemaConfig.schemaId).to.equal("xtk:javascript");
    });

    it("should not let a single wildcard cross a directory", () => {
      expect(
        findMatchingTargets(
          watchTargets,
          "Campaign Management/Deliveries/2024/DM42.html",
        ),
      ).to.deep.equal([]);
    });

    it("should return nothing for a non-matching file path", () => {
      expect(
        findMatchingTargets(watchTargets, "some/random/path/file.js"),
      ).to.deep.equal([]);
    });

    it("should return nothing when there are no targets", () => {
      expect(
        findMatchingTargets([], "Admin/Config/JavaScript codes/cus/a.js"),
      ).to.deep.equal([]);
    });

    it("should return every target that claims the same file, in watch order", () => {
      const ambiguousTargets = buildWatchTargets([
        {
          schemaId: "xtk:javascript",
          decompose: { data: "/Shared/{@name}.js" },
        },
        { schemaId: "xtk:jst", decompose: { code: "/Shared/{@name}.js" } },
      ]);

      const matches = findMatchingTargets(ambiguousTargets, "Shared/both.js");

      expect(matches.map((match) => match.schemaConfig.schemaId)).to.deep.equal(
        ["xtk:javascript", "xtk:jst"],
      );
    });
  });
});
