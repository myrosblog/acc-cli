// Keep the suite hermetic: never write the rotating acc.log to the user cache.
process.env.ACC_NO_FILE_LOG = "1";
// Silence the diagnostics logs during tests, except for errors which indicate test failures.
process.env.AIO_LOG_LEVEL = "error";

import * as chai from "chai";
import sinonChai from "sinon-chai";
import chaiAsPromised from "chai-as-promised";

chai.use(sinonChai);
chai.use(chaiAsPromised);

global.expect = chai.expect;

// unit tests
import "./unit/AccErrors.spec.js";
import "./unit/helpers/AccCache.spec.js";
import "./unit/helpers/makeLogger.spec.js";
import "./unit/helpers/soapLogObserver.spec.js";
import "./unit/helpers/jwt.spec.js";
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
import "./unit/commands/auth-decode.spec.js";
import "./unit/commands/instance-template.spec.js";
import "./unit/commands/instance-check.spec.js";
import "./unit/commands/instance-pull.spec.js";
import "./unit/commands/instance-exec.spec.js";
import "./unit/commands/instance-querydef.spec.js";
import "./unit/commands/instance-soap.spec.js";
import "./unit/commands/instance-info.spec.js";
import "./unit/commands/monitor-test.spec.js";

// integration tests
import "./integration/CampaignInstance.pull.spec.js";
