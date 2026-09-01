import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";
import { DOC_SOAP } from "../../helpers/helpText.js";

export default class InstanceSoap extends InstanceCommand {
  static description =
    "Call any SOAP method on an Adobe Campaign instance (e.g. nms:delivery#BuildPreviewFromId, xtk:session#GetServerTime).\n" +
    "Works with static methods only (non-static methods are not supported)\n" +
    "Powerful: it can reach all methods, use with care.\n" +
    "\n" +
    DOC_SOAP;

  static examples = [
    {
      command:
        "<%= config.bin %> instance soap --schema xtk:session --method GetServerTime",
      description: `Get the server time`,
    },
    {
      command: `<%= config.bin %> instance soap --schema nms:delivery --method HtmlToText --args '["<p>Hello</p>"]'`,
      description: `Convert HTML to text-only with nms:delivery#HtmlToText method`,
    },
    {
      command: `<%= config.bin %> instance soap -s nms:delivery -m BuildPreviewFromId --args '[1234, {"content": "html", "filter": "@id = 1000"}]' --json`,
      description: `Preview the delivery 1234 with the recipient 1000`,
    },
  ];

  // Enables the built-in oclif `--json` flag: when set, the SimpleJson result is
  // returned (oclif serialises it) instead of the raw XML printed below.
  static enableJsonFlag = true;

  static flags = {
    schema: Flags.string({
      char: "s",
      required: true,
      description: "Schema id, e.g. nms:delivery, xtk:session",
    }),
    method: Flags.string({
      char: "m",
      required: true,
      description:
        "Method name (PascalCase or camelCase accepted), e.g. BuildPreviewFromId",
    }),
    args: Flags.string({
      char: "a",
      description:
        "Method arguments as a JSON array, e.g. '[1234, \"<params/>\"]'. Omit for methods that take no argument.",
    }),
  };

  async run() {
    const { flags } = await this.parse(InstanceSoap);
    const instance = await this.getInstance(flags);
    const result = await instance.soap({
      ...flags,
      json: this.jsonEnabled(),
    });
    // In --json mode oclif serialises the returned object; otherwise the raw XML
    // (or scalar) is the command's result and goes to stdout (this.log).
    if (this.jsonEnabled()) {
      return result;
    }
    this.log(result); // The result content is data: print it on stdout (this.log)
  }
}
