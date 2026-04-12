import * as chai from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";

chai.use(sinonChai);
chai.use(chaiAsPromised);

global.expect = chai.expect;

// Import all test files
import "./unit/AccErrors.spec.js";
import "./unit/CampaignConfig.spec.js";
import "./unit/CampaignAuth.spec.js";
import "./unit/CampaignInstance.spec.js";
import "./unit/commands/auth-init.spec.js";
import "./unit/commands/auth-login.spec.js";
import "./unit/commands/auth-ip.spec.js";
import "./unit/commands/instance-template.spec.js";
import "./unit/commands/instance-check.spec.js";
import "./unit/commands/instance-pull.spec.js";
