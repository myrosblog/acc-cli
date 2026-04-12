// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { ConnectionParameters } from "@adobe/acc-js-sdk/src/client.js";
import { CampaignException } from "@adobe/acc-js-sdk/src/campaign.js";
// acc
import CampaignAuth from "../src/CampaignAuth.js";
import { codes } from "../src/helpers/AccErrors.js";
const {
  AUTH_CONSTR_SDK_MISSING,
  AUTH_INIT_EXISTING_ALIAS,
  AUTH_LOGIN_ALIAS_MISSING,
  AUTH_LOGIN_ALIAS_EMPTY,
  AUTH_LOGIN_ALIAS_INVALID,
  AUTH_LOGIN_SDK_CONNECTIONPARAMETERS_FAILED,
  AUTH_LOGIN_SDK_INIT_FAILED,
  AUTH_LOGIN_SDK_LOGON_FAILED,
  AUTH_LOGIN_SDK_SERVERINFO_FAILED,
  AUTH_LOGIN_SDK_SERVERINFO_EMPTY,
} = codes;
// helpers
import { makeLogger } from "./helpers.js";

describe("CampaignAuth", function () {
  let mockSdk, mockConfig, mockLogger;
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

    // mock AioLogger
    mockLogger = makeLogger();

    // CampaignAuth now creates the adapter internally
    auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
  });

  describe("constructor", function () {
    it("should initialize with SDK and config", function () {
      expect(auth.sdk.init).to.exist;
      expect(auth.sdk.ip).to.exist;
      expect(auth.instances).to.be.an("object");
      expect(auth.instanceIds).to.be.an("array");
    });

    it("should throw AUTH_CONSTR_SDK_MISSING when SDK is missing", function () {
      expect(() => new CampaignAuth(mockLogger, null, mockConfig)).to.throw(
        AUTH_CONSTR_SDK_MISSING,
      );
    });
  });

  describe("init", function () {
    it("should add new instance when config.instances is null", async function () {
      let fakeInstances = null;

      mockConfig.get.callsFake(() => fakeInstances);

      mockConfig.set.callsFake(() => {});

      const authOptions = {
        alias: "instance1",
        host: "http://localhost",
        user: "testuser",
        pass: "testpass",
      };
      const sdkOptions = null;
      const cliOptions = null;

      sinon.stub(auth, "login").resolves();

      await auth.init(authOptions, sdkOptions, cliOptions);

      // check config.set()
      expect(mockConfig.set.calledOnce).to.be.true;
      expect(mockConfig.set.firstCall.args[0]).to.equal(
        `acc.auth.instances.instance1`,
      );
      expect(mockConfig.set.firstCall.args[1]).to.deep.equal({
        host: "http://localhost",
        user: "testuser",
        password: "testpass",
      });
      // check instances
      expect(auth.instances).to.deep.equal({
        instance1: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });
      expect(auth.instanceIds).to.deep.equal(["instance1"]);
      // check login()
      expect(auth.login.calledOnce).to.be.true;
      expect(auth.login.firstCall.args[0]).to.equal(authOptions);
      expect(auth.login.firstCall.args[1]).to.equal(sdkOptions);
      expect(auth.login.firstCall.args[2]).to.equal(cliOptions);
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
    it("should throw AUTH_LOGIN_ALIAS_MISSING when config cannot be parsed", async function () {
      mockConfig.get.threw(new Error("Generic error at parsing"));
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(
        auth.login({ alias: ["instance-array"] }),
      ).to.be.rejectedWith(AUTH_LOGIN_ALIAS_MISSING);
    });

    it("should throw AUTH_LOGIN_ALIAS_MISSING when instance doesn't exist with empty config", async function () {
      mockConfig.get.returns({});
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "empty-config" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_MISSING,
      );
    });

    it("should throw AUTH_LOGIN_ALIAS_MISSING when instance doesn't exist in config", async function () {
      mockConfig.get.returns({ existingAlias: {} });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "missingAlias" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_MISSING,
      );
    });

    it("should throw AUTH_LOGIN_ALIAS_EMPTY when config has null values", async function () {
      mockConfig.get.returns({ existingAlias: null });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "existingAlias" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_EMPTY,
      );
    });

    it("should throw AUTH_LOGIN_ALIAS_INVALID when instance doesn't exist in config", async function () {
      mockConfig.get.returns({ instance32: {} });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "instance32" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_INVALID,
      );
    });

    it("should throw AUTH_LOGIN_SDK_CONNECTIONPARAMETERS_FAILED when invalid sdkOptions", async function () {
      mockConfig.get.returns({
        local: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      // @see https://github.com/adobe/acc-js-sdk/blob/fc2c447d/test/client.test.js#L49-L54
      const err = AUTH_LOGIN_SDK_CONNECTIONPARAMETERS_FAILED;
      await expect(
        auth.login({ alias: "local" }, "BadgerFish"),
      ).to.be.rejectedWith(err);
      await expect(
        auth.login({ alias: "local" }, { representation: "Hello" }),
      ).to.be.rejectedWith(err);
    });

    it("should throw AUTH_LOGIN_SDK_INIT_FAILED when init fails", async function () {
      mockConfig.get.returns({
        local: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });

      mockSdk.init.rejects(
        new CampaignException(undefined, 400, 16384, `SDK-999999 sdk.init()`),
      );

      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "local" })).to.be.rejectedWith(
        AUTH_LOGIN_SDK_INIT_FAILED,
      );
    });

    it("should throw AUTH_LOGIN_SDK_LOGON_FAILED when init fails", async function () {
      mockConfig.get.returns({
        local: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });

      mockSdk.init.resolves({
        logon: sinon
          .stub()
          .threw(
            new CampaignException(
              undefined,
              400,
              16384,
              `SDK-999999 client.logon()`,
            ),
          ),
      });

      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "local" })).to.be.rejectedWith(
        AUTH_LOGIN_SDK_LOGON_FAILED,
      );
    });

    it("should throw AUTH_LOGIN_SDK_SERVERINFO_FAILED when server info is unavailable", async function () {
      mockConfig.get.returns({
        local: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });

      mockSdk.init.resolves({
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon
          .stub()
          .threw(
            new CampaignException(
              undefined,
              400,
              16384,
              `SDK-999999 client.getSessionInfo()`,
            ),
          ),
      });

      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "local" })).to.be.rejectedWith(
        AUTH_LOGIN_SDK_SERVERINFO_FAILED,
      );
    });

    it("should throw AUTH_LOGIN_SDK_SERVERINFO_EMPTY when server info is unavailable", async function () {
      mockConfig.get.returns({
        local: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });

      mockSdk.init.resolves({
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon.stub().returns({ serverInfo: null }),
      });

      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      await expect(auth.login({ alias: "local" })).to.be.rejectedWith(
        AUTH_LOGIN_SDK_SERVERINFO_EMPTY,
      );
    });

    it("should login successfully and return client", async function () {
      mockConfig.get.returns({
        local: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });

      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, null);
      const client = await auth.login({ alias: "local" });

      expect(client).to.exist;
      expect(mockSdk.init.calledOnce).to.be.true;
    });
  });

  describe("private methods", () => {
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
