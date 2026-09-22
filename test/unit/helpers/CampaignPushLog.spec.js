import { expect } from "chai";
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import CampaignPushLog from "../../../src/helpers/CampaignPushLog.js";

describe("helpers/CampaignPushLog", () => {
  const schemaConfig = { schemaId: "nms:delivery" };

  describe("constructor", () => {
    it("should initialize defaults from the schemaConfig", () => {
      const pushLog = new CampaignPushLog(schemaConfig);

      expect(pushLog.schemaConfig).to.equal(schemaConfig);
      expect(pushLog.startTime).to.be.instanceOf(Date);
      expect(pushLog.endTime).to.be.undefined;
      expect(pushLog.filePath).to.be.undefined;
      expect(pushLog.xpath).to.be.undefined;
      expect(pushLog.keyValues).to.be.undefined;
      expect(pushLog.operation).to.be.undefined;
      expect(pushLog.payloadXml).to.be.undefined;
      expect(pushLog.error).to.be.undefined;
    });
  });

  describe("toLog", () => {
    it("should return a readable summary of a successful push", () => {
      const pushLog = new CampaignPushLog(schemaConfig);
      pushLog.filePath = "/project/deliveries/welcome.body.html";
      pushLog.xpath = "content/htmlSource";
      pushLog.operation = "update";
      pushLog.keyValues = [
        {
          xpath: "@internalName",
          attributeName: "internalName",
          value: "WELCOME",
        },
      ];
      pushLog.payloadXml = DomUtil.parse(
        '<delivery internalName="WELCOME"><![CDATA[<html></html>]]></delivery>',
      );
      pushLog.endTime = new Date(pushLog.startTime.getTime() + 25);

      const summary = pushLog.toLog();

      expect(summary.schemaId).to.equal("nms:delivery");
      expect(summary.filePath).to.equal(pushLog.filePath);
      expect(summary.xpath).to.equal("content/htmlSource");
      expect(summary.operation).to.equal("update");
      expect(summary.keyValues).to.deep.equal(pushLog.keyValues);
      expect(summary.startTime).to.equal(pushLog.startTime.toISOString());
      expect(summary.endTime).to.equal(pushLog.endTime.toISOString());
      expect(summary.durationMs).to.equal(25);
      expect(summary.payloadXml).to.be.a("string");
      expect(summary.payloadXml).to.include('internalName="WELCOME"');
      expect(summary.error).to.be.undefined;
    });

    it("should include the error message and omit the payload when the push failed", () => {
      const pushLog = new CampaignPushLog(schemaConfig);
      pushLog.filePath = "/project/deliveries/welcome.body.html";
      pushLog.error = new Error("SOAP call failed");
      pushLog.endTime = new Date(pushLog.startTime.getTime() + 5);

      const summary = pushLog.toLog();

      expect(summary.error).to.equal("SOAP call failed");
      expect(summary.payloadXml).to.be.undefined;
      expect(summary.operation).to.be.undefined;
    });

    it("should omit endTime, durationMs and payloadXml when not yet set", () => {
      const pushLog = new CampaignPushLog(schemaConfig);

      const summary = pushLog.toLog();

      expect(summary.endTime).to.be.undefined;
      expect(summary.durationMs).to.be.undefined;
      expect(summary.payloadXml).to.be.undefined;
    });
  });
});
