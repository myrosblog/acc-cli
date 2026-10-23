import DomUtilAcc from "./DomUtilAcc.js";
import { codes } from "./AccErrors.js";
const { INSTANCE_WATCH_NO_WRITE_KEY } = codes;

/**
 * Reads the values of every field of a key from the meta document.
 *
 * @param {XtkSchemaKey} key - The key definition, from the SDK schema
 * @param {Element} rootElement - Root element of the meta document
 * @returns {Array<{xpath: string, attributeName: string, value: string}>|null} the values, or null if the key cannot be used
 */
function getKeyValues(key, rootElement) {
  const keyValues = [];

  for (const field of key.fields) {
    // nodePath is absolute ("/@name"), the keyfield xpath is relative to the root
    const keyXpath = field.nodePath.replace(/^\//, "");
    const { node, attributeName } = DomUtilAcc.resolveXPathTarget(
      rootElement,
      keyXpath,
    );

    // A key on an element rather than an attribute cannot be written as an
    // attribute of the payload, so the whole key is unusable
    if (!node || attributeName === null) {
      return null;
    }

    const value = node.getAttribute(attributeName);
    if (!value) {
      return null;
    }

    keyValues.push({ xpath: keyXpath, attributeName, value });
  }

  return keyValues.length > 0 ? keyValues : null;
}

/**
 * Picks the key to reconcile the entity on, and reads its values from the meta
 * document. The key is the schema's first one, internal before external, as
 * the SDK itself resolves it.
 *
 * @param {XtkSchema} schema - The schema of the entity, from the SDK
 * @param {Element} rootElement - Root element of the meta document
 * @returns {{key: XtkSchemaKey, keyValues: Array<{xpath: string, attributeName: string, value: string}>}} the key and its values
 * @throws {INSTANCE_WATCH_NO_WRITE_KEY} If the meta file does not supply the key
 * @see https://opensource.adobe.com/acc-js-sdk/application.html
 */
export function getWriteKey(schema, rootElement) {
  const key = schema.root.firstKeyDef(); // internal key first, external otherwise
  const keyValues = key && getKeyValues(key, rootElement);

  if (!keyValues) {
    throw new INSTANCE_WATCH_NO_WRITE_KEY({
      messageValues: [schema.id, key ? `"${key.name}"` : "(none defined)"],
    });
  }

  return { key, keyValues };
}

/**
 * Formats key values for display. The SDK has no equivalent: its toString()
 * dumps the schema tree and ignores keys.
 *
 * To explore: sdk.XtkCaster.asString => "xtk:sql|4521" "xtk:javascript|New|cus"
 *
 * @param {Array<{attributeName: string, value: string}>} keyValues - Name and value of each key attribute
 * @returns {string} "DM123" for a single field, "cus:New" for name + namespace, "a, b" otherwise
 */
export function formatKeyValues(keyValues) {
  const values = keyValues.map(({ value }) => value);

  if (keyValues.length === 1) {
    return values[0];
  }

  // "namespace:name" is how Adobe Campaign names these entities everywhere else
  if (keyValues.length === 2) {
    const byName = Object.fromEntries(
      keyValues.map(({ attributeName, value }) => [attributeName, value]),
    );
    if (byName.name && byName.namespace) {
      return `${byName.namespace}:${byName.name}`;
    }
  }

  return values.join(", ");
}
