// npm
import { Command, Flags } from "@oclif/core";
import Configstore from "configstore";
import path from "node:path";
import ora from "ora";
// sdk
import sdk from "@adobe/acc-js-sdk";
import Config from "@adobe/aio-lib-core-config/src/Config.js";
import AioLogger from "@adobe/aio-lib-core-logging";
const logger = AioLogger("acc");
// acc
import CampaignConfig from "../../CampaignConfig.js";
import CampaignAuth from "../../CampaignAuth.js";
import CampaignInstance from "../../CampaignInstance.js";

const aioConfig = new Config();
const authFile = new Configstore("campaign-cli.auth");
const auth = new CampaignAuth(logger, sdk, aioConfig, authFile);
const defaultDistRoot = path.join(process.cwd());
const defaultConfigPath = path.join(process.cwd(), "acc.config.json");
const config = new CampaignConfig(logger, defaultConfigPath);

export default class InstancePull extends Command {
  static description = "Pull data from Adobe Campaign instance";

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
  };

  async run() {
    const { flags } = await this.parse();
    config.init(flags.config);
    const client = await auth.login(flags, config.accJsSdkOptions);
    const spinner = (text) => ora(text);
    const instance = new CampaignInstance(
      logger,
      client,
      config,
      flags,
      spinner,
    );
    await instance.pull(false);
  }
}
