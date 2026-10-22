// node
import { join } from "node:path";
// npm
import { expect } from "chai";
import fs from "fs-extra";
import tmp from "tmp";
// acc
import { codes } from "../../../src/helpers/AccErrors.js";
import {
  findMissingS2SKeys,
  isBlank,
  loadS2SJsonFile,
} from "../../../src/helpers/s2sCredentials.js";
const {
  AUTH_INIT_JSON_FILE_NOT_FOUND,
  AUTH_INIT_JSON_FILE_INVALID,
  AUTH_INIT_JSON_FILE_SHAPE,
} = codes;

describe("helpers/s2sCredentials", () => {
  // Same shape as the file downloaded from the Developer Console
  const consoleJson = {
    ORG_ID: "ABC@AdobeOrg",
    CLIENT_ID: "client-id",
    CLIENT_SECRETS: ["secret-1"],
    SCOPES: ["openid", "AdobeID"],
    TECHNICAL_ACCOUNT_ID: "tech@techacct.adobe.com",
    TECHNICAL_ACCOUNT_EMAIL: "tech@techacct.adobe.com",
  };

  describe("isBlank", () => {
    it("should treat undefined, null, an empty string and an empty array as blank", () => {
      for (const value of [undefined, null, "", []]) {
        expect(isBlank(value), JSON.stringify(value)).to.be.true;
      }
    });

    it("should treat any given value as not blank, including 0, false and an empty object", () => {
      for (const value of ["x", " ", 0, false, ["a"], {}]) {
        expect(isBlank(value), JSON.stringify(value)).to.be.false;
      }
    });
  });

  describe("findMissingS2SKeys", () => {
    it("should return nothing for a complete credential", () => {
      expect(findMissingS2SKeys(consoleJson)).to.deep.equal([]);
    });

    it("should not require the informational technical account keys", () => {
      const { ORG_ID, CLIENT_ID, CLIENT_SECRETS, SCOPES } = consoleJson;
      expect(
        findMissingS2SKeys({ ORG_ID, CLIENT_ID, CLIENT_SECRETS, SCOPES }),
      ).to.deep.equal([]);
    });

    it("should list every missing or empty key in a stable order", () => {
      expect(
        findMissingS2SKeys({
          ...consoleJson,
          CLIENT_ID: undefined,
          CLIENT_SECRETS: [],
          SCOPES: [],
        }),
      ).to.deep.equal(["CLIENT_ID", "CLIENT_SECRETS", "SCOPES"]);
    });

    it("should require a non-empty first client secret", () => {
      expect(
        findMissingS2SKeys({ ...consoleJson, CLIENT_SECRETS: [""] }),
      ).to.deep.equal(["CLIENT_SECRETS"]);
    });

    it("should list the four keys for a credential that is not an object", () => {
      const allKeys = ["ORG_ID", "CLIENT_ID", "CLIENT_SECRETS", "SCOPES"];
      expect(findMissingS2SKeys(null)).to.deep.equal(allKeys);
      expect(findMissingS2SKeys(undefined)).to.deep.equal(allKeys);
    });
  });

  describe("loadS2SJsonFile", () => {
    let dir;

    // Reading a path is the unit under test, so the filesystem is not stubbed;
    // `tmp` keeps the files out of the repo and removes them after each test.
    beforeEach(() => {
      dir = tmp.dirSync({ unsafeCleanup: true });
    });

    afterEach(() => {
      dir.removeCallback();
    });

    const writeJsonFile = (content) => {
      const file = join(dir.name, "credential.json");
      fs.writeFileSync(
        file,
        typeof content === "string" ? content : JSON.stringify(content),
      );
      return file;
    };

    it("should return the credential unchanged, extra keys included", () => {
      const file = writeJsonFile({ ...consoleJson, EXTRA: "kept" });

      expect(loadS2SJsonFile(file)).to.deep.equal({
        ...consoleJson,
        EXTRA: "kept",
      });
    });

    it("should throw AUTH_INIT_JSON_FILE_NOT_FOUND naming the path", () => {
      const file = join(dir.name, "nope.json");

      expect(() => loadS2SJsonFile(file)).to.throw(
        AUTH_INIT_JSON_FILE_NOT_FOUND,
        file,
      );
    });

    it("should throw AUTH_INIT_JSON_FILE_INVALID on malformed JSON", () => {
      const file = writeJsonFile("{ not json");

      expect(() => loadS2SJsonFile(file)).to.throw(
        AUTH_INIT_JSON_FILE_INVALID,
        file,
      );
    });

    it("should throw AUTH_INIT_JSON_FILE_SHAPE listing only the missing keys", () => {
      const file = writeJsonFile({ ...consoleJson, CLIENT_ID: "", SCOPES: [] });

      let error;
      try {
        loadS2SJsonFile(file);
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(AUTH_INIT_JSON_FILE_SHAPE);
      expect(error.message).to.contain("CLIENT_ID, SCOPES");
      expect(error.message).to.not.contain("ORG_ID");
      expect(error.message).to.not.contain("CLIENT_SECRETS");
    });

    it("should throw AUTH_INIT_JSON_FILE_SHAPE when the JSON is not an object", () => {
      const file = writeJsonFile("null");

      expect(() => loadS2SJsonFile(file)).to.throw(AUTH_INIT_JSON_FILE_SHAPE);
    });
  });
});
