// npm
import { expect } from "chai";
// acc
import { codes, wrapSdkError } from "../../src/helpers/AccErrors.js";

describe("AccErrors", () => {
  describe("wrapSdkError", () => {
    it("should extract all CampaignException fields when error is a full SDK error", () => {
      const sdkError = {
        statusCode: 500,
        faultCode: "DLV-490012",
        errorCode: "SDK-000010",
        faultString: "Session has expired",
        detail: "WDB-200011 The requested database record does not exist",
        methodCall: { methodName: "ExecuteQuery", urn: "xtk:queryDef" },
      };

      const wrapped = wrapSdkError(
        sdkError,
        codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
      );

      expect(wrapped.sdkDetails.statusCode).to.equal(500);
      expect(wrapped.sdkDetails.faultCode).to.equal("DLV-490012");
      expect(wrapped.sdkDetails.errorCode).to.equal("SDK-000010");
      expect(wrapped.sdkDetails.faultString).to.equal("Session has expired");
      expect(wrapped.sdkDetails.detail).to.equal(
        "WDB-200011 The requested database record does not exist",
      );
      expect(wrapped.sdkDetails.method).to.equal("ExecuteQuery");
      expect(wrapped.sdkDetails.urn).to.equal("xtk:queryDef");
    });

    it("should handle plain Error (no methodCall), covers lines 36-37 branch", () => {
      // A plain Error has no .methodCall → error?.methodCall is undefined
      // → the second ?. never fires → uncovered branch in c8
      const plainError = new Error("Network timeout");

      const wrapped = wrapSdkError(
        plainError,
        codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
      );

      // optional chaining gracefully yields undefined for missing fields
      expect(wrapped.sdkDetails.statusCode).to.be.undefined;
      expect(wrapped.sdkDetails.faultCode).to.be.undefined;
      expect(wrapped.sdkDetails.method).to.be.undefined; // error?.methodCall?.methodName
      expect(wrapped.sdkDetails.urn).to.be.undefined; // error?.methodCall?.urn
      expect(wrapped.sdkDetails.cause).to.be.undefined; // cause is on the root, not sdkDetails
    });

    it("should merge context into sdkDetails", () => {
      const err = new Error("create failed");

      const wrapped = wrapSdkError(
        err,
        codes.INSTANCE_PULL_SDK_CREATEQUERY_FAILED,
        { schemaId: "nms:delivery", startLine: 1 },
      );

      expect(wrapped.sdkDetails.schemaId).to.equal("nms:delivery");
      expect(wrapped.sdkDetails.startLine).to.equal(1);
    });

    it("should surface the server faultString in the rendered message", () => {
      // aio drops `cause` and never prints sdkDetails, so the reason is folded
      // into the message (appended, since these templates have no %s)
      const sdkError = {
        faultString: "Session has expired",
        errorCode: "SDK-000010",
      };
      const wrapped = wrapSdkError(
        sdkError,
        codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
      );
      expect(wrapped.message).to.contain("Session has expired");
    });

    it("should fall back to errorCode, then message, when no faultString", () => {
      expect(
        wrapSdkError(
          { errorCode: "XSV-350013" },
          codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
        ).message,
      ).to.contain("XSV-350013");
      expect(
        wrapSdkError(
          new Error("Network timeout"),
          codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
        ).message,
      ).to.contain("Network timeout");
    });
  });
});
