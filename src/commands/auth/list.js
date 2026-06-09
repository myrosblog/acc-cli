import Table from "cli-table3";
import BaseCommand from "../../BaseCommand.js";

export default class AuthList extends BaseCommand {
  static description = "List configured Adobe Campaign instances";

  // Enables the built-in oclif `--json` flag: when set, oclif serialises the
  // value returned by run() instead of printing the human table below.
  static enableJsonFlag = true;

  // Columns shown both in the table and in --json output. No password ever:
  // the raw secret stays reachable only via the explicit `acc config get`.
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
