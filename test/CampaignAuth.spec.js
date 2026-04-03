// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("CampaignAuth.spec");
// acc
import CampaignAuth from "../src/CampaignAuth.js";
import { codes } from "../src/helpers/AccErrors.js";
const {
  AUTH_CONSTR_SDK_MISSING,
  AUTH_INIT_EXISTING_ALIAS,
  AUTH_LOGIN_ALIAS_MISSING,
  AUTH_LOGIN_ALIAS_EMPTY,
  AUTH_LOGIN_ALIAS_INVALID,
  AUTH_LOGIN_SDK_INIT_FAILED,
  AUTH_LOGIN_SDK_SERVERINFO_FAILED,
} = codes;
import { ConnectionParameters } from "@adobe/acc-js-sdk/src/client.js";

describe("CampaignAuth", function () {
  let mockSdk, mockConfig;
  /**
   * @type {CampaignAuth}
   */
  let auth;

  beforeEach(function () {
    // Mock SDK
    mockSdk = {
      getSDKVersion: sinon.stub().returns({ version: "1.0.0" }),
      ConnectionParameters: {
        ofUserAndPassword: sinon.stub().returns({}),
      },
      init: sinon.stub().resolves({
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon.stub().returns({
          serverInfo: {
            instanceName: "test-instance",
            releaseName: "v1.0",
            buildNumber: "12345",
          },
        }),
      }),
      ip: sinon.stub().resolves({
        ipAddress: "11.11.11.11",
        continentCode: "EU",
        continentName: "Europe",
        countryCode: "FR",
        countryName: "France",
        stateProvCode: "ABC",
        stateProv: "Abc",
        city: "Def",
      }),
    };

    // Mock Configstore
    mockConfig = {
      global: { file: "test-config-path" },
      get: sinon.stub(),
      set: sinon.stub(),
      reload: sinon.stub(),
    };

    // CampaignAuth now creates the adapter internally
    auth = new CampaignAuth(logger, mockSdk, mockConfig, null);
  });

  describe("constructor", function () {
    it("should initialize with SDK and config", function () {
      expect(auth.sdk.init).to.exist;
      expect(auth.sdk.ip).to.exist;
      expect(auth.instances).to.be.an("object");
      expect(auth.instanceIds).to.be.an("array");
    });

    it("should throw AUTH_CONSTR_SDK_MISSING when SDK is missing", function () {
      expect(() => new CampaignAuth(logger, null, mockConfig)).to.throw(
        AUTH_CONSTR_SDK_MISSING,
      );
    });
  });

  describe("init", function () {
    it.skip("should add new instance and login", async function () {
      // Mock config.get to return empty for initial check, then return the instance for login
      let callCount = 0;
      mockConfig.get.callsFake((key) => {
        if (key === "instances") {
          // This is the first call checking if instances exist
          return {};
        } else if (key === "instances.test") {
          // This is the second call from login() getting instance data
          return {
            host: "http://localhost",
            user: "testuser",
            password: "testpass",
          };
        }
        return undefined;
      });

      mockConfig.set.callsFake((key, value) => {
        // Update the instances object to simulate config storage
        auth.instances = { test: value };
        auth.instanceIds = Object.keys(auth.instances);
      });

      const options = {
        alias: "test",
        host: "http://localhost",
        user: "testuser",
        pass: "testpass",
      };

      await auth.init(options);

      expect(mockConfig.set.calledOnce).to.be.true;
      expect(mockConfig.set.firstCall.args[0]).to.equal("instances.test");
      expect(mockConfig.set.firstCall.args[1]).to.deep.equal({
        host: "http://localhost",
        user: "testuser",
        password: "testpass",
      });
    });

    it("should throw AUTH_INIT_EXISTING_ALIAS when instance already exists", async function () {
      auth.instances = { test: {} };
      auth.instanceIds = ["test"];

      const options = {
        alias: "test",
        host: "http://localhost",
        user: "testuser",
        password: "testpass",
      };

      await expect(auth.init(options)).to.be.rejectedWith(
        AUTH_INIT_EXISTING_ALIAS,
      );
    });
  });

  describe("login", function () {
    it("should login successfully with valid credentials", async function () {
      mockConfig.get.returns({
        host: "http://localhost",
        user: "testuser",
        password: "testpass",
      });

      const client = await auth.login({ alias: "test" });

      expect(client).to.exist;
      expect(mockSdk.init.calledOnce).to.be.true;
    });

    it("should throw AUTH_LOGIN_ALIAS_MISSING when instance doesn't exist", async function () {
      mockConfig.get.returns(null);

      await expect(auth.login({ alias: "nonexistent" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_MISSING,
      );
    });

    it("should throw AUTH_LOGIN_SDK_SERVERINFO_FAILED when server info is unavailable", async function () {
      mockConfig.get.returns({
        host: "http://localhost",
        user: "testuser",
        password: "testpass",
      });

      mockSdk.init.resolves({
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon.stub().returns({ serverInfo: null }),
      });

      await expect(auth.login({ alias: "test" })).to.be.rejectedWith(
        AUTH_LOGIN_SDK_SERVERINFO_FAILED,
      );
    });

    it("should prepare connection with sdkOptions", async () => {
      let actual;
      actual = auth._prepareConnectionParameters("host", "user", "pass", null);
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._options.traceAPICalls).to.equal(false);
      actual = auth._prepareConnectionParameters("host", "user", "pass", {});
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._options.traceAPICalls).to.equal(false);
      actual = auth._prepareConnectionParameters("host", "user", "pass", {
        traceAPICalls: true,
      });
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._options.traceAPICalls).to.equal(true);
    });
  });

  describe("list", function () {
    it("should list all instances", function () {
      auth.instances = {
        prod: { host: "http://prod", user: "produser" },
        staging: { host: "http://staging", user: "staginguser" },
      };
      auth.instanceIds = ["prod", "staging"];

      // This is a console . log test, so we'll just verify it doesn't throw
      expect(() => auth.list()).to.not.throw();
    });

    it("should handle empty instances", function () {
      auth.instances = {};
      auth.instanceIds = [];

      expect(() => auth.list()).to.not.throw();
    });
  });

  describe("ip", () => {
    it("should display ip info", async () => {
      const ip = await auth.ip();
      expect(ip).to.deep.equal({
        ipAddress: "11.11.11.11",
        continentCode: "EU",
        continentName: "Europe",
        countryCode: "FR",
        countryName: "France",
        stateProvCode: "ABC",
        stateProv: "Abc",
        city: "Def",
      });
    });
  });
});
