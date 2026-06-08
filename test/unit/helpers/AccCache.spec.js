// npm
import fs from "fs-extra";
import path from "path";
import { expect } from "chai";
import tmp from "tmp";
// acc
import AccCache from "../../../src/helpers/AccCache.js";

describe("AccCache", function () {
  let dir;

  beforeEach(() => {
    // a fresh, isolated cache directory per test
    dir = tmp.dirSync({ unsafeCleanup: true }).name;
  });

  describe("constructor", () => {
    it("should create the cache directory if it does not exist", () => {
      const nested = path.join(dir, "does", "not", "exist", ".acc-cache");
      expect(fs.existsSync(nested)).to.be.false;

      new AccCache(nested);

      expect(fs.existsSync(nested)).to.be.true;
    });

    it("should keep an existing cache directory intact", () => {
      fs.outputFileSync(path.join(dir, "keep.json"), "kept");

      new AccCache(dir);

      expect(fs.readFileSync(path.join(dir, "keep.json"), "utf8")).to.equal(
        "kept",
      );
    });
  });

  describe("setItem / getItem", () => {
    it("should round-trip a value through a <key>.json file", async () => {
      const cache = new AccCache(dir);
      await cache.setItem("foo", "bar");

      expect(fs.existsSync(path.join(dir, "foo.json"))).to.be.true;
      expect(await cache.getItem("foo")).to.equal("bar");
    });

    it("should preserve the value byte-for-byte (serialized JSON payload)", async () => {
      const cache = new AccCache(dir);
      const payload = JSON.stringify({ value: "héllo", cachedAt: 123 });

      await cache.setItem("entity", payload);

      expect(await cache.getItem("entity")).to.equal(payload);
    });

    it("should overwrite an existing entry", async () => {
      const cache = new AccCache(dir);
      await cache.setItem("foo", "first");
      await cache.setItem("foo", "second");

      expect(await cache.getItem("foo")).to.equal("second");
    });

    it("should return undefined for a missing key", async () => {
      const cache = new AccCache(dir);
      expect(await cache.getItem("absent")).to.be.undefined;
    });

    it("should handle the SDK-style cache keys used by acc-js-sdk", async () => {
      // keys the SDK writes, e.g. "...cache.XtkEntityCache$xtk:schema"
      const cache = new AccCache(dir);
      const key = "acc.js.sdk.1.2.0.instance.cache.XtkEntityCache$xtk:schema";

      await cache.setItem(key, "schema-xml");

      expect(await cache.getItem(key)).to.equal("schema-xml");
    });

    it("should round-trip keys containing path separators and reserved chars", async () => {
      // The real SDK key embeds the endpoint (with a trailing slash) and schema
      // ids: a naive path.join would treat the `/` as a sub-directory and fail
      // with ENOENT — silently, since the SDK swallows storage errors.
      const cache = new AccCache(dir);
      const key =
        "acc.js.sdk.1.2.1.localhost:8080/.cache.XtkEntityCache$xtk:schema|xtk:session";

      await cache.setItem(key, "schema-xml");

      // a single flat file is created (no nested directory)
      expect(fs.readdirSync(dir)).to.have.lengthOf(1);
      expect(await cache.getItem(key)).to.equal("schema-xml");
    });
  });

  describe("removeItem", () => {
    it("should delete an existing entry", async () => {
      const cache = new AccCache(dir);
      await cache.setItem("foo", "bar");

      await cache.removeItem("foo");

      expect(fs.existsSync(path.join(dir, "foo.json"))).to.be.false;
      expect(await cache.getItem("foo")).to.be.undefined;
    });

    it("should not throw when removing a missing entry", async () => {
      const cache = new AccCache(dir);
      await expect(cache.removeItem("absent")).to.be.fulfilled;
    });
  });
});
