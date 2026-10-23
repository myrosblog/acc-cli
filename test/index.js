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
import "./unit/BaseCommand.spec.js";
import "./unit/helpers/AccCache.spec.js";
import "./unit/helpers/makeLogger.spec.js";
import "./unit/helpers/soapLogObserver.spec.js";
import "./unit/helpers/soapResponse.spec.js";
import "./unit/helpers/cacheStatsLogger.spec.js";
import "./unit/helpers/jwt.spec.js";
import "./unit/helpers/DomUtilAcc.spec.js";
import "./unit/helpers/filenameTemplate.spec.js";
import "./unit/helpers/withSpinner.spec.js";
import "./unit/helpers/s2sCredentials.spec.js";
import "./unit/helpers/watchTargets.spec.js";
import "./unit/helpers/writeKey.spec.js";
import "./unit/helpers/AccInstancePullLog.spec.js";
import "./unit/helpers/AccInstancePushLog.spec.js";
import "./unit/helpers/hideCommand.spec.js";
import "./unit/validators/queryDef.spec.js";
import "./unit/services/config/AccConfig.spec.js";
import "./unit/services/auth/AccAuth.spec.js";
import "./unit/services/instance/AccInstancePull.spec.js";
import "./unit/services/instance/AccInstanceExec.spec.js";
import "./unit/services/instance/AccInstanceSoap.spec.js";
import "./unit/services/instance/AccInstanceQueryDef.spec.js";
import "./unit/services/instance/AccInstanceInfo.spec.js";
import "./unit/services/monitor/AccMonitor.spec.js";
import "./unit/services/instance/AccInstanceWatch.spec.js";
import "./unit/InstanceCommand.spec.js";
import "./unit/adapters/ImsAuthAdapter.spec.js";
import "./unit/adapters/PromptAdapter.spec.js";
import "./unit/commands/auth-init.spec.js";
import "./unit/commands/auth-login.spec.js";
import "./unit/commands/auth-list.spec.js";
import "./unit/commands/auth-ip.spec.js";
import "./unit/commands/auth-decode.spec.js";
import "./unit/commands/auth-index.spec.js";
import "./unit/commands/config.spec.js";
import "./unit/commands/instance-template.spec.js";
import "./unit/commands/instance-check.spec.js";
import "./unit/commands/instance-pull.spec.js";
import "./unit/commands/instance-exec.spec.js";
import "./unit/commands/instance-querydef.spec.js";
import "./unit/commands/instance-soap.spec.js";
import "./unit/commands/instance-info.spec.js";
import "./unit/commands/instance-watch.spec.js";
import "./unit/commands/monitor-test.spec.js";
import "./unit/commands/flag-chars.spec.js";

// integration tests
import "./integration/AccInstancePull.spec.js";
import "./integration/ConfigCommands.spec.js";
import "./integration/fail-fast.spec.js";
