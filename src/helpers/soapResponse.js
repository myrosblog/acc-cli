import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;

/**
 * Reads the return values of a SOAP response as sent, skipping the SDK casts
 * (xsd:dateTime to Date, ...) that can alter them. One line per value: the XML
 * of the child element for ns:Element and ns:Document, the text for scalars.
 *
 * @param {string} responseXml the SOAP envelope received from the server
 * @param {string} methodName the called method, e.g. "GetServerTime"
 * @returns {string} the return values joined by line breaks, empty when none
 */
export function extractSoapReturnValues(responseXml, methodName) {
  const envelope = DomUtil.parse(responseXml).documentElement;
  const body = DomUtil.findElement(envelope, "SOAP-ENV:Body");
  const methodResponse = DomUtil.getFirstChildElement(
    body,
    `${methodName}Response`,
  );

  const returnValues = [];
  for (
    let returnValue = DomUtil.getFirstChildElement(methodResponse);
    returnValue;
    returnValue = DomUtil.getNextSiblingElement(returnValue)
  ) {
    const content = DomUtil.getFirstChildElement(returnValue);
    returnValues.push(
      content
        ? DomUtil.toXMLString(content)
        : DomUtil.elementValue(returnValue),
    );
  }
  return returnValues.join("\n");
}
