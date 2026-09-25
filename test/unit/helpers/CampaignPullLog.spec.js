import { expect } from "chai";
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import CampaignPullLog from "../../../src/helpers/CampaignPullLog.js";

describe("helpers/CampaignPullLog", () => {
  const schemaConfig = {
    schemaId: "nms:localOrgUnit",
    filename:
      "/Administration/Access Management/Organizational entities/{@name}.meta.xml",
  };

  describe("constructor", () => {
    it("should initialize defaults from the schemaConfig", () => {
      const pullLog = new CampaignPullLog(schemaConfig);

      expect(pullLog.schemaConfig).to.equal(schemaConfig);
      expect(pullLog.startTime).to.be.instanceOf(Date);
      expect(pullLog.endTime).to.be.undefined;
      expect(pullLog.elements).to.deep.equal([]);
      expect(pullLog.errors).to.deep.equal([]);
      expect(pullLog.parsedFilenames).to.deep.equal([]);
      expect(pullLog.parsedPaths).to.deep.equal([]);
    });
  });

  describe("toLog", () => {
    it("should return a readable summary without mutating elements/errors", () => {
      const pullLog = new CampaignPullLog(schemaConfig);
      pullLog.endTime = new Date(pullLog.startTime.getTime() + 10);
      pullLog.queryDef = { schema: "nms:localOrgUnit", operation: "select" };
      pullLog.queryDefXml = DomUtil.fromJSON(
        "queryDef",
        pullLog.queryDef,
        "SimpleJson",
      );
      const fakeElement = DomUtil.parse("<localOrgUnit/>").documentElement;
      pullLog.elements.push(fakeElement, fakeElement);
      const error = new Error("boom");
      pullLog.errors.push(error);
      pullLog.parsedFilenames.push("OU1.meta.xml");
      pullLog.parsedPaths.push("/Organizational entities/OU1.meta.xml");

      const summary = pullLog.toLog();

      expect(summary.schemaId).to.equal("nms:localOrgUnit");
      expect(summary.filename).to.equal(schemaConfig.filename);
      expect(summary.startTime).to.equal(pullLog.startTime.toISOString());
      expect(summary.endTime).to.equal(pullLog.endTime.toISOString());
      expect(summary.durationMs).to.equal(10);
      expect(summary.elementCount).to.equal(2);
      expect(summary.parsedFilenames).to.deep.equal(["OU1.meta.xml"]);
      expect(summary.parsedPaths).to.deep.equal([
        "/Organizational entities/OU1.meta.xml",
      ]);
      expect(summary.errors).to.deep.equal(["boom"]);
      expect(summary.queryDef).to.equal(pullLog.queryDef);
      expect(summary.queryDefXml).to.be.a("string");
      expect(summary.queryDefXml).to.include("<queryDef ");
      expect(summary.queryDefXml).to.include('schema="nms:localOrgUnit"');

      // toLog() must not mutate the underlying fields (audit trail integrity)
      expect(pullLog.elements).to.deep.equal([fakeElement, fakeElement]);
      expect(pullLog.errors).to.deep.equal([error]);
      expect(pullLog.errors[0]).to.equal(error);
    });

    it("should omit endTime, durationMs and queryDefXml when not yet set", () => {
      const pullLog = new CampaignPullLog(schemaConfig);

      const summary = pullLog.toLog();

      expect(summary.endTime).to.be.undefined;
      expect(summary.durationMs).to.be.undefined;
      expect(summary.queryDefXml).to.be.undefined;
      expect(summary.elementCount).to.equal(0);
      expect(summary.errors).to.deep.equal([]);
    });
  });
});
