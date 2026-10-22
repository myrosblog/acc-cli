import { expect } from "chai";
import ImsAuthAdapter from "../../../src/adapters/ImsAuthAdapter.js";

describe("ImsAuthAdapter", () => {
  describe("generateAccessToken", () => {
    // Missing credentials make the library reject before any IMS call, so the
    // real library runs without network.
    it("should propagate the library validation error", async () => {
      const adapter = new ImsAuthAdapter();

      await expect(adapter.generateAccessToken({})).to.be.rejectedWith(
        /clientId, clientSecret, orgId/,
      );
    });
  });

  describe("invalidateCache", () => {
    it("should clear the in-process token cache", () => {
      const adapter = new ImsAuthAdapter();

      expect(adapter.invalidateCache()).to.be.undefined;
    });
  });
});
