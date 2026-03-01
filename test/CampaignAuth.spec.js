import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../src/CampaignAuth.js";
import CampaignError from "../src/CampaignError.js";

describe("CampaignAuth", function () {
  let mockSdk, mockConfig, auth;

  beforeEach(function () {
    // Mock SDK
    mockSdk = {
      getSDKVersion: sinon.stub().returns({ version: "1.0.0" }),
      ConnectionParameters: {
        ofUserAndPassword: sinon.stub().returns({})
      },
      init: sinon.stub().resolves({
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon.stub().returns({
          serverInfo: {
            instanceName: "test-instance",
            releaseName: "v1.0",
            buildNumber: "12345"
          }
        })
      })
    };

    // Mock Configstore
    mockConfig = {
      path: "test-config-path",
      get: sinon.stub(),
      set: sinon.stub()
    };

    auth = new CampaignAuth(mockSdk, mockConfig);
  });

  describe("constructor", function () {
    it("should initialize with SDK and config", function () {
      expect(auth.sdk).to.equal(mockSdk);
      expect(auth.config).to.equal(mockConfig);
      expect(auth.instances).to.deep.equal({});
      expect(auth.instanceIds).to.deep.equal([]);
    });

    it("should throw CampaignError when SDK is missing", function () {
      expect(() => new CampaignAuth(null, mockConfig)).to.throw(CampaignError);
    });

    it("should throw CampaignError when config is missing", function () {
      expect(() => new CampaignAuth(mockSdk, null)).to.throw(CampaignError);
    });
  });

  describe("init", function () {
    it("should add new instance and login", async function () {
      // Mock config.get to return empty for initial check, then return the instance for login
      let callCount = 0;
      mockConfig.get.callsFake((key) => {
        if (key === "instances") {
          // This is the first call checking if instances exist
          return {};
        } else if (key === "instances.test") {
          // This is the second call from login() getting instance data
          return { host: "http://localhost", user: "testuser", password: "testpass" };
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
        password: "testpass"
      };

      await auth.init(options);

      expect(mockConfig.set.calledOnce).to.be.true;
      expect(mockConfig.set.firstCall.args[0]).to.equal("instances.test");
      expect(mockConfig.set.firstCall.args[1]).to.deep.equal({
        host: "http://localhost",
        user: "testuser",
        password: "testpass"
      });
    });

    it("should throw CampaignError when instance already exists", async function () {
      auth.instances = { test: {} };
      auth.instanceIds = ["test"];

      const options = { alias: "test", host: "http://localhost", user: "testuser", password: "testpass" };

      try {
        await auth.init(options);
        expect.fail("Should have thrown CampaignError");
      } catch (err) {
        expect(err).to.be.instanceOf(CampaignError);
        expect(err.message).to.include("already exists");
      }
    });
  });

  describe("login", function () {
    it("should login successfully with valid credentials", async function () {
      mockConfig.get.returns({
        host: "http://localhost",
        user: "testuser",
        password: "testpass"
      });

      const client = await auth.login({ alias: "test" });

      expect(client).to.exist;
      expect(mockSdk.init.calledOnce).to.be.true;
    });

    it("should throw CampaignError when instance doesn't exist", async function () {
      mockConfig.get.returns(null);

      try {
        await auth.login({ alias: "nonexistent" });
        expect.fail("Should have thrown CampaignError");
      } catch (err) {
        expect(err).to.be.instanceOf(CampaignError);
        expect(err.message).to.include("doesn't exist");
      }
    });

    it("should throw CampaignError when server info is unavailable", async function () {
      mockConfig.get.returns({
        host: "http://localhost",
        user: "testuser",
        password: "testpass"
      });

      mockSdk.init.resolves({
        logon: sinon.stub().resolves(),
        getSessionInfo: sinon.stub().returns({ serverInfo: null })
      });

      try {
        await auth.login({ alias: "test" });
        expect.fail("Should have thrown CampaignError");
      } catch (err) {
        expect(err).to.be.instanceOf(CampaignError);
        expect(err.message).to.include("Unable to get server info");
      }
    });
  });

  describe("list", function () {
    it("should list all instances", function () {
      auth.instances = {
        prod: { host: "http://prod", user: "produser" },
        staging: { host: "http://staging", user: "staginguser" }
      };
      auth.instanceIds = ["prod", "staging"];

      // This is a console.log test, so we'll just verify it doesn't throw
      expect(() => auth.list()).to.not.throw();
    });

    it("should handle empty instances", function () {
      auth.instances = {};
      auth.instanceIds = [];

      expect(() => auth.list()).to.not.throw();
    });
  });
});