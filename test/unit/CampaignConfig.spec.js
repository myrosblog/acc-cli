// node
import path from "node:path";
import { fileURLToPath } from "url";
// npm
import fs from "fs-extra";
import { expect } from "chai";
import hjson from "hjson";
import tmp from "tmp";
// sdk
import { makeLogger } from "../helpers.js";
// acc
import CampaignConfig from "../../src/CampaignConfig.js";
import { codes } from "../../src/helpers/AccErrors.js";
const {
  CONFIG_CONSTR_DEFAULT_PATH_MISSING,
  CONFIG_INIT_CONFIG_PATH_MISSING,
  CONFIG_PARSE_ERROR,
  CONFIG_VALIDATE_ERRORS,
} = codes;
const templatePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/acc.config.json",
);

describe("CampaignAuth", function () {
  let tmpConfigPath, logger;

  beforeEach(() => {
    logger = makeLogger();
    // prepare a random config path
    tmpConfigPath = tmp.tmpNameSync({ postfix: ".json" });
  });

  afterEach(() => {
    if (fs.existsSync(tmpConfigPath)) {
      fs.unlinkSync(tmpConfigPath);
    }
  });

  describe("CampaignConfig", () => {
    describe("constructor", () => {
      it("should throw on empty config path", () => {
        expect(() => new CampaignConfig(logger)).to.throw(
          CONFIG_CONSTR_DEFAULT_PATH_MISSING,
        );
        expect(() => new CampaignConfig(logger, null)).to.throw(
          CONFIG_CONSTR_DEFAULT_PATH_MISSING,
        );
        expect(() => new CampaignConfig(logger, {})).to.throw(
          CONFIG_CONSTR_DEFAULT_PATH_MISSING,
        );
      });
    });

    describe("init", () => {
      it("should throw on empty config path", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        expect(() => config.init()).to.throw(CONFIG_INIT_CONFIG_PATH_MISSING);
        expect(() => config.init(null)).to.throw(
          CONFIG_INIT_CONFIG_PATH_MISSING,
        );
        expect(() => config.init("")).to.throw(CONFIG_INIT_CONFIG_PATH_MISSING);
      });

      it("should create template JSON config and validate it", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        const fileExists = fs.existsSync(tmpConfigPath);
        expect(fileExists).to.be.true;

        const parsed = hjson.parse(fs.readFileSync(tmpConfigPath, "utf8"));

        expect(parsed).to.have.property("schemas");
        expect(parsed.schemas).to.be.an("array");

        expect(parsed).to.have.property("acc-js-sdk");
        expect(parsed["acc-js-sdk"]).to.be.an("object");
      });

      it("should use the provided JSON config and validate it", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.schemas).to.deep.equal(configJson.schemas);
      });

      it("should read the project alias when present", () => {
        const configJson = {
          alias: "prod",
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.alias).to.equal("prod");
      });

      it("should leave alias undefined when absent", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.alias).to.be.undefined;
      });

      it("should generate the config as the template, byte for byte, without alias", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(fs.readFileSync(tmpConfigPath, "utf8")).to.equal(
          fs.readFileSync(templatePath, "utf8"),
        );
      });

      it("should leave the alias placeholder commented out without alias", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.alias).to.be.undefined;
      });

      it("should seed the alias by uncommenting the template placeholder", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath, "prod");

        expect(config.alias).to.equal("prod");
        const generatedLines = fs
          .readFileSync(tmpConfigPath, "utf8")
          .split("\n");
        const templateLines = fs.readFileSync(templatePath, "utf8").split("\n");
        const changedLines = generatedLines.filter(
          (line, index) => line !== templateLines[index],
        );
        expect(generatedLines).to.have.lengthOf(templateLines.length);
        expect(changedLines).to.deep.equal([
          '  "alias": "prod", // Default instance alias, used when --alias is omitted',
        ]);
      });

      it("should escape a seeded alias containing a quote", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath, 'my"alias');

        expect(config.alias).to.equal('my"alias');
      });

      it("should not modify a pre-existing config when an alias is given", () => {
        const content = `{"schemas": [{ "schemaId": "nms:delivery", "filename": "{@name}.meta.xml" }]}`;
        fs.outputFileSync(tmpConfigPath, content);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath, "prod");

        expect(config.alias).to.be.undefined;
        expect(fs.readFileSync(tmpConfigPath, "utf8")).to.equal(content);
      });

      it("should throw CONFIG_PARSE_ERROR when config file doesn't exist", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init("fakepath");
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_PARSE_ERROR);
          expect(err.message).to.include("ENOENT: no such file or directory");
        }
      });

      it("should accept comments and trailing commas", () => {
        const configJson = `{
  // line comment
  /* block comment */
  # hash comment
  "alias": "prod", // trailing comment
  "schemas": [
    { "schemaId": "nms:delivery", "filename": "{@name}.meta.xml", },
  ],
}`;
        fs.outputFileSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.alias).to.equal("prod");
        expect(config.schemas).to.deep.equal([
          { schemaId: "nms:delivery", filename: "{@name}.meta.xml" },
        ]);
      });

      it("should throw CONFIG_PARSE_ERROR with the line when config file has a double comma", () => {
        const configJson = `{
  "schemas": [
    { "schemaId": "nms:delivery", "filename": "{@name}.meta.xml" },,
  ]
}`;
        fs.outputFileSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_PARSE_ERROR);
          expect(err.message).to.include("at line 3,");
        }
      });

      it("should throw CONFIG_PARSE_ERROR when config file has unclosed array", () => {
        const configJson = `{"schemas": [{ "schemaId": "nms:delivery", "filename": "{@name}.meta.xml" }}`;
        fs.outputFileSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_PARSE_ERROR);
          expect(err.message).to.include("at line 1,");
        }
      });

      it("should accept the common acc-js-sdk connection options", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
          "acc-js-sdk": {
            traceAPICalls: false,
            noStorage: true,
            timeout: 30000,
            instanceKey: "prod",
            extraHttpHeaders: { "X-Foo": "bar" },
          },
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.accJsSdkOptions).to.deep.equal(configJson["acc-js-sdk"]);
      });

      it("should throw CONFIG_VALIDATE_ERRORS when acc-js-sdk.timeout is not a number", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
          "acc-js-sdk": { timeout: "nope" },
        };
        fs.writeJsonSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_VALIDATE_ERRORS);
          expect(err.message).to.include("must be number");
        }
      });

      // storage/transport are runtime-only objects the CLI owns (login overwrites
      // storage with a per-instance cache). Forbid them in the JSON config so a
      // user gets an explicit error rather than a silent override.
      ["storage", "transport"].forEach((forbidden) => {
        it(`should throw CONFIG_VALIDATE_ERRORS when acc-js-sdk.${forbidden} is set`, () => {
          const configJson = {
            schemas: [
              { schemaId: "nms:delivery", filename: "{@name}.meta.xml" },
            ],
            "acc-js-sdk": { [forbidden]: {} },
          };
          fs.writeJsonSync(tmpConfigPath, configJson);
          const config = new CampaignConfig(logger, tmpConfigPath);
          try {
            config.init(tmpConfigPath);
            throw new Error("should have failed");
          } catch (err) {
            expect(err).to.be.instanceOf(CONFIG_VALIDATE_ERRORS);
            expect(err.message).to.include("must NOT be valid");
          }
        });
      });

      it("should throw CONFIG_VALIDATE_ERRORS on config missing 'schemas'", () => {
        const configJson = {
          schemasTYPO: [
            { schemaId: "nms:delivery", filename: "{@name}.meta.xml" },
          ],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_VALIDATE_ERRORS);
          expect(err.message).to.include(
            "must have required property 'schemas'",
          );
        }
      });

      it("should throw CONFIG_VALIDATE_ERRORS on config 'schemas' not array", () => {
        const configJson = {
          schemas: {
            schemaIdTYPO: "nms:delivery",
            filename: "{@name}.meta.xml",
          },
        };
        fs.writeJsonSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_VALIDATE_ERRORS);
          expect(err.message).to.include("schemas must be array");
        }
      });

      it("should throw CONFIG_VALIDATE_ERRORS on config missing 'schemas.schemaId'", () => {
        const configJson = {
          schemas: [
            { schemaIdTYPO: "nms:delivery", filename: "{@name}.meta.xml" },
          ],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_VALIDATE_ERRORS);
          expect(err.message).to.include(
            "must have required property 'schemaId'",
          );
        }
      });

      it("should throw CONFIG_VALIDATE_ERRORS on config missing 'schemas.filename'", () => {
        const configJson = {
          schemas: [
            { schemaId: "nms:delivery", filenameTYPO: "{@name}.meta.xml" },
          ],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_VALIDATE_ERRORS);
          expect(err.message).to.include(
            "must have required property 'filename'",
          );
        }
      });

      it("should load acc-js-sdk options when provided in config", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
          "acc-js-sdk": { traceAPICalls: true },
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.accJsSdkOptions).to.deep.equal({ traceAPICalls: true });
      });

      it("should default accJsSdkOptions to empty object when not in config", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
          // no "acc-js-sdk" key
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.accJsSdkOptions).to.deep.equal({});
      });
    });

    describe("template", () => {
      it("should return the template config content", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        const content = config.template();
        expect(content).to.be.a("string");
        expect(content).to.include("schemas");
      });
    });
  });
});
