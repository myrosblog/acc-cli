// npm
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import os from "os";
import fs from "fs-extra";
import sinon from "sinon";
// acc
import BaseCommand from "../src/BaseCommand.js";
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
import { newSchema } from "@adobe/acc-js-sdk/src/application.js";

const makeClient = () => ({
  DomUtil,
});

const makeLogger = () => ({
  info: sinon.stub(),
  verbose: sinon.stub(),
  warn: sinon.stub(),
  error: sinon.stub(),
  debug: sinon.stub(),
});

const makeSpinner = () => ({
  start() {
    return this;
  },
  succeed() {},
  warn() {},
  fail() {},
  get text() {
    return "";
  },
  set text(_) {},
});

/**
 * Build a real XtkSchema from a schema XML string, the same class
 * client.application.getSchema() returns at runtime.
 * @param {string} xml the <schema> definition
 * @returns {XtkSchema} the schema
 */
const makeSchema = (xml) => newSchema(DomUtil.parse(xml));

/** Shallow-clone config and keep only the given schemaIds */
const filterSchemas = (config, ...schemaIds) => ({
  ...config,
  schemas: config.schemas.filter((x) => schemaIds.includes(x.schemaId)),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const loadXml = (dir, file) =>
  DomUtil.getFirstChildElement(
    DomUtil.parse(fs.readFileSync(join(__dirname, dir, file))),
  ); // DomUtil.parse returns Document, but all methods use Element, hence the conversion

/**
 * Points the aio config to a file that does not exist, so a test never reads the
 * credentials of the developer running it. Undone by sinon.restore().
 * @returns {string} the path of the credentials file
 */
const useMissingCredentialsFile = () => {
  const credentialsFile = join(os.tmpdir(), "acc-test-no-such-dir", "aio");
  sinon
    .stub(process, "env")
    .value({ ...process.env, AIO_CONFIG_FILE: credentialsFile });
  return credentialsFile;
};

/**
 * Replaces the logger of every command with a stub, to assert what is logged.
 * Undone by sinon.restore().
 * @returns {object} the stubbed logger
 */
const useCommandLogger = () => {
  const logger = makeLogger();
  sinon.stub(BaseCommand.prototype, "logger").get(() => logger);
  return logger;
};

export {
  makeClient,
  makeLogger,
  makeSpinner,
  makeSchema,
  filterSchemas,
  loadXml,
  useMissingCredentialsFile,
  useCommandLogger,
};
