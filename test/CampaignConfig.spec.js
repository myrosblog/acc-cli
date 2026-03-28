// npm
import fs from "fs-extra";
import { expect } from "chai";
import tmp from "tmp";
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
        expect(() => new CampaignConfig()).to.throw();
        expect(() => new CampaignConfig(null)).to.throw();
        expect(() => new CampaignConfig({})).to.throw();
      });

      it("should create config from template if not existing", () => {
        const config = new CampaignConfig(tmpConfigPath);
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
