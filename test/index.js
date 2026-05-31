import * as chai from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";

chai.use(sinonChai);
chai.use(chaiAsPromised);

global.expect = chai.expect;

// unit tests
import "./unit/AccErrors.spec.js";
import "./unit/CampaignConfig.spec.js";
import "./unit/CampaignAuth.spec.js";
import "./unit/CampaignInstance.spec.js";
import "./unit/CampaignMonitor.spec.js";
import "./unit/InstanceCommand.spec.js";
import "./unit/adapters/PromptAdapter.spec.js";
import "./unit/commands/auth-init.spec.js";
import "./unit/commands/auth-login.spec.js";
import "./unit/commands/auth-list.spec.js";
import "./unit/commands/auth-ip.spec.js";
import "./unit/commands/instance-template.spec.js";
import "./unit/commands/instance-check.spec.js";
import "./unit/commands/instance-pull.spec.js";
import "./unit/commands/instance-exec.spec.js";
import "./unit/commands/monitor-test.spec.js";

// integration tests
import "./integration/CampaignInstance.pull.spec.js";
