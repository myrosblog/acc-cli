import { expect } from "chai";
import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
import { makeSchema } from "../../helpers.js";
import { formatKeyValues, getWriteKey } from "../../../src/helpers/writeKey.js";

// An entity schema as the SDK returns it: an internal key on @id, an external
// key on @name + @namespace
const javascriptSchemaXml = `<schema namespace="xtk" name="javascript">
  <element name="javascript">
    <key name="id" internal="true"><keyfield xpath="@id"/></key>
    <key name="name"><keyfield xpath="@name"/><keyfield xpath="@namespace"/></key>
    <attribute name="id" type="long"/>
    <attribute name="name" type="string"/>
    <attribute name="namespace" type="string"/>
  </element>
</schema>`;

describe("helpers/writeKey", () => {
  describe("getWriteKey", () => {
    const parseMeta = (xml) => DomUtil.parse(xml).documentElement;

    it("should reconcile on the internal key over the external one", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(
        `<javascript id="456" name="myScript" namespace="cus"/>`,
      );

      const { key, keyValues } = getWriteKey(schema, rootElement);

      expect(key.name).to.equal("id");
      expect(key.isInternal).to.be.true;
      expect(keyValues).to.deep.equal([
        { xpath: "@id", attributeName: "id", value: "456" },
      ]);
    });

    it("should use the external key when the schema has no internal one", () => {
      const schema = makeSchema(`<schema namespace="xtk" name="javascript">
        <element name="javascript">
          <key name="name"><keyfield xpath="@name"/><keyfield xpath="@namespace"/></key>
          <attribute name="name" type="string"/>
          <attribute name="namespace" type="string"/>
        </element>
      </schema>`);
      const rootElement = parseMeta(
        `<javascript name="myScript" namespace="cus"/>`,
      );

      const { key, keyValues } = getWriteKey(schema, rootElement);

      expect(key.name).to.equal("name");
      expect(key.isInternal).to.be.false;
      // composite fields, in keyfield order
      expect(keyValues.map(({ value }) => value)).to.deep.equal([
        "myScript",
        "cus",
      ]);
    });

    it("should throw when the key attribute is absent", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(
        `<javascript name="myScript" namespace="cus"/>`,
      );

      expect(() => getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "id"/,
      );
    });

    it("should throw when the key attribute is empty", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(
        `<javascript id="" name="myScript" namespace="cus"/>`,
      );

      expect(() => getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "id"/,
      );
    });

    it("should resolve a keyfield nested under an element", () => {
      const schema = makeSchema(`<schema namespace="nms" name="delivery">
        <element name="delivery">
          <key name="content"><keyfield xpath="content/@code"/></key>
          <element name="content"><attribute name="code" type="string"/></element>
        </element>
      </schema>`);
      const rootElement = parseMeta(
        `<delivery><content code="DM123"/></delivery>`,
      );

      const { keyValues } = getWriteKey(schema, rootElement);

      expect(keyValues).to.deep.equal([
        { xpath: "content/@code", attributeName: "code", value: "DM123" },
      ]);
    });

    it("should reject a key whose keyfield is an element", () => {
      const schema = makeSchema(`<schema namespace="cus" name="thing">
        <element name="thing">
          <key name="byElement"><keyfield xpath="label"/></key>
          <element name="label" type="string"/>
        </element>
      </schema>`);
      const rootElement = parseMeta(`<thing><label>hello</label></thing>`);

      expect(() => getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "byElement"/,
      );
    });

    it("should name the schema and the key it could not read", () => {
      const schema = makeSchema(javascriptSchemaXml);
      const rootElement = parseMeta(`<javascript label="orphan"/>`);

      try {
        getWriteKey(schema, rootElement);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.code).to.equal("INSTANCE_WATCH_NO_WRITE_KEY");
        expect(err.message).to.include("xtk:javascript");
        expect(err.message).to.include('"id"');
      }
    });

    it("should throw when the key has no keyfield", () => {
      const schema = makeSchema(`<schema namespace="cus" name="empty">
        <element name="empty"><key name="k"/></element>
      </schema>`);
      const rootElement = parseMeta(`<empty/>`);

      expect(() => getWriteKey(schema, rootElement)).to.throw(
        /no value for the key "k"/,
      );
    });

    it("should throw when the schema defines no key at all", () => {
      const schema = makeSchema(`<schema namespace="cus" name="keyless">
        <element name="keyless"><attribute name="id" type="long"/></element>
      </schema>`);
      const rootElement = parseMeta(`<keyless id="1"/>`);

      expect(() => getWriteKey(schema, rootElement)).to.throw(
        /\(none defined\)/,
      );
    });
  });

  describe("formatKeyValues", () => {
    it("should render a single field as its bare value", () => {
      const formatted = formatKeyValues([
        { attributeName: "internalName", value: "DM123" },
      ]);

      expect(formatted).to.equal("DM123");
    });

    it("should render name and namespace as namespace:name", () => {
      const formatted = formatKeyValues([
        { attributeName: "name", value: "New" },
        { attributeName: "namespace", value: "cus" },
      ]);

      expect(formatted).to.equal("cus:New");
    });

    it("should render namespace:name whatever the keyfield order", () => {
      const formatted = formatKeyValues([
        { attributeName: "namespace", value: "cus" },
        { attributeName: "name", value: "New" },
      ]);

      expect(formatted).to.equal("cus:New");
    });

    it("should join any other composite key with a comma", () => {
      const formatted = formatKeyValues([
        { attributeName: "internalName", value: "DM123" },
        { attributeName: "messageType", value: "email" },
      ]);

      expect(formatted).to.equal("DM123, email");
    });
  });
});
