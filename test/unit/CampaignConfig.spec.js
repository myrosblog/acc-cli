// npm
import fs from "fs-extra";
import { expect } from "chai";
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

        const parsed = fs.readJsonSync(tmpConfigPath);

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

      it("should set createdFromTemplate when the file is generated", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.createdFromTemplate).to.be.true;
      });

      it("should not set createdFromTemplate when the file pre-exists", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        expect(config.createdFromTemplate).to.be.false;
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

      it("should throw CONFIG_PARSE_ERROR when config file misses quotes", () => {
        const configJson = `{"schemas": [{ "schemaId": "nms:delivery", filename: "{@name}.meta.xml" }]}`;
        fs.outputFileSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_PARSE_ERROR);
          expect(err.message).to.include(
            "Expected double-quoted property name in JSON at position",
          );
        }
      });

      it("should throw CONFIG_PARSE_ERROR when config file has trailing comma", () => {
        const configJson = `{"schemas": [{ "schemaId": "nms:delivery", "filename": "{@name}.meta.xml", }]}`;
        fs.outputFileSync(tmpConfigPath, configJson);
        const config = new CampaignConfig(logger, tmpConfigPath);
        try {
          config.init(tmpConfigPath);
          throw new Error("should have failed");
        } catch (err) {
          expect(err).to.be.instanceOf(CONFIG_PARSE_ERROR);
          expect(err.message).to.include(
            "Expected double-quoted property name in JSON at position",
          );
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
          expect(err.message).to.include(
            "Expected ',' or ']' after array element in JSON at position",
          );
        }
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

    describe("seedAlias", () => {
      it("should write the alias into a freshly created config", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);
        config.seedAlias("prod");

        expect(config.alias).to.equal("prod");
        expect(fs.readJsonSync(tmpConfigPath).alias).to.equal("prod");
      });

      it("should not touch a pre-existing config file", () => {
        const configJson = {
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);
        config.seedAlias("prod");

        expect(config.alias).to.be.undefined;
        expect(fs.readJsonSync(tmpConfigPath)).to.not.have.property("alias");
      });

      it("should not overwrite an existing alias", () => {
        const configJson = {
          alias: "staging",
          schemas: [{ schemaId: "nms:delivery", filename: "{@name}.meta.xml" }],
        };
        fs.writeJsonSync(tmpConfigPath, configJson);

        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);
        config.seedAlias("prod");

        expect(config.alias).to.equal("staging");
      });
    });

    describe("template", () => {
      it("should output the template config", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        expect(() => config.template()).to.not.throw();
      });
    });
  });
});
