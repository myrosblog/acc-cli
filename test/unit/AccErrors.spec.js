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

    it("should leave the SOAP call details undefined for a plain Error", () => {
      // A plain Error has no .methodCall, so method and urn stay undefined
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

    it("should append the server detail to the rendered message", () => {
      // The faultString is generic, the detail names the missing schema
      const sdkError = {
        faultString:
          "Error while executing the method 'ExecuteQuery' of service 'xtk:queryDef'.",
        detail:
          "XFR-180000 Unable to load the document of identifier 'xtk:foo' and type 'xtk:schema'.",
      };
      const wrapped = wrapSdkError(
        sdkError,
        codes.INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED,
      );
      expect(wrapped.message).to.contain(
        "of service 'xtk:queryDef'. XFR-180000 Unable to load the document of identifier 'xtk:foo'",
      );
    });

    it("should not repeat the detail when the reason already contains it", () => {
      // Without faultString and errorCode, the CampaignException message
      // already ends with the detail
      const sdkError = {
        message: "500 - Error: WDB-200011 The record does not exist",
        detail: "WDB-200011 The record does not exist",
      };
      const { message } = wrapSdkError(
        sdkError,
        codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
      );
      expect(message.split("WDB-200011")).to.have.lengthOf(2);
    });

    it("should surface the detail alone when there is no other reason", () => {
      expect(
        wrapSdkError(
          { detail: "WDB-200011 The record does not exist" },
          codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
        ).message,
      ).to.contain("WDB-200011 The record does not exist");
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

    it("should keep the message of the error class when there is nothing to add", () => {
      const ErrorClass = codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED;
      const baseMessage = new ErrorClass().message;

      expect(wrapSdkError({}, ErrorClass).message).to.equal(baseMessage);
      expect(wrapSdkError(undefined, ErrorClass).message).to.equal(baseMessage);
      expect(wrapSdkError(null, ErrorClass).message).to.equal(baseMessage);
    });

    it("should fill the SDK details with undefined values for a missing error", () => {
      const wrapped = wrapSdkError(
        undefined,
        codes.INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED,
        { schemaId: "nms:delivery" },
      );

      expect(wrapped.sdkDetails.schemaId).to.equal("nms:delivery");
      expect(wrapped.sdkDetails.statusCode).to.be.undefined;
      expect(wrapped.sdkDetails.method).to.be.undefined;
    });
  });
});
