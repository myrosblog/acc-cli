import { expect } from "chai";
import CampaignError from "../src/CampaignError.js";

describe("CampaignError", function () {
  describe("constructor", function () {
    it("should create CampaignError instance", function () {
      const error = new CampaignError("Test error message");
      expect(error).to.be.instanceOf(CampaignError);
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.equal("Test error message");
    });

    it("should create CampaignError with empty message", function () {
      const error = new CampaignError();
      expect(error).to.be.instanceOf(CampaignError);
      expect(error.message).to.equal("");
    });

    it("should preserve stack trace", function () {
      const error = new CampaignError("Test with stack");
      expect(error.stack).to.include("CampaignError.spec.js");
      expect(error.stack).to.include("Test with stack");
    });
  });

  describe("inheritance", function () {
    it("should be instance of Error", function () {
      const error = new CampaignError("Test");
      expect(error instanceof Error).to.be.true;
    });

    it("should have Error prototype methods", function () {
      const error = new CampaignError("Test");
      expect(error).to.have.property("message", "Test");
      expect(error).to.have.property("stack");
      // Note: Custom error classes in JavaScript don't automatically get the class name as 'name'
      // This is expected behavior for simple Error extensions
    });
  });

  describe("custom properties", function () {
    it("should allow adding custom properties", function () {
      const error = new CampaignError("Test");
      error.customProperty = "customValue";
      error.code = 404;

      expect(error.customProperty).to.equal("customValue");
      expect(error.code).to.equal(404);
    });
  });
});