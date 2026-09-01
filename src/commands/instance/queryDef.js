import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";
import { DOC_QUERYDEF } from "../../helpers/helpText.js";

export default class InstanceQueryDef extends InstanceCommand {
  static description =
    "Run a read-only query on an Adobe Campaign instance (via SOAP xtk:queryDef#ExecuteQuery). " +
    "Pass a queryDef as JSON; it is read-only by construction (no writes, read-only permission compatible), a safe alternative to `instance exec`." +
    "\n" +
    DOC_QUERYDEF;

  static examples = [
    {
      command: `<%= config.bin %> instance queryDef --query '<queryDef schema="xtk:option" operation="get"><select><node expr="@stringValue" /></select></queryDef>'`,
      description: `Get an option in XML format (SQL Read, queryDef Get). Result: <option stringValue="..."/>`,
    },
    {
      command: `<%= config.bin %> instance queryDef --query '{"schema":"xtk:option", "operation": "get", "select": {"node": [{"expr": "@stringValue"}] } }' --json`,
      description: `Get an option in JSON format (SQL Read, queryDef Get). Result: {stringValue: "..."}`,
    },
    {
      command:
        "<%= config.bin %> instance queryDef --file ./queries/recipients.json --json",
      description:
        "For big or recurrent queries, consider saving them in a file: get a list of recipients (SQL Read, queryDef select)",
    },
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
    this.log(result); // The result content is data: print it on stdout (this.log)
  }
}
