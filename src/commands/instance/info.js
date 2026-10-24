import InstanceCommand from "../../InstanceCommand.js";
import AccInstanceInfo from "../../services/instance/AccInstanceInfo.js";

export default class InstanceInfo extends InstanceCommand {
  static description =
    "Diagnostic report for an Adobe Campaign instance (xtk:session#TestCnx, #GetServerTime, #GetCnxInfo, nl:monitoring#DumpCurrentInstanceState)";

  static examples = ["<%= config.bin %> instance info --alias staging"];

  async run() {
    const { flags } = await this.parse(InstanceInfo);
    // DumpCurrentInstanceState is heavy (~7s) and exceeds the SDK default HTTP
    // timeout of 5s, so raise it for this connection.
    const { client } = await this.connect(flags, { timeout: 60000 });
    const instanceInfo = new AccInstanceInfo(
      this.logger,
      client,
      this.createSpinner,
    );
    const { text, errors } = await instanceInfo.info();
    this.log(text);
    if (errors.length) {
      this.error(`Instance info: ${errors.length} probe(s) failed`, {
        exit: 2,
      });
    }
  }
}
