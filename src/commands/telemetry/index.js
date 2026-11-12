import { Args } from "@oclif/core";
import BaseCommand from "../../BaseCommand.js";

export default class Telemetry extends BaseCommand {
  static description =
    "Display or change the collection of anonymous usage data.\n" +
    "\n" +
    "Only the command, the flag names, the duration, the versions and the shell name are sent. " +
    "Never the instance, the arguments, the flag values or the result. ";

  static args = {
    state: Args.string({
      description: "Turn telemetry on or off",
      options: ["on", "off"],
    }),
  };

  static examples = [
    {
      command: "<%= config.bin %> telemetry",
      description: "Display whether telemetry is on.",
    },
    {
      command: "<%= config.bin %> telemetry off",
      description: "Stop sending usage data.",
    },
  ];

  static enableJsonFlag = true;

  async run() {
    const { args } = await this.parse(Telemetry);
    if (args.state === "on") {
      this.telemetry.lib.enable();
    } else if (args.state === "off") {
      this.telemetry.lib.disable();
    }
    const enabled = this.telemetry.lib.isEnabled();
    this.log(`Telemetry is ${enabled ? "on" : "off"}.`);
    return { enabled };
  }
}
