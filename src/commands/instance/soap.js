import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";
import AccInstanceSoap from "../../services/instance/AccInstanceSoap.js";
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
      description: `Get the server time (xtk:session#GetServerTime)`,
    },
    {
      command:
        "<%= config.bin %> instance soap -s xtk:builder -m GetDefaultNamespace",
      description: `Get the default namespace (xtk:builder#GetDefaultNamespace)`,
    },
    {
      command: `<%= config.bin %> instance soap -s xtk:session -m GetDefaultEntity --args '["nms:recipient"]'`,
      description: `Get the default entity for the nms:recipient schema (xtk:session#GetDefaultEntity)`,
    },
    {
      command: `<%= config.bin %> instance soap -s xtk:session -m GetNewIds --args '[5]'`,
      description: `Get 5 new IDs (xtk:session#GetNewIds)`,
    },
    {
      command: `<%= config.bin %> instance soap -s xtk:session -m GetOption --args '["Nms_DefaultRcpSchema"]'`,
      description: `Get an option, such as Nms_DefaultRcpSchema (xtk:session#GetOption)`,
    },
    {
      command: `<%= config.bin %> instance soap -s nms:delivery -m HtmlToText --args '["<p>Hello</p>"]'`,
      description: `Convert HTML to text-only (nms:delivery#HtmlToText)`,
    },
    {
      command: `<%= config.bin %> instance soap -s nms:delivery -m BuildPreviewFromId --args '[1234, {"content": "html", "filter": "@id = 1000"}]' --json`,
      description: `Preview a delivery with a recipient (nms:delivery#BuildPreviewFromId)`,
    },
    {
      command: `<%= config.bin %> instance soap -s xtk:session -m GetOption --args '["WdbcTimeZone"]' --raw`,
      description: `Print the SOAP response as received (<?xml version='1.0'?><SOAP-ENV:Envelope ...)`,
    },
  ];

  // Enables the built-in oclif `--json` flag: when set, the SimpleJson result is
  // returned (oclif serialises it) instead of the XML printed below.
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
      description:
        "Method arguments as a JSON array, e.g. '[1234, \"<params/>\"]'. Omit for methods that take no argument.",
    }),
    raw: Flags.boolean({
      description:
        "Print the SOAP response (XML) as received, instead of the return values.",
      exclusive: ["json"],
    }),
  };

  async run() {
    const { flags } = await this.parse(InstanceSoap);
    const { client } = await this.connect(flags);
    const instanceSoap = new AccInstanceSoap(
      this.logger,
      client,
      this.createSpinner,
    );
    const result = await instanceSoap.soap({
      ...flags,
      json: this.jsonEnabled(),
    });

    this.log(result);
    return result;
  }
}
