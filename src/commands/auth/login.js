import { Command, Flags } from "@oclif/core";
import CampaignAuth from "../../CampaignAuth.js";
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("acc");
import Configstore from "configstore";
import sdk from "@adobe/acc-js-sdk";
import Config from "@adobe/aio-lib-core-config/src/Config.js";

const aioConfig = new Config();
const authFile = new Configstore("campaign-cli.auth");
const auth = new CampaignAuth(logger, sdk, aioConfig, authFile);

export default class AuthLogin extends Command {
  static description = "Login to an Adobe Campaign instance";

  static flags = {
    alias: Flags.string({
      required: true,
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
  };

  async run() {
    const { flags } = await this.parse();
    await auth.login(flags);
  }
}
