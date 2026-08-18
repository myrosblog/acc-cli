// npm
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs-extra";
import sinon from "sinon";
// acc
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";

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
  fail() {},
  get text() {
    return "";
  },
  set text(_) {},
});

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

export { makeClient, makeLogger, makeSpinner, filterSchemas, loadXml };
