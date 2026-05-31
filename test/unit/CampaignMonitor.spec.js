import { expect } from "chai";
import sinon from "sinon";
import CampaignMonitor from "../../src/CampaignMonitor.js";
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
import { codes } from "../../src/helpers/AccErrors.js";
import { makeLogger } from "../helpers.js";

const { MONITOR_HOST_UNRESOLVED, MONITOR_ALIAS_UNKNOWN, MONITOR_TEST_FAILED } =
  codes;

describe("CampaignMonitor", () => {
  let logger, testStub, mockSdk, auth;

  beforeEach(() => {
    logger = makeLogger();
    // representation "xml" makes test() resolve a DOM document
    const dom = DomUtil.parse('<redir status="OK" instance="acme" build="1"/>');
    testStub = sinon.stub().resolves(dom);
    mockSdk = { init: sinon.stub().resolves({ test: testStub }) };
    auth = { instances: { prod: { host: "https://prod.example.com" } } };
  });

  describe("test", () => {
    it("should probe the given --host anonymously and return raw xml", async () => {
      const monitor = new CampaignMonitor(logger, mockSdk, auth);
      const result = await monitor.test({ host: "https://acme.example.com" });

      expect(result.status).to.equal("OK");
      expect(result.xml).to.contain('status="OK"');
      expect(result.xml).to.contain("redir");
      expect(mockSdk.init.calledOnce).to.be.true;
      expect(testStub.calledOnce).to.be.true;
    });

    it("should request the xml representation", async () => {
      const monitor = new CampaignMonitor(logger, mockSdk, auth);
      await monitor.test({ host: "https://acme.example.com" });

      const cp = mockSdk.init.firstCall.args[0];
      expect(cp._options.representation).to.equal("xml");
    });

    it("should resolve the host from a stored alias", async () => {
      const monitor = new CampaignMonitor(logger, mockSdk, auth);
      await monitor.test({ alias: "prod" });

      const cp = mockSdk.init.firstCall.args[0];
      expect(cp._endpoint).to.equal("https://prod.example.com");
    });

    it("should throw MONITOR_HOST_UNRESOLVED when neither host nor alias", async () => {
      const monitor = new CampaignMonitor(logger, mockSdk, auth);
      await expect(monitor.test({})).to.be.rejectedWith(
        MONITOR_HOST_UNRESOLVED,
      );
    });

    it("should throw MONITOR_ALIAS_UNKNOWN for an unknown alias", async () => {
      const monitor = new CampaignMonitor(logger, mockSdk, auth);
      await expect(monitor.test({ alias: "nope" })).to.be.rejectedWith(
        MONITOR_ALIAS_UNKNOWN,
      );
    });

    it("should wrap transport errors in MONITOR_TEST_FAILED", async () => {
      mockSdk.init.rejects(new Error("ECONNREFUSED"));
      const monitor = new CampaignMonitor(logger, mockSdk, auth);
      await expect(
        monitor.test({ host: "https://down.example.com" }),
      ).to.be.rejectedWith(MONITOR_TEST_FAILED);
    });
  });
});
