import BaseCommand from "../../BaseCommand.js";

export default class AuthIp extends BaseCommand {
  static description = "Get IP address of the current machine";

  async run() {
    await this.parse(AuthIp);
    await this.auth.ip();
  }
}
