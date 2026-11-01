// npm
import fs from "fs-extra";
import path from "node:path";
// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import DomUtilAcc from "../../helpers/DomUtilAcc.js";

/**
 * Builds the payload of a decomposed file and writes it to the `dist` folder
 * of the project, so what is sent to the instance can be audited and diffed.
 *
 * @class AccInstancePush
 */
class AccInstancePush {
  /**
   * Folder of the built payloads, relative to the project path
   * @type {string}
   */
  static DIST_DIRNAME = "dist";

  /** @type {AioLogger} */
  logger;

  /** @type {string} */
  projectPath;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {object} cliOptions - Command-line options: `path` (project folder)
   */
  constructor(logger, cliOptions) {
    this.logger = logger;
    this.projectPath = cliOptions.path || process.cwd();
  }

  /**
   * Builds the xtk:session#Write payload of a decomposed file: the content as
   * CDATA at the xpath, with the reconciliation key, then writes it to `dist`.
   *
   * @param {string} filePath - Absolute path of the decomposed file
   * @param {string} xpath - xpath key of the decompose config
   * @param {string} content - Content of the decomposed file
   * @param {XtkSchema} schema - Schema of the entity, from the SDK
   * @param {Array<{xpath: string, attributeName: string, value: string}>} keyValues - Reconciliation key values
   * @returns {{payloadDocument: Document, distPath: string}} The payload and the file it was written to, e.g. <project>/dist/cus/myScript.js.xml
   */
  build(filePath, xpath, content, schema, keyValues) {
    // Add .xml suffix to log the SOAP payload in XML format
    const distPath = path.join(
      this.projectPath,
      AccInstancePush.DIST_DIRNAME,
      `${path.relative(this.projectPath, filePath)}.xml`,
    );
    // wrap in CDATA and schema root
    const payloadDocument = DomUtilAcc.buildXmlFromPath(
      xpath,
      content,
      schema.name,
    );
    // add update fields
    const payload = payloadDocument.documentElement;
    payload.setAttribute("xtkschema", schema.id);
    payload.setAttribute("_operation", "update");
    payload.setAttribute(
      "_key",
      keyValues.map(({ xpath: keyXpath }) => keyXpath).join(","),
    );
    for (const { attributeName, value } of keyValues) {
      payload.setAttribute(attributeName, value);
    }

    // save the payload before the SOAP call, for troubleshooting
    fs.outputFileSync(distPath, DomUtil.toXMLString(payloadDocument));
    this.logger.verbose(`Payload written to ${distPath}`);

    return { payloadDocument, distPath };
  }
}

export default AccInstancePush;
