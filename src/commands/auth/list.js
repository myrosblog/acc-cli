import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { AUTH_INSTANCES_KEY } from "../../CampaignAuth.js";

export default class AuthList extends BaseCommand {
  static description = "List configured Adobe Campaign instances";

  static flags = {
    json: Flags.boolean({
      char: "j",
      description: "output in json",
      exclusive: ["yaml"],
    }),
    yaml: Flags.boolean({
      char: "y",
      description: "output in yaml",
      exclusive: ["json"],
    }),
  };

  async run() {
    const { flags } = await this.parse(AuthList);
    const argv = [AUTH_INSTANCES_KEY];
    if (flags.json) argv.push("--json");
    if (flags.yaml) argv.push("--yaml");
    await this.config.runCommand("config:get", argv);
  }
}
