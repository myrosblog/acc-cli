// npm
import fs from "fs-extra";
import { expect } from "chai";
import tmp from "tmp";
// sdk
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("CampaignAuth.spec");
// acc
import CampaignConfig from "../src/CampaignConfig.js";

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
    describe("init", () => {
      it("should throw on empty config", () => {
        expect(() => new CampaignConfig(logger)).to.throw();
        expect(() => new CampaignConfig(logger, null)).to.throw();
        expect(() => new CampaignConfig(logger, {})).to.throw();
      });

      it("should create config from template if not existing", () => {
        const config = new CampaignConfig(logger, tmpConfigPath);
        config.init(tmpConfigPath);

        const fileExists = fs.existsSync(tmpConfigPath);
        expect(fileExists).to.be.true;
      });
    });

    describe("validate", () => {
      //   it("should validate the mock", () => {

      //   });

      it("should validate the default config", () => {
        const config = new CampaignConfig(tmpConfigPath);
        config.init(tmpConfigPath);
        config.validate();
      });
    });
  });
});
