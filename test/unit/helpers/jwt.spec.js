import { expect } from "chai";
import { codes } from "../../../src/helpers/AccErrors.js";
import {
  decodeJwt,
  summarizeExpiry,
  formatExpiry,
} from "../../../src/helpers/jwt.js";

// Build JWT segments by hand so the fixtures are transparent (no signing).
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const rawSeg = (text) => Buffer.from(text).toString("base64url");
const makeJwt = (header, payload) => `${b64url(header)}.${b64url(payload)}.sig`;

describe("helpers/jwt", () => {
  describe("decodeJwt", () => {
    it("decodes the header and payload without verifying the signature", () => {
      const header = { alg: "RS256", x5u: "ims_na1-key-at-1.cer" };
      const payload = { user_id: "abc@AdobeID", scope: "a,b" };

      const decoded = decodeJwt(makeJwt(header, payload));

      expect(decoded.header).to.deep.equal(header);
      expect(decoded.payload).to.deep.equal(payload);
    });

    it("throws AUTH_DECODE_INVALID when the token is not a string", () => {
      expect(() => decodeJwt(null)).to.throw(codes.AUTH_DECODE_INVALID);
      expect(() => decodeJwt(1234)).to.throw(/non-empty string/);
    });

    it("throws AUTH_DECODE_INVALID on an empty string", () => {
      expect(() => decodeJwt("")).to.throw(codes.AUTH_DECODE_INVALID);
    });

    it("throws AUTH_DECODE_INVALID when there are not exactly 3 segments", () => {
      expect(() => decodeJwt("a.b")).to.throw(/got 2 segment/);
      expect(() => decodeJwt("a.b.c.d")).to.throw(/got 4 segment/);
    });

    it("throws AUTH_DECODE_INVALID when a segment is not base64url JSON", () => {
      const badPayload = `${b64url({ alg: "RS256" })}.${rawSeg(
        "not json at all",
      )}.sig`;
      expect(() => decodeJwt(badPayload)).to.throw(/payload is not/);

      const badHeader = `${rawSeg("not json at all")}.${b64url({})}.sig`;
      expect(() => decodeJwt(badHeader)).to.throw(/header is not/);
    });
  });

  describe("summarizeExpiry", () => {
    // Adobe IMS: created_at (epoch ms) + expires_in (lifetime ms), as strings.
    const CREATED_AT = 1700000000000;
    const EXPIRES_IN = 86400000; // 24h
    const EXPIRES_AT = CREATED_AT + EXPIRES_IN;
    const imsPayload = {
      created_at: String(CREATED_AT),
      expires_in: String(EXPIRES_IN),
    };

    it("reads Adobe IMS created_at/expires_in (milliseconds), valid token", () => {
      const now = CREATED_AT + 3600000; // 1h after issue
      const s = summarizeExpiry(imsPayload, now);

      expect(s.issuedAt.getTime()).to.equal(CREATED_AT);
      expect(s.expiresAt.getTime()).to.equal(EXPIRES_AT);
      expect(s.isExpired).to.be.false;
      expect(s.expiresInMs).to.equal(EXPIRES_AT - now);
    });

    it("flags an Adobe IMS token as expired once past expiry", () => {
      const s = summarizeExpiry(imsPayload, EXPIRES_AT + 1000);
      expect(s.isExpired).to.be.true;
      expect(s.expiresInMs).to.be.lessThan(0);
    });

    it("reads RFC 7519 iat/exp (seconds)", () => {
      const s = summarizeExpiry({ iat: 1700000000, exp: 1700086400 }, 0);
      expect(s.issuedAt.getTime()).to.equal(1700000000 * 1000);
      expect(s.expiresAt.getTime()).to.equal(1700086400 * 1000);
      expect(s.isExpired).to.be.false;
    });

    it("returns nulls when no expiry claim is present", () => {
      const s = summarizeExpiry({ sub: "user" }, 0);
      expect(s.issuedAt).to.be.null;
      expect(s.expiresAt).to.be.null;
      expect(s.isExpired).to.be.null;
      expect(s.expiresInMs).to.be.null;
    });

    it("tolerates a null payload", () => {
      const s = summarizeExpiry(null, 0);
      expect(s.expiresAt).to.be.null;
    });

    it("derives expiry from exp alone (no iat)", () => {
      const s = summarizeExpiry({ exp: 1700086400 }, 0);
      expect(s.issuedAt).to.be.null;
      expect(s.expiresAt.getTime()).to.equal(1700086400 * 1000);
    });

    it("ignores expires_in without created_at, and empty-string claims", () => {
      expect(summarizeExpiry({ expires_in: "86400000" }, 0).expiresAt).to.be
        .null;
      expect(summarizeExpiry({ created_at: "", exp: "" }, 0).expiresAt).to.be
        .null;
    });
  });

  describe("formatExpiry", () => {
    const at = new Date(1700000000000);

    it("renders a valid status with a humanized remaining time", () => {
      const out = formatExpiry({
        issuedAt: at,
        expiresAt: at,
        isExpired: false,
        expiresInMs: 3 * 3600000 + 20 * 60000, // 3h 20m
      });
      expect(out).to.include("✅ valid, expires in 3h 20m");
      expect(out).to.include(at.toISOString());
    });

    it("renders an expired status with the elapsed time", () => {
      const out = formatExpiry({
        issuedAt: at,
        expiresAt: at,
        isExpired: true,
        expiresInMs: -5000, // expired 5s ago
      });
      expect(out).to.include("⚠️ EXPIRED 5s ago");
    });

    it("renders an unknown status and dashes when no expiry claim", () => {
      const out = formatExpiry({
        issuedAt: null,
        expiresAt: null,
        isExpired: null,
        expiresInMs: null,
      });
      expect(out).to.include("no exp/created_at claim");
      expect(out).to.include("Issued at:  -");
      expect(out).to.include("Expires at: -");
    });

    it("humanizes days, minutes and seconds granularities", () => {
      const base = { issuedAt: null, expiresAt: at, isExpired: false };
      expect(
        formatExpiry({ ...base, expiresInMs: 2 * 86400000 + 3 * 3600000 }),
      ).to.include("2d 3h");
      expect(
        formatExpiry({ ...base, expiresInMs: 45 * 60000 + 10 * 1000 }),
      ).to.include("45m 10s");
      expect(formatExpiry({ ...base, expiresInMs: 30000 })).to.include("30s");
    });
  });
});
