import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";
import AccInstancePull from "../../services/instance/AccInstancePull.js";

export default class InstanceCheck extends InstanceCommand {
  static description =
    "Compute how many records will be downloaded from an Adobe Campaign instance (via SOAP xtk:queryDef#ExecuteQuery). " +
    "The query definitions are read from acc.config.json and control the data retrieval." +
    "\n" +
    "Want to download data after a check? Use the `<%= config.bin %> instance pull` command, which will run the same queries and store them as local files.";

  static examples = [
    {
      command: `<%= config.bin %> instance check`,
      description: `Check records to be downloaded.`,
    },
    {
      command: `<%= config.bin %> instance check --metadata xtk:javascript`,
      description: `Check only the xtk:javascript records to be downloaded.`,
    },
    {
      command: `<%= config.bin %> instance check --alias staging`,
      description: `Check records from your configured staging instance.`,
    },
    {
      command: `<%= config.bin %> instance check --config acc.marketing.config.json`,
      description: `Check records from the specified configuration file.`,
    },
  ];

  static flags = {
    metadata: Flags.string({
      char: "m",
      description:
        "Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation",
    }),
  };

  async run() {
    const { flags } = await this.parse(InstanceCheck);
    const { client, config, flags: resolvedFlags } = await this.connect(flags);
    const instancePull = new AccInstancePull(
      this.logger,
      client,
      config,
      resolvedFlags,
      this.createSpinner,
    );
    await instancePull.pull(true);
  }
}
