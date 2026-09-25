// e2e for `acc instance pull` against a live instance: pulls xtk:form (read-only)
// and checks every record on the server ends up in its own file.
// Paginating without orderBy lets the database return overlapping pages: some
// records are written twice (overwritten) and others never. The pull must then
// report the overwritten files instead of succeeding silently.
// Suite docs (how to run, gating): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "./helpers.js";

// Several pages of 20 on a standard instance, the case where pages overlapped
const WHERE = { condition: [{ expr: "@namespace NOT IN ('xtk')" }] };
const COUNT_QUERY_XML =
  '<queryDef schema="xtk:form" operation="count">' +
  "<where><condition expr=\"@namespace NOT IN ('xtk')\"/></where></queryDef>";

describe(`acc instance pull (e2e CLI, alias=${ALIAS})`, function () {
  // A full xtk:form pull downloads every form definition (~90s on a local instance)
  this.timeout(300000);

  // Throwaway cwd per test: it holds the test's own acc.config.json and the
  // pulled files, which must not land in the repo.
  let cwd;
  beforeEach(() => {
    cwd = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-"));
  });
  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const acc = (...args) => runAcc(args, { cwd });

  /**
   * Writes an acc.config.json pulling xtk:form only.
   * @param {object} queryDef - queryDef merged by the pull (where, orderBy...)
   */
  const writeConfig = (queryDef) =>
    fs.writeFileSync(
      join(cwd, "acc.config.json"),
      JSON.stringify({
        alias: ALIAS,
        schemas: [
          {
            schemaId: "xtk:form",
            filename: "/forms/{@namespace}/{@name}.xml",
            queryDef,
          },
        ],
      }),
    );

  /**
   * Counts the records on the server: the number of files a correct pull writes.
   * @returns {Promise<number>} the record count
   */
  const countOnServer = async () => {
    const { stdout } = await acc(
      "instance",
      "queryDef",
      "--query",
      COUNT_QUERY_XML,
    );
    const match = stdout.match(/count="(\d+)"/);
    expect(match, `no count in stdout: ${stdout}`).to.not.be.null;
    return Number(match[1]);
  };

  /**
   * Counts the files written by the pull.
   * @returns {number} the number of pulled .xml files
   */
  const countFiles = () =>
    fs
      .readdirSync(join(cwd, "forms"), { recursive: true })
      .filter((file) => file.endsWith(".xml")).length;

  it("never loses records silently (no orderBy)", async () => {
    writeConfig({ where: WHERE });
    const expectedCount = await countOnServer();

    const { stderr } = await acc("instance", "pull", "--metadata", "xtk:form");

    // Whether or not the database reorders pages on this instance, each
    // missing file must be reported as overwritten.
    const match = stderr.match(
      /(\d+) records were written to a file already written/,
    );
    const overwrittenCount = match ? Number(match[1]) : 0;
    expect(countFiles() + overwrittenCount).to.equal(expectedCount);
  });

  it("writes every record once with a unique orderBy next to where", async () => {
    writeConfig({
      where: WHERE,
      orderBy: { node: [{ expr: "@namespace" }, { expr: "@name" }] },
    });
    const expectedCount = await countOnServer();

    const { stderr } = await acc("instance", "pull", "--metadata", "xtk:form");

    expect(countFiles()).to.equal(expectedCount);
    expect(stderr).to.not.contain("already written");
  });
});
