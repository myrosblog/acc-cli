// node
import { fileURLToPath } from "url";
// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
import { makeClient, makeLogger, makeSpinner } from "../../../helpers.js";
const __filename = fileURLToPath(import.meta.url);
// acc
import AccInstanceExec from "../../../../src/services/instance/AccInstanceExec.js";

describe("AccInstanceExec", () => {
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

  describe("exec", () => {
    const newInstance = () =>
      new AccInstanceExec(mockLogger, mockClient, mockSpinner);

    it("should evaluate an inline script and return the serialized context", async () => {
      instance = newInstance();
      const outputContext = DomUtil.fromJSON(
        "context",
        { result: "ok" },
        "SimpleJson",
      );
      const adapterStub = sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .resolves(outputContext);

      const result = await instance.exec({ script: "logInfo('hi')" });

      expect(adapterStub.calledOnce).to.be.true;
      const [name, script] = adapterStub.firstCall.args;
      expect(name).to.equal("acc-cli");
      expect(script).to.equal("logInfo('hi')");
      expect(result).to.contain("result");
      // The result is returned (for the command to print on stdout) and only
      // mirrored into the verbose diagnostic trace, never logged at info.
      expect(mockLogger.verbose.calledWith(result)).to.be.true;
    });

    it("should read --file and derive the name from its basename", async () => {
      instance = newInstance();
      const adapterStub = sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .resolves(DomUtil.fromJSON("context", {}, "SimpleJson"));

      // use this spec file itself as a guaranteed-existing JS file
      await instance.exec({ file: __filename });

      const [name, script] = adapterStub.firstCall.args;
      expect(name).to.equal("AccInstanceExec.spec.js");
      expect(script).to.contain("describe");
    });

    it("should prefer an explicit --name over the file basename", async () => {
      instance = newInstance();
      const adapterStub = sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .resolves(DomUtil.fromJSON("context", {}, "SimpleJson"));

      await instance.exec({ file: __filename, name: "myScript" });

      expect(adapterStub.firstCall.args[0]).to.equal("myScript");
    });

    it("should throw INSTANCE_EXEC_FILE_NOT_FOUND when file is missing", async () => {
      instance = newInstance();
      await expect(
        instance.exec({ file: "/does/not/exist.js" }),
      ).to.be.rejectedWith(/script file not found/);
    });

    it("should rethrow and fail the spinner when the adapter rejects", async () => {
      instance = newInstance();
      sinon
        .stub(instance, "adapterEvaluateJavaScript")
        .rejects(new Error("boom"));
      await expect(
        instance.exec({ script: "logInfo('hi')" }),
      ).to.be.rejectedWith(/boom/);
    });

    it("adapterEvaluateJavaScript should wrap SDK errors as INSTANCE_EXEC_SDK_EVALUATE_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xtkBuilder: {
            evaluateJavaScript: sinon.stub().rejects(new Error("soap down")),
          },
        },
      };
      await expect(
        instance.adapterEvaluateJavaScript("n", "s", {}),
      ).to.be.rejectedWith(/EvaluateJavaScript error/);
    });
  });
});
