import { Flags } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";
import { EXAMPLE_INSTANCE } from "../../helpers/helpText.js";

export default class MonitorTest extends BaseCommand {
  static description =
    "Health-check an instance via the anonymous /r/test endpoint (Apache front, no login)";

  static flags = {
    host: Flags.string({
      description: `Instance root URL to probe anonymously, e.g. ${EXAMPLE_INSTANCE}`,
      exclusive: ["alias"],
    }),
    alias: Flags.string({
      description:
        "Probe the host of a stored instance alias instead of --host",
      exclusive: ["host"],
    }),
  };

  async run() {
    const { flags } = await this.parse(MonitorTest);
    const { xml, status } = await this.monitor.test(flags);
    // print the raw server XML verbatim for auditability
    this.log(xml);
    if (status !== "OK") {
      this.error(`Health check failed: status=${status}`, { exit: 2 });
    } else {
      this.logger.info(`✅ Health check succeeded: status=${status}`);
    }
  }
}
