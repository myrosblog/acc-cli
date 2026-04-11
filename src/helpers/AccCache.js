import fs from "fs-extra";
import path from "path";

class AccCache {
  constructor(dir = "./.acc-cache") {
    this.dir = dir;
    fs.ensureDirSync(dir);
  }

  async getItem(key) {
    try {
      const filePath = path.join(this.dir, `${key}.json`);
      const data = await fs.readFile(filePath, "utf8");
      return data;
    } catch {
      return undefined;
    }
  }

  async setItem(key, value) {
    const filePath = path.join(this.dir, `${key}.json`);
    await fs.writeFile(filePath, value, "utf8");
  }

  async removeItem(key) {
    try {
      await fs.remove(path.join(this.dir, `${key}.json`));
    } catch {}
  }
}

export default AccCache;
