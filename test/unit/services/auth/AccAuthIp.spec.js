// npm
import { expect } from "chai";
import sinon from "sinon";
// acc
import AccAuthIp from "../../../../src/services/auth/AccAuthIp.js";
// helpers
import { makeLogger } from "../../../helpers.js";

describe("AccAuthIp", function () {
  let mockSdk, mockLogger;
  /**
   * @type {AccAuthIp}
   */
  let authIp;

  beforeEach(function () {
    // Mock SDK
    mockSdk = {
      ip: sinon.stub().resolves({
        ipAddress: "11.11.11.11",
        continentCode: "EU",
        continentName: "Europe",
        countryCode: "FR",
        countryName: "France",
        stateProvCode: "ABC",
        stateProv: "Abc",
        city: "Def",
      }),
    };

    // mock AioLogger
    mockLogger = makeLogger();

    authIp = new AccAuthIp(mockLogger, mockSdk);
  });

  describe("ip", () => {
    it("should display ip info", async () => {
      const ip = await authIp.ip();
      expect(ip).to.deep.equal({
        ipAddress: "11.11.11.11",
        continentCode: "EU",
        continentName: "Europe",
        countryCode: "FR",
        countryName: "France",
        stateProvCode: "ABC",
        stateProv: "Abc",
        city: "Def",
      });
    });
  });
});
