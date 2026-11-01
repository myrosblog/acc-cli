// npm
import { expect } from "chai";
// acc
import { extractSoapReturnValues } from "../../../src/helpers/soapResponse.js";

const envelope = (methodName, returnValues) =>
  `<?xml version='1.0'?><SOAP-ENV:Envelope xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:SOAP-ENV='http://schemas.xmlsoap.org/soap/envelope/'><SOAP-ENV:Body><${methodName}Response xmlns='urn:xtk:session'>${returnValues}</${methodName}Response></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

describe("soapResponse", () => {
  describe("extractSoapReturnValues", () => {
    it("returns a dateTime exactly as sent, without the SDK Date cast", () => {
      const xml = envelope(
        "GetServerTime",
        "<ptmServerTime xsi:type='xsd:dateTime'>2026-10-22T20:58:12Z</ptmServerTime>",
      );
      expect(extractSoapReturnValues(xml, "GetServerTime")).to.equal(
        "2026-10-22T20:58:12Z",
      );
    });

    it("keeps a date and a number as sent", () => {
      const xml = envelope(
        "Mixed",
        "<d xsi:type='xsd:date'>2026-10-22</d><n xsi:type='xsd:float'>1.50</n>",
      );
      expect(extractSoapReturnValues(xml, "Mixed")).to.equal(
        "2026-10-22\n1.50",
      );
    });

    it("unescapes text values", () => {
      const xml = envelope(
        "GetOption",
        "<v xsi:type='xsd:string'>a &lt; b</v>",
      );
      expect(extractSoapReturnValues(xml, "GetOption")).to.equal("a < b");
    });

    it("returns the XML of the child element for ns:Element values", () => {
      const xml = envelope(
        "BuildPreviewFromId",
        "<preview xsi:type='ns:Element'><preview subject='Hello'/></preview>",
      );
      expect(extractSoapReturnValues(xml, "BuildPreviewFromId")).to.contain(
        'subject="Hello"',
      );
    });

    it("joins multiple return values with a line break", () => {
      const xml = envelope(
        "BuildPreviewFromId",
        "<a xsi:type='ns:Element'><preview/></a><b xsi:type='xsd:string'>tail</b>",
      );
      const [first, second] = extractSoapReturnValues(
        xml,
        "BuildPreviewFromId",
      ).split("\n");
      expect(first).to.contain("<preview");
      expect(second).to.equal("tail");
    });

    it("returns an empty string for a method without return value", () => {
      expect(extractSoapReturnValues(envelope("Ping", ""), "Ping")).to.equal(
        "",
      );
    });

    it("returns an empty string when the response of the method is absent", () => {
      const xml = envelope("Other", "<v xsi:type='xsd:string'>x</v>");
      expect(extractSoapReturnValues(xml, "Ping")).to.equal("");
    });
  });
});
