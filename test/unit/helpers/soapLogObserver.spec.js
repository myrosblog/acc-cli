// npm
import { expect } from "chai";
import sinon from "sinon";
// acc
import soapLogObserver, {
  truncate,
  SOAP_LOG_MAX,
} from "../../../src/helpers/soapLogObserver.js";

describe("soapLogObserver", function () {
  describe("truncate", function () {
    it("returns short strings unchanged", function () {
      expect(truncate("hello")).to.equal("hello");
    });

    it("passes null/undefined through", function () {
      expect(truncate(null)).to.equal(null);
      expect(truncate(undefined)).to.equal(undefined);
    });

    it("caps at SOAP_LOG_MAX and appends the dropped length", function () {
      const long = "a".repeat(SOAP_LOG_MAX + 250);
      const out = truncate(long);
      expect(out).to.equal(`${"a".repeat(SOAP_LOG_MAX)}…[+250 chars]`);
    });

    it("keeps a string exactly at the cap unchanged", function () {
      const exact = "a".repeat(SOAP_LOG_MAX);
      expect(truncate(exact)).to.equal(exact);
    });

    it("honours a custom max", function () {
      expect(truncate("abcdef", 3)).to.equal("abc…[+3 chars]");
    });
  });

  describe("observer", function () {
    let logger, observer;
    const call = { urn: "xtk:session", methodName: "GetServerTime" };

    beforeEach(function () {
      logger = {
        verbose: sinon.stub(),
        warn: sinon.stub(),
      };
      observer = soapLogObserver(logger);
    });

    it("logs requests at verbose with method and truncated body", function () {
      observer.onSOAPCall(call, "a".repeat(SOAP_LOG_MAX + 5));
      expect(logger.verbose.calledOnce).to.be.true;
      const msg = logger.verbose.firstCall.args[0];
      expect(msg).to.include("SOAP-Request⏫ xtk:session#GetServerTime");
      expect(msg).to.include("…[+5 chars]");
    });

    it("logs responses at verbose", function () {
      observer.onSOAPCallSuccess(call, "<ok/>");
      expect(
        logger.verbose.calledOnceWith(
          "SOAP-Response⤵️ xtk:session#GetServerTime <ok/>",
        ),
      ).to.be.true;
    });

    it("logs failures at warn", function () {
      observer.onSOAPCallFailure(call, new Error("boom"));
      expect(logger.warn.calledOnce).to.be.true;
      expect(logger.warn.firstCall.args[0]).to.include(
        "SOAP-Error❌ xtk:session#GetServerTime",
      );
      expect(logger.warn.firstCall.args[0]).to.include("boom");
    });
  });
});
