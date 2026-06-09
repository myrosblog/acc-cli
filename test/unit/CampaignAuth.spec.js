// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { ConnectionParameters } from "@adobe/acc-js-sdk/src/client.js";
import { CampaignException } from "@adobe/acc-js-sdk/src/campaign.js";
// acc
import CampaignAuth from "../../src/CampaignAuth.js";
import { codes } from "../../src/helpers/AccErrors.js";
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
  AUTH_LOGIN_TOKEN_MISSING,
  AUTH_LOGIN_INVALID_METHOD,
} = codes;
// helpers
import { makeLogger } from "../helpers.js";

describe("CampaignAuth", function () {
  let mockSdk, mockConfig, mockLogger, mockPrompt, mockMakeCache;
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
        registerObserver: sinon.stub(),
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

    // Mock aio config
    mockConfig = {
      global: { file: "test-config-path" },
      get: sinon.stub(),
      set: sinon.stub(),
      reload: sinon.stub(),
    };

    // mock AioLogger
    mockLogger = makeLogger();

    // Default to a non-interactive prompt so tests are deterministic whether or
    // not `npm test` runs attached to a TTY. Tests that exercise the
    // interactive path inject their own prompt.
    mockPrompt = {
      isInteractive: sinon.stub().returns(false),
      input: sinon.stub(),
      password: sinon.stub(),
      select: sinon.stub(),
    };

    // Stub cache factory so login() never touches the filesystem in tests.
    mockMakeCache = sinon.stub().returns({});

    auth = new CampaignAuth(
      mockLogger,
      mockSdk,
      mockConfig,
      mockPrompt,
      mockMakeCache,
    );
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
        authMethod: "UserPassword",
        user: "testuser",
        password: "testpass",
      });
      // check instances
      expect(auth.instances).to.deep.equal({
        instance1: {
          host: "http://localhost",
          authMethod: "UserPassword",
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
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
      await expect(
        auth.login({ alias: ["instance-array"] }),
      ).to.be.rejectedWith(AUTH_LOGIN_ALIAS_MISSING);
    });

    it("should throw AUTH_LOGIN_ALIAS_MISSING when instance doesn't exist with empty config", async function () {
      mockConfig.get.returns({});
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
      await expect(auth.login({ alias: "empty-config" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_MISSING,
      );
    });

    it("should throw AUTH_LOGIN_ALIAS_MISSING when instance doesn't exist in config", async function () {
      mockConfig.get.returns({ existingAlias: {} });
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
      await expect(auth.login({ alias: "missingAlias" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_MISSING,
      );
    });

    it("should throw AUTH_LOGIN_ALIAS_EMPTY when config has null values", async function () {
      mockConfig.get.returns({ existingAlias: null });
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
      await expect(auth.login({ alias: "existingAlias" })).to.be.rejectedWith(
        AUTH_LOGIN_ALIAS_EMPTY,
      );
    });

    it("should throw AUTH_LOGIN_ALIAS_INVALID when instance doesn't exist in config", async function () {
      mockConfig.get.returns({ instance32: {} });
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
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
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
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

      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
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
        registerObserver: sinon.stub(),
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

      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
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
        registerObserver: sinon.stub(),
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

      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
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
        registerObserver: sinon.stub(),
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon.stub().returns({ serverInfo: null }),
      });

      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        mockMakeCache,
      );
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

      // Inject a stub cache factory so the test never touches the filesystem.
      const makeCache = sinon.stub().returns({});
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        makeCache,
      );
      const client = await auth.login({ alias: "local" });

      expect(client).to.exist;
      expect(mockSdk.init.calledOnce).to.be.true;
      expect(makeCache.calledOnce).to.be.true;
    });

    it("wires the injected cache factory as SDK storage", async function () {
      mockConfig.get.returns({
        local: { host: "http://localhost", user: "u", password: "p" },
      });
      const sentinelCache = { getItem() {}, setItem() {}, removeItem() {} };
      const makeCache = sinon.stub().returns(sentinelCache);
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        makeCache,
      );
      const prepStub = sinon
        .stub(auth, "_prepareConnectionParameters")
        .returns({});

      await auth.login({ alias: "local" });

      expect(makeCache.calledOnce).to.be.true;
      // the factory receives the alias so each instance caches separately
      expect(makeCache.firstCall.args[0]).to.equal("local");
      const sdkOptions = prepStub.firstCall.args[2];
      expect(sdkOptions.storage).to.equal(sentinelCache);
    });

    it("does not create a cache when noStorage is set", async function () {
      mockConfig.get.returns({
        local: { host: "http://localhost", user: "u", password: "p" },
      });
      const makeCache = sinon.stub();
      auth = new CampaignAuth(
        mockLogger,
        mockSdk,
        mockConfig,
        mockPrompt,
        makeCache,
      );
      const prepStub = sinon
        .stub(auth, "_prepareConnectionParameters")
        .returns({});

      await auth.login({ alias: "local" }, { noStorage: true });

      expect(makeCache.notCalled).to.be.true;
      expect(prepStub.firstCall.args[2].storage).to.be.undefined;
    });

    it("should login a legacy instance (no authMethod) as UserPassword", async function () {
      // Back-compat: entries stored before IMS support have no authMethod.
      mockConfig.get.returns({
        legacy: {
          host: "http://localhost",
          user: "testuser",
          password: "testpass",
        },
      });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig);
      const spy = sinon.spy(auth, "_prepareConnectionParameters");

      await auth.login({ alias: "legacy" });

      expect(spy.firstCall.args[0]).to.equal("UserPassword");
    });

    it("should login successfully with an IMS bearer token instance", async function () {
      mockConfig.get.returns({
        ims: {
          host: "http://localhost",
          authMethod: "ImsBearerToken",
          token: "ims-token",
        },
      });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig);
      const client = await auth.login({ alias: "ims" });

      expect(client).to.exist;
      expect(mockSdk.init.calledOnce).to.be.true;
    });

    it("should throw AUTH_LOGIN_TOKEN_MISSING for an IMS instance without token", async function () {
      mockConfig.get.returns({
        ims: { host: "http://localhost", authMethod: "ImsBearerToken" },
      });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig);
      await expect(auth.login({ alias: "ims" })).to.be.rejectedWith(
        AUTH_LOGIN_TOKEN_MISSING,
      );
    });

    it("should throw AUTH_LOGIN_INVALID_METHOD for an unknown authMethod", async function () {
      mockConfig.get.returns({
        weird: { host: "http://localhost", authMethod: "Telepathy" },
      });
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig);
      await expect(auth.login({ alias: "weird" })).to.be.rejectedWith(
        AUTH_LOGIN_INVALID_METHOD,
      );
    });
  });

  describe("init prompting", function () {
    it("should prompt for missing fields (masked password) when interactive", async function () {
      mockConfig.get.returns(null);
      const mockPrompt = {
        isInteractive: sinon.stub().returns(true),
        input: sinon.stub(),
        password: sinon.stub().resolves("secret"),
        select: sinon.stub().resolves("UserPassword"),
      };
      // Prompt order: host -> method -> user -> (masked password) -> alias
      mockPrompt.input
        .onCall(0)
        .resolves("http://localhost") // host
        .onCall(1)
        .resolves("admin") // user
        .onCall(2)
        .resolves("prod"); // alias
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, mockPrompt);
      sinon.stub(auth, "login").resolves();

      await auth.init({});

      expect(mockPrompt.input.callCount).to.equal(3);
      expect(mockPrompt.select.calledOnce).to.be.true;
      expect(mockPrompt.password.calledOnce).to.be.true;
      expect(mockConfig.set.firstCall.args[0]).to.equal(
        "acc.auth.instances.prod",
      );
      expect(mockConfig.set.firstCall.args[1]).to.deep.equal({
        host: "http://localhost",
        authMethod: "UserPassword",
        user: "admin",
        password: "secret",
      });
    });

    it("should prompt for IMS bearer token (masked) when method is ImsBearerToken", async function () {
      mockConfig.get.returns(null);
      const mockPrompt = {
        isInteractive: sinon.stub().returns(true),
        input: sinon.stub(),
        password: sinon.stub().resolves("ims-token"),
        select: sinon.stub().resolves("ImsBearerToken"),
      };
      // Prompt order: host -> method -> (masked token) -> alias
      mockPrompt.input
        .onCall(0)
        .resolves("http://localhost") // host
        .onCall(1)
        .resolves("prod"); // alias
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, mockPrompt);
      sinon.stub(auth, "login").resolves();

      await auth.init({});

      expect(mockPrompt.select.calledOnce).to.be.true;
      expect(mockPrompt.password.calledOnce).to.be.true;
      expect(mockConfig.set.firstCall.args[1]).to.deep.equal({
        host: "http://localhost",
        authMethod: "ImsBearerToken",
        token: "ims-token",
      });
    });

    it("should not prompt and keep provided options when non-interactive", async function () {
      mockConfig.get.returns(null);
      const mockPrompt = {
        isInteractive: sinon.stub().returns(false),
        input: sinon.stub(),
        password: sinon.stub(),
        select: sinon.stub(),
      };
      auth = new CampaignAuth(mockLogger, mockSdk, mockConfig, mockPrompt);
      sinon.stub(auth, "login").resolves();

      await auth.init({
        alias: "prod",
        host: "http://localhost",
        user: "admin",
        pass: "secret",
      });

      expect(mockPrompt.input.called).to.be.false;
      expect(mockPrompt.password.called).to.be.false;
      expect(mockPrompt.select.called).to.be.false;
      expect(mockConfig.set.firstCall.args[1]).to.deep.equal({
        host: "http://localhost",
        authMethod: "UserPassword",
        user: "admin",
        password: "secret",
      });
    });
  });

  describe("private methods", () => {
    const userPass = { host: "host", user: "user", password: "pass" };

    it("should prepare connection with sdkOptions", async () => {
      let actual;
      actual = auth._prepareConnectionParameters(
        "UserPassword",
        userPass,
        null,
      );
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._options.traceAPICalls).to.equal(false);
      actual = auth._prepareConnectionParameters("UserPassword", userPass, {});
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._options.traceAPICalls).to.equal(false);
      actual = auth._prepareConnectionParameters("UserPassword", userPass, {
        traceAPICalls: true,
      });
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._options.traceAPICalls).to.equal(true);
    });

    it("should prepare an IMS bearer token connection with sessionInfo", async () => {
      const actual = auth._prepareConnectionParameters(
        "ImsBearerToken",
        { host: "host", token: "ims-token" },
        { traceAPICalls: true },
      );
      expect(actual).to.be.an.instanceof(ConnectionParameters);
      expect(actual._credentials._type).to.equal("ImsBearerToken");
      expect(actual._options.sessionInfo).to.equal(true);
      expect(actual._options.traceAPICalls).to.equal(true);
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

  describe("list", () => {
    it("should map instances to redacted rows sorted by alias", () => {
      auth.instances = {
        staging: { host: "http://stg", user: "ops", password: "s3cret" },
        prod: { host: "http://prod", user: "admin", password: "p4ss" },
      };
      auth.instanceIds = Object.keys(auth.instances);

      const rows = auth.list();

      expect(rows).to.deep.equal([
        {
          alias: "prod",
          host: "http://prod",
          user: "admin",
          method: "UserPassword",
        },
        {
          alias: "staging",
          host: "http://stg",
          user: "ops",
          method: "UserPassword",
        },
      ]);
    });

    it("should never expose the stored password", () => {
      auth.instances = {
        prod: { host: "http://prod", user: "admin", password: "p4ss" },
      };
      auth.instanceIds = Object.keys(auth.instances);

      const rows = auth.list();

      expect(JSON.stringify(rows)).to.not.include("p4ss");
      expect(rows[0]).to.not.have.property("password");
    });

    it("should return an empty array when no instances are configured", () => {
      auth.instances = {};
      auth.instanceIds = [];
      expect(auth.list()).to.deep.equal([]);
    });
  });

  describe("_methodOf", () => {
    it("should return UserPassword when a password is present", () => {
      expect(auth._methodOf({ password: "x" })).to.equal("UserPassword");
    });

    it("should return Unknown when no password is present", () => {
      expect(auth._methodOf({ user: "admin" })).to.equal("Unknown");
      expect(auth._methodOf({})).to.equal("Unknown");
      expect(auth._methodOf(null)).to.equal("Unknown");
    });
  });
});
