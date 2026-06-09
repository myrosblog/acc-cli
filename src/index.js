import { Command } from "@oclif/core";
import makeLogger from "./helpers/makeLogger.js";
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirMain = path.dirname(fileURLToPath(import.meta.url));
const dirPackage = path.resolve(dirMain, "..");
const packageJsonPath = path.join(dirPackage, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const vAcc = packageJson.version;
import sdk from "@adobe/acc-js-sdk";
const vSdk = sdk.getSDKVersion().version;

export default class Acc extends Command {
  static description = packageJson.description;
  static version = vAcc;

  async run() {
    const logger = makeLogger(this.config?.cacheDir);
    logger.info(`🏠 acc ${vAcc} initialized with Adobe Campaign SDK ${vSdk}`);
    // Display help if no subcommand
    this.help();
  }
}
