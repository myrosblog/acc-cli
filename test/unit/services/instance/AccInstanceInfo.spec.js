// npm
import { expect } from "chai";
import sinon from "sinon";
// sdk
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
// helpers
import { makeClient, makeLogger, makeSpinner } from "../../../helpers.js";
// acc
import AccInstanceInfo from "../../../../src/services/instance/AccInstanceInfo.js";

describe("AccInstanceInfo", () => {
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

  describe("info", () => {
    const newInstance = () =>
      new AccInstanceInfo(mockLogger, mockClient, mockSpinner);
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

    it("should render a server time that is not a Date as a string", async () => {
      instance = newInstance();
      stubAll(instance);
      instance.adapterGetServerTime.resolves("2026-06-06 14:00:00");

      const { text } = await instance.info();

      expect(text).to.contain(
        "== Server time (xtk:session#GetServerTime) ==\n2026-06-06 14:00:00",
      );
    });

    it("adapterGetServerTime should return the server clock", async () => {
      const serverTime = new Date("2026-06-06T14:00:00.000Z");
      instance = newInstance();
      instance.client = {
        NLWS: {
          xtkSession: { getServerTime: sinon.stub().resolves(serverTime) },
        },
      };
      expect(await instance.adapterGetServerTime()).to.equal(serverTime);
    });

    it("adapterGetServerTime should wrap SDK errors as INSTANCE_INFO_SDK_SERVERTIME_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xtkSession: { getServerTime: sinon.stub().rejects(new Error("x")) },
        },
      };
      await expect(instance.adapterGetServerTime()).to.be.rejectedWith(
        /GetServerTime error/,
      );
    });

    it("adapterGetCnxInfo should return the <infos> element", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xml: { xtkSession: { getCnxInfo: sinon.stub().resolves(cnxInfoEl) } },
        },
      };
      expect(await instance.adapterGetCnxInfo()).to.equal(cnxInfoEl);
    });

    it("adapterGetCnxInfo should wrap SDK errors as INSTANCE_INFO_SDK_CNXINFO_FAILED", async () => {
      instance = newInstance();
      instance.client = {
        NLWS: {
          xml: {
            xtkSession: { getCnxInfo: sinon.stub().rejects(new Error("x")) },
          },
        },
      };
      await expect(instance.adapterGetCnxInfo()).to.be.rejectedWith(
        /GetCnxInfo error/,
      );
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
