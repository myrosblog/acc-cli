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
 * Calls any SOAP method on an ACC instance (`acc instance soap`).
 *
 * @class AccInstanceSoap
 */
class AccInstanceSoap {
  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @type {Function} to create spinner, injected for easier unit testing
   */
  createSpinner;

  /**
   * Creates a new AccInstanceSoap.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {Function} createSpinner - Factory of the spinner displaying progress
   * @example
   * const instanceSoap = new AccInstanceSoap(logger, client, createSpinner);
   */
  constructor(logger, client, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.createSpinner = createSpinner;
  }

  /**
   * Generic SOAP invoker: calls an arbitrary method on any schema via the
   * acc-js-sdk NLWS proxy. The escape hatch behind the curated `instance`
   * commands, reaches any method `instance query`/`instance exec` don't wrap.
   *
   * Scope: static methods only. The SDK auto-detects static/non-static from the
   * schema; a non-static method needs a loaded entity as its `this` param, which
   * this command does not build: the SDK then throws (wrapped as
   * INSTANCE_SOAP_SDK_CALL_FAILED). Prefer the static *FromId/*ById variants.
   *
   * @param {object} cliOptions - Command-line options
   * @param {string} cliOptions.schema - schema id, e.g. "nms:delivery"
   * @param {string} cliOptions.method - method name (PascalCase or camelCase),
   *   e.g. "BuildPreviewFromId"; the SDK resolves either casing
   * @param {string} [cliOptions.args] - method arguments as a JSON array string,
   *   e.g. '[1234, "<params/>"]'. Omitted/empty means no argument.
   * @param {boolean} [cliOptions.json] - when true, return SimpleJson instead of XML
   * @param {boolean} [cliOptions.raw] - when true, return the SOAP response as received
   * @returns {Promise<string | object>} the return values as sent by the server
   *   (one per line), the SOAP response when `raw`, or SimpleJson when `json`
   * @throws {INSTANCE_SOAP_BAD_ARGS|INSTANCE_SOAP_ARGS_NOT_ARRAY|INSTANCE_SOAP_SDK_CALL_FAILED}
   */
  async soap(cliOptions) {
    const { schema, method } = cliOptions;

    // Arguments arrive as a JSON array string and are spread positionally onto
    // the method. A bare value (e.g. "5") is rejected to steer the user to [].
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
   * Adapter of the NLWS proxy dispatch for `soap()`: easier mocking and SDK
   * error wrapping. The representation (xml vs json) drives how the SDK
   * marshals the input parameters.
   *
   * The SDK casts scalars (xsd:dateTime to Date, ...), so in xml mode its result
   * is dropped and the raw response is read through an observer. Internal calls
   * (schema loading) are skipped.
   * @param {string} schemaKey camelCase schema key, e.g. "nmsDelivery"
   * @param {string} method method name (the SDK resolves either casing)
   * @param {Array} args positional arguments
   * @param {boolean} jsonEnabled when true use the SimpleJson representation
   * @param {boolean} [rawEnabled] when true (xml mode) return the whole SOAP response
   * @returns {Promise<string | object>} the return values or the SOAP response (xml), or SimpleJson (json)
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
      // `call.response`, not the 2nd argument: it has session tokens masked.
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
   * Maps a schema id to the camelCase namespace key the NLWS proxy expects,
   * e.g. "nms:delivery" -> "nmsDelivery", "xtk:queryDef" -> "xtkQueryDef".
   * Inverse of the SDK's Util.schemaIdFromNamespace.
   * @param {string} schema schema id ("namespace:entity")
   * @returns {string} the proxy key
   */
  _toSchemaKey(schema) {
    const [ns, entity] = schema.split(":");
    if (!entity) return schema; // already a key (or malformed): pass through
    return ns + entity.charAt(0).toUpperCase() + entity.slice(1);
  }
}

export default AccInstanceSoap;
