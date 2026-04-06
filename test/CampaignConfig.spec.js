// npm
import fs from "fs-extra";
import { expect } from "chai";
import tmp from "tmp";
// sdk
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("CampaignAuth.spec");
// acc
import CampaignConfig from "../src/CampaignConfig.js";
import { codes } from "../src/helpers/AccErrors.js";
const {
  CONFIG_CONSTR_DEFAULT_PATH_MISSING,
  CONFIG_INIT_CONFIG_PATH_MISSING,
  CONFIG_PARSE_ERROR,
  CONFIG_VALIDATE_ERRORS,
} = codes;

describe("CampaignAuth", function () {
  let tmpConfigPath;

  beforeEach(() => {
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
    });

    describe("template", () => {
      it("should output the template config", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        expect(() => config.template()).to.not.throw();
      });
    });
  });
});
