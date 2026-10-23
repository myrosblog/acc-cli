// node
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// npm
import { expect } from "chai";
import hjson from "hjson";
import sinon from "sinon";
// sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
import { makeClient, makeLogger, makeSpinner } from "../../../helpers.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// hjson, as the template contains comments
const loadJson = (file) =>
  hjson.parse(fs.readFileSync(join(__dirname, file), "utf8"));
const configDefaultFull = loadJson("../../../../src/templates/acc.config.json");
// acc
import AccInstance from "../../../../src/services/instance/AccInstance.js";

describe("AccInstance", () => {
  let mockClient, mockLogger, mockSpinner, instance, pathFull, optionsFull;

  beforeEach(() => {
    // mock client
    mockClient = makeClient();

    // options template
    pathFull = join(__dirname, "../../../dist/configFull/");

    // mock options
    optionsFull = {
      path: pathFull,
    };

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
      new AccInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
        mockSpinner,
      );

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
      expect(name).to.equal("AccInstance.spec.js");
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

  describe("info", () => {
    const newInstance = () =>
      new AccInstance(
        mockLogger,
        mockClient,
        configDefaultFull,
        optionsFull,
        mockSpinner,
      );
    const cnxInfoEl = DomUtil.getFirstChildElement(
      DomUtil.parse('<infos><cnx login="admin"/></infos>'),
    );
    const stateEl = DomUtil.getFirstChildElement(
      DomUtil.parse('<elemMonitoring currentInstance="instance1"/>'),
    );

    const stubAll = (i) => {
      sinon.stub(i, "adapterTestCnx").resolves(null);
      sinon
        .stub(i, "adapterGetServerTime")
        .resolves(new Date("2026-06-06T14:00:00.000Z"));
      sinon.stub(i, "adapterGetCnxInfo").resolves(cnxInfoEl);
      sinon.stub(i, "adapterDumpCurrentInstanceState").resolves(stateEl);
    };

    it("should render all four sections with no errors on success", async () => {
      instance = newInstance();
      stubAll(instance);

      const { text, errors } = await instance.info();

      expect(errors).to.be.empty;
      expect(text).to.contain("xtk:session#TestCnx");
      expect(text).to.contain("✅ reachable");
      expect(text).to.contain("2026-06-06T14:00:00.000Z");
      expect(text).to.contain("<cnx");
      expect(text).to.contain("elemMonitoring");
      // returned for the command to print; mirrored only into verbose trace
      expect(mockLogger.verbose.calledWith(text)).to.be.true;
    });

    it("should keep going when one probe fails (best-effort) and collect the error", async () => {
      instance = newInstance();
      stubAll(instance);
      instance.adapterDumpCurrentInstanceState.restore();
      sinon
        .stub(instance, "adapterDumpCurrentInstanceState")
        .rejects(new Error("timeout of 5000ms exceeded"));

      const { text, errors } = await instance.info();

      expect(errors).to.have.lengthOf(1);
      expect(errors[0].message).to.contain("timeout");
      // other sections still rendered
      expect(text).to.contain("✅ reachable");
      // the failed section shows the warning instead of a body
      expect(text).to.contain("⚠️ timeout of 5000ms exceeded");
    });

    it("adapterTestCnx should wrap SDK errors as INSTANCE_INFO_SDK_TESTCNX_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: { xtkSession: { testCnx: sinon.stub().rejects(new Error("x")) } },
      };
      await expect(instance.adapterTestCnx()).to.be.rejectedWith(
        /TestCnx error/,
      );
    });

    it("adapterDumpCurrentInstanceState should wrap SDK errors as INSTANCE_INFO_SDK_DUMPSTATE_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xml: {
            nlMonitoring: {
              dumpCurrentInstanceState: sinon.stub().rejects(new Error("x")),
            },
          },
        },
      };
      await expect(
        instance.adapterDumpCurrentInstanceState(),
      ).to.be.rejectedWith(/DumpCurrentInstanceState error/);
    });
  });
});
