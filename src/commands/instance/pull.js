import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";

export default class InstancePull extends InstanceCommand {
  static description = "Pull data from Adobe Campaign instance";

  static flags = {
    metadata: Flags.string({
      description:
        "Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation",
    }),
  };

  async run() {
    const { flags } = await this.parse(InstancePull);
    const instance = await this.getInstance(flags);
    await instance.pull(false);
  }
}
