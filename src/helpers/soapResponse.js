import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;

/**
 * Reads the return values of a SOAP response as the server sent them. The SDK
 * casts scalars (xsd:dateTime to Date, xsd:int to number, ...), which can
 * alter the value; reading the raw envelope keeps it as is.
 *
 * Each return value is one line: the XML of its child element for ns:Element
 * and ns:Document values, its text for scalars.
 *
 * @param {string} responseXml the SOAP envelope received from the server
 * @param {string} methodName the called method, e.g. "GetServerTime"
 * @returns {string} the return values joined by a line break, empty when the method returns nothing
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
