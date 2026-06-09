import BaseCommand from "../../BaseCommand.js";

export default class AuthIp extends BaseCommand {
  static description = "Get IP address of the current machine";

  async run() {
    await this.parse(AuthIp);
    this.log(await this.auth.ip()); // The IP is data: print it on stdout (this.log)
  }
}
