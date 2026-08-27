import Table from "cli-table3";
import BaseCommand from "../../BaseCommand.js";

export default class AuthList extends BaseCommand {
  static description =
    "Read credentials (from local .aio file) and display configured Adobe Campaign instances.\n" +
    "\n" +
    "Must be ran after `auth init`.";

  static examples = [
    {
      command: "<%= config.bin %> auth list",
      description: "Display your instances as table",
    },
    {
      command: "<%= config.bin %> auth list --json",
      description: "For CI/CD: Output as json",
    },
  ];

  static enableJsonFlag = true;

  static COLUMNS = ["alias", "host", "user", "method"];

  async run() {
    await this.parse(AuthList);
    const rows = this.auth.list();

    // In --json mode, return the redacted rows; oclif prints them as JSON.
    if (this.jsonEnabled()) {
      return rows;
    }

    if (rows.length === 0) {
      this.log("No instances configured. Run `acc auth init` to add one.");
      return rows;
    }

    const table = new Table({
      head: AuthList.COLUMNS.map((c) => c.toUpperCase()),
    });
    for (const row of rows) {
      table.push(AuthList.COLUMNS.map((c) => row[c] ?? ""));
    }
    this.log(table.toString());
    this.logger.info(`${table.length} instance(s) listed.`);
    return rows;
  }
}
