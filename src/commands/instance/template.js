import BaseCommand from "../../BaseCommand.js";

export default class InstanceTemplate extends BaseCommand {
  static description = "Generate a template configuration file";

  async run() {
    this.makeConfig().template();
  }
}
