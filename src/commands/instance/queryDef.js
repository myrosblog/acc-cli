import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";

export default class InstanceQueryDef extends InstanceCommand {
  static description =
    "Run a read-only query on an Adobe Campaign instance (xtk:queryDef#ExecuteQuery). Pass a queryDef as JSON; it is read-only by construction (no writes, ACL-enforced) — a safe alternative to `instance exec`.";

  static examples = [
    `<%= config.bin %> instance queryDef --alias staging --query '{"schema":"nms:recipient","operation":"select","select":{"node":[{"expr":"@email"},{"expr":"@lastName"}]},"where":{"condition":[{"expr":"@blackList = 0"}]},"lineCount":50}'`,
    "<%= config.bin %> instance queryDef --alias staging --file ./queries/recipients.json --json",
  ];

  // Enables the built-in oclif `--json` flag: when set, the SimpleJson result is
  // returned (oclif serialises it) instead of the raw XML printed below.
  static enableJsonFlag = true;

  static flags = {
    query: Flags.string({
      char: "q",
      description: "queryDef as a JSON string (alternative to --file)",
    }),
    file: Flags.string({
      char: "f",
      description:
        "Path to a .json file containing the queryDef (alternative to --query)",
    }),
  };

  async run() {
    const { flags } = await this.parse(InstanceQueryDef);
    const instance = await this.getInstance(flags);
    const result = await instance.queryDef({
      ...flags,
      json: this.jsonEnabled(),
    });
    // In --json mode oclif serialises the returned object; otherwise the raw XML
    // is the command's result and goes to stdout (this.log).
    if (this.jsonEnabled()) {
      return result;
    }
    this.log(result);
  }
}
