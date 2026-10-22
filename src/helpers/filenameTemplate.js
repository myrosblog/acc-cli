import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;

/**
 * Extracts the placeholders of a filename template: the text between braces.
 * @type {RegExp}
 */
const REGEX_TEMPLATE_PLACEHOLDER = /{(.+?)}/g;

/**
 * XPath attribute prefix character
 * @type {string}
 */
const XPATH_ATTRIBUTE_PREFIX = "@";

/**
 * Extracts the placeholder names of a filename template.
 * @param {string} template - filename template with one braced attribute per placeholder
 * @returns {Array<string>} the placeholder names, e.g. ['@namespace', '@name']
 */
export function getTemplateAttributes(template) {
  const matches = template.matchAll(REGEX_TEMPLATE_PLACEHOLDER); // [object RegExp String Iterator]
  return Array.from(matches, (match) => match[1]);
}

/**
 * Sanitizes a single attribute value before it is substituted into a filename
 * template, so untrusted record data cannot escape the download directory.
 * Only the value is sanitized, never the template (which legitimately carries
 * "/" for subfolders).
 * @param {string} value raw attribute value from the record
 * @returns {string} a value safe to use as a filename component
 */
export function sanitizeFilenameValue(value) {
  return (
    String(value)
      .replace(/[/\\]/g, "_") // POSIX + Windows path separators
      // eslint-disable-next-line no-control-regex -- stripping control chars is the purpose here
      .replace(/[\x00-\x1f]/g, "") // NUL + control characters
      .replace(/^\.+$/, (dots) => "_".repeat(dots.length))
  ); // "." / ".." -> "_" / "__"
}

/**
 * Computes the final filename by substituting template placeholders with values from the record.
 * @param {string} template - filename template with braced attribute placeholders
 * @param {Array<string>} attributes - placeholder names to read from the record, see getTemplateAttributes
 * @param {Element} record - the record element
 * @returns {string} The computed filename with placeholders replaced
 */
export function computeFilename(template, attributes, record) {
  let filename = template;
  for (const attribute of attributes) {
    const value = DomUtil.getAttributeAsString(
      record,
      attribute.replace(XPATH_ATTRIBUTE_PREFIX, ""),
    );
    // The template is trusted and may contain "/" for subdirectories. The
    // attribute value comes from the server record and is untrusted, so it must
    // never inject path separators, parent-dir refs or control chars (path
    // traversal). A function replacer is used so "$" patterns in the value are
    // not interpreted by String.replaceAll.
    const safeValue = sanitizeFilenameValue(value);
    filename = filename.replaceAll(`{${attribute}}`, () => safeValue);
  }
  return filename;
}
