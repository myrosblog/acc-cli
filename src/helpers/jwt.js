// acc
import { codes } from "./AccErrors.js";
const { AUTH_DECODE_INVALID } = codes;

/**
 * Decodes a JSON Web Token (JWT) into its header and payload WITHOUT verifying
 * the signature. This is a debugging aid: it answers "what is inside this
 * token?" (claims, scopes, expiry), not "is it authentic?". Never gate a
 * security decision on the result. A verify path (checking the RS256
 * signature against the IMS public key) would be needed for that. No external
 * dependency is required: Node's `base64url` decoder handles the URL-safe,
 * unpadded segments a JWT uses.
 *
 * @param {string} token - a JWT, e.g. an Adobe IMS access token ("eyJ…")
 * @returns {{header: object, payload: object}} the decoded JWT header and payload
 * @throws {AUTH_DECODE_INVALID} if the input is not a well-formed JWT (not a
 *   non-empty string, not 3 dot-separated segments, or a segment is not
 *   base64url-encoded JSON).
 */
export function decodeJwt(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new AUTH_DECODE_INVALID({
      messageValues: ["token must be a non-empty string"],
    });
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AUTH_DECODE_INVALID({
      messageValues: [`got ${parts.length} segment(s)`],
    });
  }
  return {
    header: decodeSegment(parts[0], "header"),
    payload: decodeSegment(parts[1], "payload"),
  };
}

/**
 * base64url-decodes one JWT segment and parses it as JSON. `Buffer.from(…,
 * "base64url")` is lenient (it never throws, it just drops invalid bytes), so
 * garbage input is caught at the JSON.parse step.
 * @param {string} segment - a single base64url JWT segment
 * @param {string} label - "header" | "payload", used in the error message
 * @returns {object} the decoded segment
 * @throws {AUTH_DECODE_INVALID}
 */
function decodeSegment(segment, label) {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  try {
    return JSON.parse(json);
  } catch {
    throw new AUTH_DECODE_INVALID({
      messageValues: [`${label} is not base64url-encoded JSON`],
    });
  }
}

/**
 * Derives a human-oriented expiry summary from a decoded JWT payload. Two claim
 * conventions are supported, since IMS tokens do not follow the RFC:
 *   - RFC 7519 standard: `iat` / `exp` in **seconds** since epoch;
 *   - Adobe IMS access tokens: `created_at` (epoch **milliseconds**) +
 *     `expires_in` (lifetime in **milliseconds**), both usually strings.
 * Missing claims yield `null` rather than throwing, a token may carry neither.
 *
 * @param {object} payload - a decoded JWT payload
 * @param {number} [now] - reference time in ms (injectable for tests)
 * @returns {{ issuedAt: Date|null, expiresAt: Date|null, isExpired: boolean|null, expiresInMs: number|null }} serialized info
 */
export function summarizeExpiry(payload, now = Date.now()) {
  const p = payload || {};
  const issuedAtMs = toIssuedAtMs(p);
  const expiresAtMs = toExpiresAtMs(p);
  return {
    issuedAt: issuedAtMs === null ? null : new Date(issuedAtMs),
    expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs),
    isExpired: expiresAtMs === null ? null : expiresAtMs <= now,
    expiresInMs: expiresAtMs === null ? null : expiresAtMs - now,
  };
}

/**
 * Issued-at time in ms: `iat` (RFC, seconds) then `created_at` (IMS, ms).
 * @param {object} p - decoded payload
 * @returns {number|null} the issued-at time in ms, or null if neither claim is present
 */
function toIssuedAtMs(p) {
  if (isNumeric(p.iat)) {
    return Number(p.iat) * 1000;
  }
  if (isNumeric(p.created_at)) {
    return Number(p.created_at);
  }
  return null;
}

/**
 * Expiry time in ms: `exp` (RFC, seconds) then `created_at + expires_in` (IMS,
 * both ms, note this is the in-JWT convention, unlike the OAuth token response
 * where `expires_in` is seconds).
 * @param {object} p - decoded payload
 * @returns {number|null} the expiry time in ms, or null if neither claim is present
 */
function toExpiresAtMs(p) {
  if (isNumeric(p.exp)) {
    return Number(p.exp) * 1000;
  }
  if (isNumeric(p.created_at) && isNumeric(p.expires_in)) {
    return Number(p.created_at) + Number(p.expires_in);
  }
  return null;
}

/**
 * True when the value is a number, or a string that converts to a finite
 * number. Rejects the `Number("")===0` / `Number(null)===0` false positives.
 * @param {*} v - the value to test
 * @returns {boolean} true if the value is numeric, false otherwise
 */
function isNumeric(v) {
  if (v === null || v === undefined || v === "") {
    return false;
  }
  return Number.isFinite(Number(v));
}

/**
 * Renders an expiry summary as a 3-line block (Issued at / Expires at / Status)
 * for human output. The Status line uses the same emoji-marker style as the
 * other diagnostic reports in the CLI. Pure string builder, no I/O, so it is
 * unit-testable in isolation.
 * @param {{ issuedAt: Date|null, expiresAt: Date|null, isExpired: boolean|null, expiresInMs: number|null }} summary the serialized expiry info from {@link summarizeExpiry}
 * @returns {string} the humanized expiry summary
 */
export function formatExpiry(summary) {
  const issued = summary.issuedAt ? summary.issuedAt.toISOString() : "-";
  const expires = summary.expiresAt ? summary.expiresAt.toISOString() : "-";
  let status;
  if (summary.expiresAt === null) {
    status = "- no exp/created_at claim to determine expiry";
  } else if (summary.isExpired) {
    status = `⚠️ EXPIRED ${humanizeDuration(-summary.expiresInMs)} ago`;
  } else {
    status = `✅ valid, expires in ${humanizeDuration(summary.expiresInMs)}`;
  }
  return [
    `Issued at:  ${issued}`,
    `Expires at: ${expires}`,
    `Status:     ${status}`,
  ].join("\n");
}

/**
 * Renders a millisecond duration as a compact string using the two largest
 * non-zero units (e.g. "1d 3h", "3h 20m", "45m 10s", "30s"). Negatives clamp
 * to 0.
 * @param {number} ms the duration in milliseconds
 * @throws {TypeError} if ms is not a number
 * @throws {RangeError} if ms is NaN or infinite
 * @returns {string} the humanized duration
 */
function humanizeDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
