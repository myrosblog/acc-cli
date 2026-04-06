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
        expect(() => new CampaignConfig(logger)).to.throw(CONFIG_CONSTR_DEFAULT_PATH_MISSING);
        expect(() => new CampaignConfig(logger, null)).to.throw(CONFIG_CONSTR_DEFAULT_PATH_MISSING);
        expect(() => new CampaignConfig(logger, {})).to.throw(CONFIG_CONSTR_DEFAULT_PATH_MISSING);
      });
    });

    describe("init", () => {
      it("should throw on empty config path", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        expect(() => config.init()).to.throw(CONFIG_INIT_CONFIG_PATH_MISSING);
        expect(() => config.init(null)).to.throw(CONFIG_INIT_CONFIG_PATH_MISSING);
        expect(() => config.init("")).to.throw(CONFIG_INIT_CONFIG_PATH_MISSING);
      });

      it("should create JSON config from template if not existing", () => {
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
    });

    describe("validate", () => {
      //   it("should validate the mock", () => {
      //   });
      // it("should validate the default config", () => {
      //   const config = new CampaignConfig(tmpConfigPath);
      //   config.init(tmpConfigPath);
      //   config.validate();
      // });
    });
  });
});
