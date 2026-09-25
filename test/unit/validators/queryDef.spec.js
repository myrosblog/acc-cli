// npm
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs-extra";
import { expect } from "chai";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const queryDefSchema = fs.readJsonSync(
  join(__dirname, "../../../src/validators/queryDef.json"),
);

describe("validators/queryDef.json", () => {
  const validate = new Ajv({ allErrors: true }).compile(queryDefSchema);

  // Examples of https://opensource.adobe.com/acc-js-sdk/xtkQueryDef.html: the
  // whitelist must accept documented usage.
  const documentedQueryDefs = {
    "select with nodes": {
      schema: "nms:extAccount",
      operation: "select",
      select: { node: [{ expr: "@id" }, { expr: "@name" }] },
    },
    "get with a where condition": {
      schema: "nms:extAccount",
      operation: "get",
      select: { node: [{ expr: "@id" }] },
      where: { condition: [{ expr: "@name='ffda'" }] },
    },
    "pagination with orderBy": {
      schema: "nms:deliveryMapping",
      operation: "select",
      lineCount: 2,
      startLine: 2,
      select: { node: [{ expr: "@id" }, { expr: "@name" }] },
      orderBy: { node: [{ expr: "@name" }] },
    },
    "analyze on a node": {
      schema: "nms:deliveryMapping",
      operation: "get",
      select: {
        node: [
          { expr: "@id" },
          { expr: "[storage/@exclusionType]", analyze: true },
        ],
      },
      where: { condition: [{ expr: "@name='mapRecipient'" }] },
    },
  };

  for (const [name, queryDef] of Object.entries(documentedQueryDefs)) {
    it(`should accept the documented example: ${name}`, () => {
      expect(validate(queryDef), JSON.stringify(validate.errors)).to.be.true;
    });
  }

  it("should accept an unbound element as one object instead of an array", () => {
    const queryDef = {
      schema: "nms:recipient",
      where: { condition: { expr: "@id > 0" } },
      orderBy: { node: { expr: "@id" } },
    };
    expect(validate(queryDef), JSON.stringify(validate.errors)).to.be.true;
  });

  it("should accept a nested subQuery and reject its unknown keys", () => {
    const queryDef = {
      schema: "nms:recipient",
      where: {
        condition: [
          {
            setOperator: "EXISTS",
            subQuery: { schema: "nms:broadLogRcp", unknownKey: true },
          },
        ],
      },
    };
    expect(validate(queryDef)).to.be.false;
    expect(validate.errors[0].instancePath).to.equal(
      "/where/condition/0/subQuery",
    );
    expect(validate.errors[0].params.additionalProperty).to.equal("unknownKey");
  });

  it("should reject orderBy inside where", () => {
    const queryDef = { where: { orderBy: { node: [{ expr: "@name" }] } } };
    expect(validate(queryDef)).to.be.false;
    expect(validate.errors[0].instancePath).to.equal("/where");
    expect(validate.errors[0].params.additionalProperty).to.equal("orderBy");
  });
});
