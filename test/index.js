import * as chai from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";

chai.use(sinonChai);
chai.use(chaiAsPromised);

global.expect = chai.expect;

// Import all test files
import "./CampaignConfig.spec.js";
import "./CampaignAuth.spec.js";
import "./CampaignInstance.spec.js";
import "./main.spec.js";
import "./commands/auth-init.spec.js";
import "./commands/auth-login.spec.js";
import "./commands/auth-ip.spec.js";
import "./commands/instance-template.spec.js";
import "./commands/instance-check.spec.js";
import "./commands/instance-pull.spec.js";
