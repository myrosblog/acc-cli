import fs from "fs-extra";
import path from "path";

class AccCache {
  constructor(dir = "./.acc-cache") {
    this.dir = dir;
    fs.ensureDirSync(dir);
  }

  /**
   * Maps a cache key to a flat, filesystem-safe path inside the cache dir.
   *
   * acc-js-sdk keys embed the instance endpoint and schema ids, e.g.
   * `acc.js.sdk.1.2.1.localhost:8080/.cache.XtkEntityCache$xtk:schema|xtk:session`.
   * The `:` and `/` would fail with ENOENT — and the SDK swallows that error
   * encodeURIComponent makes every key a single valid filename and is symmetric across set/get/remove.
   * @since 1.1.2
   * @param {string} key
   * @returns {string}
   */
  _path(key) {
    return path.join(this.dir, `${encodeURIComponent(key)}.json`);
  }

  async getItem(key) {
    try {
      const data = await fs.readFile(this._path(key), "utf8");
      return data;
    } catch {
      return undefined;
    }
  }

  async setItem(key, value) {
    await fs.writeFile(this._path(key), value, "utf8");
  }

  async removeItem(key) {
    try {
      await fs.remove(this._path(key));
    } catch {}
  }
}

export default AccCache;
