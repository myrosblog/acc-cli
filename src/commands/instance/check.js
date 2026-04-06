import { Command, Flags } from "@oclif/core";
import CampaignConfig from "../../CampaignConfig.js";
import CampaignAuth from "../../CampaignAuth.js";
import CampaignInstance from "../../CampaignInstance.js";
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("acc");
import Configstore from "configstore";
import sdk from "@adobe/acc-js-sdk";
import Config from "@adobe/aio-lib-core-config/src/Config.js";
import path from "node:path";

const aioConfig = new Config();
const authFile = new Configstore("campaign-cli.auth");
const auth = new CampaignAuth(logger, sdk, aioConfig, authFile);
const defaultDistRoot = path.join(process.cwd());
const defaultConfigPath = path.join(process.cwd(), "acc.config.json");
const config = new CampaignConfig(logger, defaultConfigPath);

export default class InstanceCheck extends Command {
  static description =
    "Check configuration and preview data pull from Adobe Campaign instance";

  static flags = {
    alias: Flags.string({
      required: true,
      description: "Local alias for this instance, e.g. prod, staging, local",
    }),
    path: Flags.string({
      description:
        "Path where the command should run. Defaults to current working directory.",
      default: defaultDistRoot,
    }),
    config: Flags.string({
      description:
        "Path to the configuration file. Defaults ./acc.config.json.",
      default: defaultConfigPath,
    }),
    metadata: Flags.string({
      description:
        "Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation",
    }),
    verbose: Flags.boolean({
      description:
        "Verbose output with details on each configuration item. Defaults to false.",
      default: false,
    }),
  };

  async run() {
    const { flags } = await this.parse();
    config.init(flags.config);
    const client = await auth.login(flags, config.accJsSdkOptions);
    const instance = new CampaignInstance(logger, client, config, flags);
    await instance.pull(true);
  }
}
