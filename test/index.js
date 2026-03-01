import * as chai from "chai";
import sinonChai from "sinon-chai";

chai.use(sinonChai);

global.expect = chai.expect;

// Import all test files
import "./CampaignError.spec.js";
import "./CampaignAuth.spec.js";
import "./CampaignInstance.spec.js";
import "./main.spec.js";