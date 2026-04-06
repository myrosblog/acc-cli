import { Command } from "@oclif/core";
import CampaignConfig from "../../CampaignConfig.js";
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("acc");
import path from "node:path";

const defaultConfigPath = path.join(process.cwd(), "acc.config.json");
const config = new CampaignConfig(logger, defaultConfigPath);

export default class InstanceTemplate extends Command {
  static description = "Generate a template configuration file";

  async run() {
    config.template();
  }
}
