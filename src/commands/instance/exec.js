import { Flags } from "@oclif/core";
import InstanceCommand from "../../InstanceCommand.js";

export default class InstanceExec extends InstanceCommand {
  static description =
    "Execute server-side JavaScript on an Adobe Campaign instance (xtk:builder#EvaluateJavaScript)";

  static examples = [
    "<%= config.bin %> instance exec --alias staging --file ./scripts/cleanup.js",
    '<%= config.bin %> instance exec --alias staging --script "context.res = application.instanceName"',
  ];

  static flags = {
    file: Flags.string({
      char: "f",
      description: "Path to a JavaScript file to execute on the server",
    }),
    script: Flags.string({
      char: "s",
      description: "Inline JavaScript to execute (alternative to --file)",
    }),
    name: Flags.string({
      description:
        "Logical name of the script (defaults to the file basename, or 'acc-cli')",
    }),
  };

  async run() {
    const { flags } = await this.parse(InstanceExec);
    const instance = await this.getInstance(flags);
    this.log(await instance.exec(flags)); // The result XML is data: print it on stdout (this.log)
  }
}
