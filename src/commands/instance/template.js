import BaseCommand from "../../BaseCommand.js";

export default class InstanceTemplate extends BaseCommand {
  static description = "Output a template configuration file";

  static examples = [
    {
      command: "<%= config.bin %> instance template",
      description: "Output the template in the console.",
    },
    {
      command: "<%= config.bin %> instance template > acc.config.json",
      description: "Output the template in a file.",
    },
  ];

  async run() {
    this.log(this.makeConfig().template()); // The template content is data: print it on stdout (this.log)
  }
}
