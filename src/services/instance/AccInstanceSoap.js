// npm
import chalk from "chalk";
// acc
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const {
  INSTANCE_SOAP_BAD_ARGS,
  INSTANCE_SOAP_ARGS_NOT_ARRAY,
  INSTANCE_SOAP_SDK_CALL_FAILED,
} = codes;
import { withSpinner } from "../../helpers/withSpinner.js";
import { extractSoapReturnValues } from "../../helpers/soapResponse.js";

/**
 * Calls any SOAP method of an instance (`acc instance soap`).
 *
 * @class AccInstanceSoap
 */
class AccInstanceSoap {
  /** @type {AioLogger} */
  logger;

  /** @type {Function} spinner factory, injected for unit tests */
  createSpinner;

  /**
   * @param {AioLogger} logger - Diagnostics logger
   * @param {Client} client - Authenticated ACC client
   * @param {Function} createSpinner - Spinner factory
   */
  constructor(logger, client, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.createSpinner = createSpinner;
  }

  /**
   * Calls a method of any schema through the acc-js-sdk NLWS proxy, for the
   * methods the other `instance` commands do not wrap.
   *
   * Static methods only. The SDK detects them from the schema; a non-static
   * method needs a loaded entity as `this`, which is not built here, so the SDK
   * throws (INSTANCE_SOAP_SDK_CALL_FAILED). Prefer the static *FromId/*ById variants.
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} cliOptions.schema - Schema id, e.g. "nms:delivery"
   * @param {string} cliOptions.method - Method name, PascalCase or camelCase
   * @param {string} [cliOptions.args] - Arguments as a JSON array string, e.g.
   *   '[1234, "<params/>"]'. Empty means no argument.
   * @param {boolean} [cliOptions.json] - Return SimpleJson instead of XML
   * @param {boolean} [cliOptions.raw] - Return the SOAP response as received
   * @returns {Promise<string | object>} The return values as sent by the server
   *   (one per line), the SOAP response with `raw`, or SimpleJson with `json`
   * @throws {INSTANCE_SOAP_BAD_ARGS|INSTANCE_SOAP_ARGS_NOT_ARRAY|INSTANCE_SOAP_SDK_CALL_FAILED}
   */
  async soap(cliOptions) {
    const { schema, method } = cliOptions;

    // Args are a JSON array, spread positionally onto the method. A bare value
    // such as "5" is rejected.
    let args = [];
    if (cliOptions.args !== undefined && cliOptions.args !== "") {
      try {
        args = JSON.parse(cliOptions.args);
      } catch (err) {
        throw new INSTANCE_SOAP_BAD_ARGS({ messageValues: [err.message] });
      }
      if (!Array.isArray(args)) {
        throw new INSTANCE_SOAP_ARGS_NOT_ARRAY();
      }
    }

    const schemaKey = this._toSchemaKey(schema);
    const highlightedLabel = chalk.bgCyan(`${schema}#${method}`);
    const result = await withSpinner(
      this.createSpinner,
      {
        text: `Calling ${highlightedLabel} on the server`,
        succeed: `${highlightedLabel} succeeded`,
        fail: `${highlightedLabel} failed`,
      },
      () =>
        this.adapterCallSoap(
          schemaKey,
          method,
          args,
          cliOptions.json,
          cliOptions.raw,
        ),
    );

    this.logger.verbose(result);
    return result;
  }

  /**
   * Wraps the NLWS proxy call, to mock it in tests and wrap SDK errors. The
   * representation (xml or json) sets how the SDK marshals the parameters.
   *
   * The SDK casts scalars (xsd:dateTime to Date, ...), so in xml mode its result
   * is dropped and the raw response is read through an observer, which skips the
   * internal calls (schema loading).
   *
   * @param {string} schemaKey - camelCase schema key, e.g. "nmsDelivery"
   * @param {string} method - Method name, either casing
   * @param {Array} args - Positional arguments
   * @param {boolean} jsonEnabled - Use the SimpleJson representation
   * @param {boolean} [rawEnabled] - In xml mode, return the whole SOAP response
   * @returns {Promise<string | object>} The return values or the SOAP response (xml), or SimpleJson (json)
   * @throws {CampaignException}
   */
  async adapterCallSoap(schemaKey, method, args, jsonEnabled, rawEnabled) {
    if (jsonEnabled) {
      try {
        return await this.client.NLWS.json[schemaKey][method](...args);
      } catch (err) {
        throw wrapSdkError(err, INSTANCE_SOAP_SDK_CALL_FAILED);
      }
    }

    let output = "";
    const rawResponseObserver = {
      // Use `call.response`: the 2nd argument has the session tokens masked
      onSOAPCallSuccess: (call) => {
        if (!call.internal) {
          output = rawEnabled
            ? call.response
            : extractSoapReturnValues(call.response, call.methodName);
        }
      },
    };
    this.client.registerObserver(rawResponseObserver);
    try {
      await this.client.NLWS.xml[schemaKey][method](...args);
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_SOAP_SDK_CALL_FAILED);
    } finally {
      this.client.unregisterObserver(rawResponseObserver);
    }
    return output;
  }

  /**
   * Maps a schema id to the camelCase key of the NLWS proxy, e.g. "nms:delivery"
   * to "nmsDelivery". Inverse of the SDK's Util.schemaIdFromNamespace.
   *
   * @param {string} schema - Schema id ("namespace:entity")
   * @returns {string} The proxy key
   */
  _toSchemaKey(schema) {
    const [ns, entity] = schema.split(":");
    if (!entity) return schema; // already a key (or malformed): pass through
    return ns + entity.charAt(0).toUpperCase() + entity.slice(1);
  }
}

export default AccInstanceSoap;
