import { Command } from "@oclif/core";
import CampaignAuth from "../../CampaignAuth.js";
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("acc");
import Configstore from "configstore";
import sdk from "@adobe/acc-js-sdk";
import Config from "@adobe/aio-lib-core-config/src/Config.js";

const aioConfig = new Config();
const authFile = new Configstore("campaign-cli.auth");
const auth = new CampaignAuth(logger, sdk, aioConfig, authFile);

export default class AuthIp extends Command {
  static description = "Get IP address of the current machine";

  async run() {
    await this.parse();
    await auth.ip();
  }
}
