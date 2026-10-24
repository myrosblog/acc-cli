import fs from "fs-extra";
import path from "node:path";
// acc
import { codes } from "./AccErrors.js";
const { CACHE_CONSTR_DIR_MISSING } = codes;

/**
 * File cache given to acc-js-sdk as its `storage`: one JSON file per key.
 *
 * @class AccCache
 */
class AccCache {
  /**
   * @param {string} dir - directory holding the cache files
   * @throws {CACHE_CONSTR_DIR_MISSING} if dir is missing or not a string
   */
  constructor(dir) {
    if (!dir || typeof dir !== "string") {
      throw new CACHE_CONSTR_DIR_MISSING();
    }
    this.dir = dir;
    fs.ensureDirSync(dir);
  }

  /**
   * Maps a cache key to a flat, filesystem-safe path inside the cache dir.
   *
   * acc-js-sdk keys embed the instance endpoint and schema ids, e.g.
   * `acc.js.sdk.1.2.1.localhost:8080/.cache.XtkEntityCache$xtk:schema|xtk:session`.
   * The `:` and `/` would fail with ENOENT, and the SDK swallows that error.
   * encodeURIComponent makes every key a single valid filename and is symmetric across set/get/remove.
   * @since 1.1.2
   * @param {string} key - the cache key to map
   * @returns {string} the filesystem path for the cache key
   */
  _path(key) {
    return path.join(this.dir, `${encodeURIComponent(key)}.json`);
  }

  /**
   * Reads a cached value.
   *
   * @param {string} key - Key set by acc-js-sdk
   * @returns {Promise<string | undefined>} The cached text, undefined when missing or unreadable
   */
  async getItem(key) {
    try {
      const data = await fs.readFile(this._path(key), "utf8");
      return data;
    } catch {
      return undefined;
    }
  }

  /**
   * Writes a value.
   *
   * @param {string} key - Key set by acc-js-sdk
   * @param {string} value - Text to cache
   */
  async setItem(key, value) {
    await fs.writeFile(this._path(key), value, "utf8");
  }

  /**
   * Deletes a value. A missing value is not an error.
   *
   * @param {string} key - Key set by acc-js-sdk
   */
  async removeItem(key) {
    try {
      await fs.remove(this._path(key));
    } catch {}
  }
}

export default AccCache;
