// npm
import fs from "fs-extra";
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
import { makeClient, makeLogger, makeSpinner } from "../../../helpers.js";
// acc
import AccInstanceQueryDef from "../../../../src/services/instance/AccInstanceQueryDef.js";

describe("AccInstanceQueryDef", () => {
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

  describe("queryDef", () => {
    // Default (human) mode takes an XML queryDef and returns XML; --json mode
    // takes a JSON queryDef and returns a SimpleJson object.
    const QUERY_XML = '<queryDef schema="nms:recipient" operation="select"/>';
    const QUERY_JSON = '{"schema":"nms:recipient","operation":"select"}';
    const collection = () =>
      DomUtil.getFirstChildElement(
        DomUtil.parse(
          '<recipient-collection><recipient email="a@b.com"/></recipient-collection>',
        ),
      );
    const newInstance = () =>
      new AccInstanceQueryDef(mockLogger, mockClient, mockSpinner);

    it("should execute the query and serialize the result as XML (human mode)", async () => {
      instance = newInstance();
      const coll = collection();
      const adapterStub = sinon
        .stub(instance, "adapterExecuteQueryDef")
        .resolves(coll);

      const result = await instance.queryDef({ query: QUERY_XML });

      expect(adapterStub.calledOnce).to.be.true;
      // the raw query and the json flag are passed straight to the adapter
      expect(adapterStub.firstCall.args[0]).to.equal(QUERY_XML);
      expect(adapterStub.firstCall.args[1]).to.not.be.ok; // json undefined/false
      // human mode returns the serialized XML
      expect(result).to.contain("<recipient");
      expect(result).to.contain('email="a@b.com"');
      // the result element is mirrored to the verbose trace
      expect(mockLogger.verbose.calledWith(coll)).to.be.true;
    });

    it("should return the SimpleJson object as-is when json:true", async () => {
      instance = newInstance();
      const jsonResult = { recipient: [{ email: "a@b.com" }] };
      const adapterStub = sinon
        .stub(instance, "adapterExecuteQueryDef")
        .resolves(jsonResult);

      const result = await instance.queryDef({ query: QUERY_JSON, json: true });

      // the json flag is forwarded to the adapter and the object returned as-is
      expect(adapterStub.firstCall.args[0]).to.equal(QUERY_JSON);
      expect(adapterStub.firstCall.args[1]).to.equal(true);
      expect(result).to.deep.equal(jsonResult);
    });

    it("should read the queryDef from --file", async () => {
      instance = newInstance();
      sinon.stub(fs, "existsSync").returns(true);
      sinon.stub(fs, "readFileSync").returns(QUERY_XML);
      const adapterStub = sinon
        .stub(instance, "adapterExecuteQueryDef")
        .resolves(collection());

      await instance.queryDef({ file: "/tmp/q.xml" });

      expect(adapterStub.firstCall.args[0]).to.equal(QUERY_XML);
    });

    it("should throw INSTANCE_QUERYDEF_FILE_NOT_FOUND when file is missing", async () => {
      instance = newInstance();
      await expect(
        instance.queryDef({ file: "/does/not/exist.xml" }),
      ).to.be.rejectedWith(/queryDef file not found/);
    });

    it("should rethrow and fail the spinner when the adapter rejects", async () => {
      instance = newInstance();
      sinon.stub(instance, "adapterExecuteQueryDef").rejects(new Error("boom"));
      await expect(instance.queryDef({ query: QUERY_XML })).to.be.rejectedWith(
        /boom/,
      );
    });

    it("adapterExecuteQueryDef (XML mode) parses XML, executes and returns the element", async () => {
      instance = newInstance();
      const coll = collection();
      const executeQuery = sinon.stub().resolves(coll);
      const create = sinon.stub().returns({ executeQuery });
      instance.client = { NLWS: { xml: { xtkQueryDef: { create } } } };

      const result = await instance.adapterExecuteQueryDef(QUERY_XML, false);

      // XML mode goes through the .xml representation
      expect(create.calledOnce).to.be.true;
      expect(result).to.equal(coll);
    });

    it("adapterExecuteQueryDef (XML mode) wraps create errors as INSTANCE_QUERYDEF_SDK_CREATE_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xml: {
            xtkQueryDef: { create: sinon.stub().throws(new Error("bad")) },
          },
        },
      };
      await expect(
        instance.adapterExecuteQueryDef(QUERY_XML, false),
      ).to.be.rejectedWith(/create the SDK query/);
    });

    it("adapterExecuteQueryDef (JSON mode) parses JSON and wraps execute errors as INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED", async () => {
      instance = newInstance();
      const create = sinon.stub().returns({
        executeQuery: sinon.stub().rejects(new Error("soap down")),
      });
      instance.client = { NLWS: { json: { xtkQueryDef: { create } } } };

      await expect(
        instance.adapterExecuteQueryDef(QUERY_JSON, true),
      ).to.be.rejectedWith(/ExecuteQuery error/);
      // JSON mode goes through the .json representation
      expect(create.calledOnce).to.be.true;
    });
  });
});
