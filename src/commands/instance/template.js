import BaseCommand from "../../BaseCommand.js";

export default class InstanceTemplate extends BaseCommand {
  static description = "Generate a template configuration file";

  async run() {
    this.log(this.makeConfig().template()); // The template content is data: print it on stdout (this.log)
  }
}
