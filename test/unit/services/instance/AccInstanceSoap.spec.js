// npm
import { expect } from "chai";
import sinon from "sinon";
// helpers
import { makeClient, makeLogger, makeSpinner } from "../../../helpers.js";
// acc
import AccInstanceSoap from "../../../../src/services/instance/AccInstanceSoap.js";

describe("AccInstanceSoap", () => {
  let mockClient, mockLogger, mockSpinner, instance;

  beforeEach(() => {
    // mock client
    mockClient = makeClient();

    // mock AioLogger
    mockLogger = makeLogger();

    // mock ora spinner
    mockSpinner = () => makeSpinner();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("soap", () => {
    const newInstance = () =>
      new AccInstanceSoap(mockLogger, mockClient, mockSpinner);

    // Client stub recording the registered observers, so a test can emit SOAP responses
    const observableClient = (nlws) => {
      const observers = [];
      return {
        NLWS: nlws,
        observers,
        registerObserver: (observer) => observers.push(observer),
        unregisterObserver: (observer) =>
          observers.splice(observers.indexOf(observer), 1),
        // The SDK passes a token-masked copy as 2nd argument: unused by the code
        emit: (call) =>
          observers.forEach((o) => o.onSOAPCallSuccess(call, "<masked/>")),
      };
    };
    const soapEnvelope = (methodName, returnValues) =>
      `<SOAP-ENV:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:SOAP-ENV='http://schemas.xmlsoap.org/soap/envelope/'><SOAP-ENV:Body><${methodName}Response xmlns='urn:xtk:session'>${returnValues}</${methodName}Response></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

    it("_toSchemaKey maps a schema id to the NLWS camelCase key", () => {
      instance = newInstance();
      expect(instance._toSchemaKey("nms:delivery")).to.equal("nmsDelivery");
      expect(instance._toSchemaKey("xtk:queryDef")).to.equal("xtkQueryDef");
      expect(instance._toSchemaKey("xtk:fileRes")).to.equal("xtkFileRes");
      // already a key / malformed: passes through untouched
      expect(instance._toSchemaKey("nmsDelivery")).to.equal("nmsDelivery");
    });

    it("should call the method via the adapter and return its raw values (human mode)", async () => {
      instance = newInstance();
      const adapterStub = sinon
        .stub(instance, "adapterCallSoap")
        .resolves("<preview/>");

      const result = await instance.soap({
        schema: "nms:delivery",
        method: "BuildPreviewFromId",
        args: "[1234]",
      });

      expect(adapterStub.calledOnce).to.be.true;
      const [schemaKey, method, args, json] = adapterStub.firstCall.args;
      expect(schemaKey).to.equal("nmsDelivery"); // mapped from nms:delivery
      expect(method).to.equal("BuildPreviewFromId");
      expect(args).to.deep.equal([1234]); // parsed from the JSON array string
      expect(json).to.not.be.ok;
      expect(result).to.equal("<preview/>");
      expect(mockLogger.verbose.calledWith("<preview/>")).to.be.true;
    });

    it("should forward raw to the adapter", async () => {
      instance = newInstance();
      const adapterStub = sinon
        .stub(instance, "adapterCallSoap")
        .resolves("<SOAP-ENV:Envelope/>");

      const result = await instance.soap({
        schema: "xtk:session",
        method: "GetOption",
        raw: true,
      });

      expect(adapterStub.firstCall.args[4]).to.equal(true);
      expect(result).to.equal("<SOAP-ENV:Envelope/>");
    });

    it("should return the SimpleJson result as-is when json:true", async () => {
      instance = newInstance();
      const jsonResult = { serverTime: "2026-06-26" };
      const adapterStub = sinon
        .stub(instance, "adapterCallSoap")
        .resolves(jsonResult);

      const result = await instance.soap({
        schema: "xtk:session",
        method: "GetServerTime",
        json: true,
      });

      // no --args: the adapter is called with an empty argument list
      expect(adapterStub.firstCall.args[2]).to.deep.equal([]);
      expect(adapterStub.firstCall.args[3]).to.equal(true);
      expect(result).to.deep.equal(jsonResult);
    });

    it("should throw INSTANCE_SOAP_BAD_ARGS when --args is not valid JSON", async () => {
      instance = newInstance();
      await expect(
        instance.soap({
          schema: "xtk:session",
          method: "GetOption",
          args: "[not json",
        }),
      ).to.be.rejectedWith(/--args is not valid JSON/);
    });

    it("should throw INSTANCE_SOAP_ARGS_NOT_ARRAY when --args is not a JSON array", async () => {
      instance = newInstance();
      await expect(
        instance.soap({
          schema: "xtk:session",
          method: "GetOption",
          args: "5",
        }),
      ).to.be.rejectedWith(/--args must be a JSON array/);
    });

    it("should rethrow and fail the spinner when the adapter rejects", async () => {
      instance = newInstance();
      sinon.stub(instance, "adapterCallSoap").rejects(new Error("boom"));
      await expect(
        instance.soap({ schema: "xtk:session", method: "GetServerTime" }),
      ).to.be.rejectedWith(/boom/);
    });

    it("adapterCallSoap dispatches through the json representation and wraps SDK errors", async () => {
      instance = newInstance();
      const getServerTime = sinon.stub().rejects(new Error("soap down"));
      instance.client = { NLWS: { json: { xtkSession: { getServerTime } } } };

      await expect(
        instance.adapterCallSoap("xtkSession", "getServerTime", [], true),
      ).to.be.rejectedWith(/could not complete the SOAP call/);
      expect(getServerTime.calledOnce).to.be.true;
    });

    it("adapterCallSoap surfaces the server faultString (no longer swallowed)", async () => {
      instance = newInstance();
      const sdkErr = Object.assign(new Error("SOAP fault"), {
        faultString: "XSV-350013 Required parameter 'deliveryId' is missing",
        errorCode: "XSV-350013",
      });
      const buildPreviewFromId = sinon.stub().rejects(sdkErr);
      instance.client = observableClient({
        xml: { nmsDelivery: { buildPreviewFromId } },
      });

      await expect(
        instance.adapterCallSoap(
          "nmsDelivery",
          "buildPreviewFromId",
          [],
          false,
        ),
      ).to.be.rejectedWith(/deliveryId/);
      // the raw response observer must not leak on the shared client
      expect(instance.client.observers).to.be.empty;
    });

    it("adapterCallSoap spreads args and returns the raw values of the user call (xml representation)", async () => {
      instance = newInstance();
      const getServerTime = sinon.stub().callsFake(() => {
        // the SDK loads the schema first (internal), then makes the user call
        instance.client.emit({
          internal: true,
          methodName: "GetEntityIfMoreRecent",
          response: soapEnvelope(
            "GetEntityIfMoreRecent",
            "<other xsi:type='xsd:string'>ignored</other>",
          ),
        });
        instance.client.emit({
          internal: false,
          methodName: "GetServerTime",
          response: soapEnvelope(
            "GetServerTime",
            "<ptmServerTime xsi:type='xsd:dateTime'>2026-10-22T20:58:12Z</ptmServerTime>",
          ),
        });
        // the SDK result (cast to a Date) is dropped
        return Promise.resolve(new Date("2026-10-22T20:58:12.000Z"));
      });
      instance.client = observableClient({
        xml: { xtkSession: { getServerTime } },
      });

      const result = await instance.adapterCallSoap(
        "xtkSession",
        "getServerTime",
        [1234, "<params/>"],
        false,
      );

      expect(getServerTime.calledOnceWithExactly(1234, "<params/>")).to.be.true;
      expect(result).to.equal("2026-10-22T20:58:12Z");
      expect(instance.client.observers).to.be.empty;
    });

    it("adapterCallSoap returns the whole SOAP response as received when rawEnabled", async () => {
      instance = newInstance();
      const envelope = soapEnvelope(
        "GetOption",
        "<pstrValue xsi:type='xsd:string'>nms:recipient</pstrValue><pbtType xsi:type='xsd:byte'>6</pbtType>",
      );
      const getOption = sinon.stub().callsFake(() => {
        instance.client.emit({
          internal: false,
          methodName: "GetOption",
          response: envelope,
        });
        return Promise.resolve(["nms:recipient", 6]);
      });
      instance.client = observableClient({
        xml: { xtkSession: { getOption } },
      });

      const result = await instance.adapterCallSoap(
        "xtkSession",
        "getOption",
        ["Nms_DefaultRcpSchema"],
        false,
        true,
      );

      expect(result).to.equal(envelope);
      expect(instance.client.observers).to.be.empty;
    });
  });
});
