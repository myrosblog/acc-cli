import BaseCommand from "../../BaseCommand.js";
import { DOC_WHITELIST } from "../../helpers/helpText.js";

export default class AuthIp extends BaseCommand {
  static description =
    "Call api.db-ip.com and output your public IP address. Use it to troubleshoot IP whitelisting issues.\n" +
    "\n" +
    DOC_WHITELIST;

  static examples = [
    {
      command: "<%= config.bin %> auth ip",
      description:
        'Fetch IP and displays it as JSON. I.e. {ipAddress: "", countryCode: ""}',
    },
  ];

  async run() {
    await this.parse(AuthIp);
    this.log(await this.auth.ip()); // The IP is data: print it on stdout (this.log)
  }
}
