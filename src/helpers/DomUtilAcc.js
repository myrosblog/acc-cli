import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import {
  XPath,
  XPathElement,
  DomException,
} from "@adobe/acc-js-sdk/src/domUtil.js";

class DomUtilAcc extends DomUtil {
  static XPATH_ATTR = "@";

  /**
   * @see https://github.com/adobe/acc-js-sdk/blob/v1.1.61/src/domUtil.js#L313
   * @param {XPathElement} xpathElement the XPath element to check
   * @returns {boolean} true if the provided xpathElement is an attribute
   * @throws {DomException} if the provided xpathElement is not an instanceof XPathElement
   */
  static xpathElementIsAttribute(xpathElement) {
    if (!(xpathElement instanceof XPathElement)) {
      throw new DomException(
        `The provided xpathElement ${xpathElement} is not an attribute`,
      );
    }
    return xpathElement.asString()[0] === DomUtilAcc.XPATH_ATTR;
  }

  /**
   * @see https://github.com/adobe/acc-js-sdk/blob/v1.1.61/src/domUtil.js#L324
   * @param {XPathElement} xpathElement the XPath element to get the attribute name from
   * @returns {string} the attribute name (without the leading "@")
   * @throws {DomException} if the provided xpathElement is not an attribute
   */
  static getXpathAttributeName(xpathElement) {
    if (!DomUtilAcc.xpathElementIsAttribute(xpathElement)) {
      throw new DomException(
        `The provided xpathElement ${xpathElement} is not an attribute`,
      );
    }
    return xpathElement.asString().substring(1);
  }

  /**
   * From a start element, get the last element of the xpath.
   * Examples with <service mode="0"><social category="1"/></service>:
   * - xpath: "@mode" => returns <service>
   * - xpath: "social/@category" => returns <social>
   * Edge cases:
   * - Does not work with absolute xpath (starting with "/") => will return start element
   * - Does not work with empty xpath => will return start element
   * Based on the acc-js-sdk XtkSchemaNode.findNode implementation
   * @see https://github.com/adobe/acc-js-sdk/blob/v1.1.61/src/application.js#L834
   * @param {Element} startElement the starting element to traverse from
   * @param {string} xpathStr the xpath string to traverse
   * @returns {Element} the last element of the xpath, or the startElement if the xpath is empty or absolute
   */
  static findLastElement(startElement, xpathStr) {
    const xpath = new XPath(xpathStr);

    let node = startElement;
    if (xpath.isEmpty() || xpath.isAbsolute() || xpath.isSelf()) {
      return startElement;
    }

    // for each xpath chunk
    const elements = xpath.getElements();
    // traverse the DOM
    while (node && elements.length > 0) {
      const element = elements.shift();
      const name = element.asString();

      if (element.isSelf()) {
        // "." - rester sur le même nœud
        continue;
      } else if (element.isParent()) {
        // ".." - remonter au parent
        node = node.parentNode;
      } else if (DomUtilAcc.xpathElementIsAttribute(element)) {
        // Attribut
        break;
      } else {
        // Élément enfant
        node = DomUtil.getFirstChildElement(node, name);
      }
    }

    return node;
  }
}

export default DomUtilAcc;
