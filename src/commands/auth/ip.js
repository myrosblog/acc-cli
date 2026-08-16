import BaseCommand from "../../BaseCommand.js";

export default class AuthIp extends BaseCommand {
  static description =
    "Call api.db-ip.com and output your public IP address. Use it to troubleshoot IP whitelisting issues.";

  async run() {
    await this.parse(AuthIp);
    this.log(await this.auth.ip()); // The IP is data: print it on stdout (this.log)
  }
}
