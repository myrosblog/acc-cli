// e2e for `acc instance check` and `pull` against a live instance, on xtk:xslt:
// standard stylesheets, in small enough namespaces to pull in seconds. The
// record count comes from a queryDef, and check and pull must match it.
// Suite docs (how to run, gating): see ./README.md
import { join } from "node:path";
import os from "node:os";
import fs from "node:fs";
import { expect } from "chai";
import { ALIAS, runAcc } from "../helpers-cli.js";

const SCHEMA_ID = "xtk:xslt";
const FILENAME_PATTERN = "/xslt/{@namespace}/{@name}.xml";
const ORDER_BY = { node: [{ expr: "@name" }] };

describe(`acc instance pull (e2e CLI, alias=${ALIAS})`, function () {
  this.timeout(120000);

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
   * Writes an acc.config.json pulling the xtk:xslt of one namespace.
   * @param {string} namespace - namespace to pull
   * @param {object} [orderBy] - queryDef orderBy, none by default
   */
  const writeConfig = (namespace, orderBy) =>
    fs.writeFileSync(
      join(cwd, "acc.config.json"),
      JSON.stringify({
        alias: ALIAS,
        // a page of 20 stylesheets takes about 5s, the SDK default timeout
        "acc-js-sdk": { timeout: 60000 },
        schemas: [
          {
            schemaId: SCHEMA_ID,
            filename: FILENAME_PATTERN,
            queryDef: {
              where: { condition: [{ expr: `@namespace = '${namespace}'` }] },
              ...(orderBy && { orderBy }),
            },
          },
        ],
      }),
    );

  /**
   * Counts the records on the server: the number of files a correct pull writes.
   * @param {string} dir - throwaway cwd to run the query in
   * @param {string} namespace - namespace to count
   * @returns {Promise<number>} the record count
   */
  const countOnServer = async (dir, namespace) => {
    const query =
      `<queryDef schema="${SCHEMA_ID}" operation="count"><where>` +
      `<condition expr="@namespace = '${namespace}'"/></where></queryDef>`;
    const { stdout } = await runAcc(
      ["instance", "queryDef", "--alias", ALIAS, "--query", query],
      { cwd: dir },
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
      .readdirSync(join(cwd, "xslt"), { recursive: true })
      .filter((file) => file.endsWith(".xml")).length;

  // Last line of check and pull: "<filename>: xtk:xslt 29 parsed"
  const parsedCount = (stderr) => Number(stderr.match(/ (\d+) parsed/)?.[1]);

  /**
   * Registers the tests of one pull. To be used to test 1 batch, 2 batches, etc.
   * @param {string} namespace - xtk:xslt namespace to pull
   * @param {number} batches - requests the pull makes
   * @param {number[]} range - [min, max] record count giving that many batches
   */
  const describePull = (schemaId, namespace, batches, [min, max]) =>
    describe(`acc instance check/pull ${schemaId} for namespace: ${namespace}`, () => {
      let expectedCount;
      before(async function () {
        const dir = fs.mkdtempSync(join(os.tmpdir(), "acc-e2e-count-"));
        try {
          expectedCount = await countOnServer(dir, namespace);
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
        console.log(
          `      ${expectedCount} retrieved via queryDef (expected between ${min}-${max})`,
        );
        if (expectedCount < min || expectedCount > max) this.skip();
      });

      it("acc instance check (0 file)", async () => {
        writeConfig(namespace);

        const { stderr } = await acc("instance", "check", "-m", schemaId);

        expect(parsedCount(stderr), stderr).to.equal(expectedCount);
        expect(fs.existsSync(join(cwd, "xslt"))).to.be.false;
      });

      it("acc instance pull (orderBy)", async () => {
        writeConfig(namespace, ORDER_BY);

        const { stderr } = await runAcc(["instance", "pull", "-m", schemaId], {
          cwd,
          env: { AIO_LOG_LEVEL: "verbose" },
        });

        expect(countFiles()).to.equal(expectedCount);
        expect(stderr).to.not.contain("already existing in this pull");
        expect(stderr.match(/Querying instance for records/g)).to.have.lengthOf(
          batches,
        );
      });

      it("acc instance pull (no orderBy)", async () => {
        writeConfig(namespace);

        const { stderr } = await acc("instance", "pull", "-m", schemaId);

        // Pages may overlap without orderBy: each missing file must be reported
        const match = stderr.match(
          /(\d+) records were saved to a file already existing in this pull/,
        );
        const overwrittenCount = match ? Number(match[1]) : 0;
        expect(countFiles() + overwrittenCount).to.equal(expectedCount);
      });
    });

  describePull(SCHEMA_ID, "nl", 1, [1, 19]);
  describePull(SCHEMA_ID, "nms", 2, [21, 39]);
});
