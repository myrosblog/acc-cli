// npm
import fs from "fs-extra";
// acc
import { codes } from "./AccErrors.js";
const {
  AUTH_INIT_JSON_FILE_NOT_FOUND,
  AUTH_INIT_JSON_FILE_INVALID,
  AUTH_INIT_JSON_FILE_SHAPE,
} = codes;

/**
 * Tells whether a credential or prompt value was left empty: undefined, null,
 * an empty string or an empty array. Zero and false count as given.
 *
 * @param {*} value - the value to check
 * @returns {boolean} true when the value is empty
 */
export function isBlank(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === undefined || value === null || value === "";
}

/**
 * Lists the required keys that an OAuth Server-to-Server credential lacks.
 * Only the four keys used to generate an IMS access token are required;
 * TECHNICAL_ACCOUNT_ID and TECHNICAL_ACCOUNT_EMAIL are informational.
 *
 * @param {object} credential - the parsed credential, as downloaded from the Developer Console
 * @returns {Array<string>} the missing or empty keys, in a stable order (empty when the credential is complete)
 */
export function findMissingS2SKeys(credential) {
  return [
    ["ORG_ID", credential?.ORG_ID],
    ["CLIENT_ID", credential?.CLIENT_ID],
    ["CLIENT_SECRETS", credential?.CLIENT_SECRETS?.[0]],
    ["SCOPES", credential?.SCOPES],
  ]
    .filter(([, value]) => isBlank(value))
    .map(([key]) => key);
}

/**
 * Reads and validates an OAuth Server-to-Server credential downloaded from the
 * Adobe Developer Console (Credentials → OAuth Server-to-Server → Download
 * JSON). The file is stored as-is once it holds the required keys.
 *
 * Validating here means a typo fails at init naming the missing key, instead
 * of failing as an IMS 400 on the next login.
 *
 * @param {string} filePath - path to the downloaded JSON file
 * @returns {object} the parsed credential
 * @throws {AUTH_INIT_JSON_FILE_NOT_FOUND|AUTH_INIT_JSON_FILE_INVALID|AUTH_INIT_JSON_FILE_SHAPE}
 * @since 1.7.0
 */
export function loadS2SJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new AUTH_INIT_JSON_FILE_NOT_FOUND({ messageValues: [filePath] });
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new AUTH_INIT_JSON_FILE_INVALID({
      messageValues: [filePath, error.message],
    });
  }
  const missingKeys = findMissingS2SKeys(parsed);
  if (missingKeys.length > 0) {
    throw new AUTH_INIT_JSON_FILE_SHAPE({
      messageValues: [filePath, missingKeys.join(", ")],
    });
  }
  return parsed;
}
