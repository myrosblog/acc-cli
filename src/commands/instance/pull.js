import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";

export default class InstancePull extends InstanceCommand {
  static description =
    "Pull data with read-only queries from an Adobe Campaign instance (via SOAP xtk:queryDef#ExecuteQuery). " +
    "The query definitions are read from acc.config.json and control the data retrieval." +
    "\n" +
    "Want to check which records will be downloaded? Use the `<%= config.bin %> instance check` command first, which will run the same queries but only return the record counts.";

  static examples = [
    {
      command: `<%= config.bin %> instance pull`,
      description: `Pull records and store them as local files.`,
    },
    {
      command: `<%= config.bin %> instance pull --metadata xtk:javascript`,
      description: `Pull only the xtk:javascript schema and store it as local files.`,
    },
    {
      command: `<%= config.bin %> instance pull --alias staging`,
      description: `Pull records from your configured staging instance and store them as local files.`,
    },
    {
      command: `<%= config.bin %> instance pull --config acc.marketing.config.json`,
      description: `Pull records from the specified configuration file and store them as local files.`,
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
    const { flags } = await this.parse(InstancePull);
    const instance = await this.getInstance(flags);
    await instance.pull(false);
  }
}
