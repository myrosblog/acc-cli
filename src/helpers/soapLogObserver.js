/**
 * Maximum number of characters logged per SOAP request/response body.
 *
 * The file transport writes at `silly`, so every SOAP trace lands in acc.log
 * regardless of AIO_LOG_LEVEL, and acc.log is a bounded 1MBx5 rotating buffer.
 * An untruncated multi-MB delivery payload would, in a single line, evict the
 * whole history. Capping keeps thousands of calls within the rotation.
 * @type {number}
 */
export const SOAP_LOG_MAX = 1000;

/**
 * Caps a string to SOAP_LOG_MAX, appending a marker with the dropped length so
 * the trace flags both that it was cut and the actual payload size.
 * @param {string} str
 * @param {number} [max]
 * @returns {string}
 */
export function truncate(str, max = SOAP_LOG_MAX) {
  if (str === null || str === undefined) {
    return str;
  }
  const s = String(str);
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…[+${s.length - max} chars]`;
}

/**
 * Builds an acc-js-sdk observer that forwards SOAP calls to the logger.
 * Bodies (`safeCallData`/`safeCallResponse`) are already secret-redacted by the
 * SDK's Util.trim; here we only cap their length. Requests are trimmed too
 * (writing a delivery is a large request + a large response).
 *
 * @param {AioLogger} logger
 * @returns {{onSOAPCall: Function, onSOAPCallSuccess: Function, onSOAPCallFailure: Function}}
 */
export default function soapLogObserver(logger) {
  return {
    onSOAPCall: (call, safeData) =>
      logger.verbose(
        `SOAP-Request⏫ ${call.urn}#${call.methodName} ${truncate(safeData)}`,
      ),
    onSOAPCallSuccess: (call, safeResponse) =>
      logger.verbose(
        `SOAP-Response⤵️ ${call.urn}#${call.methodName} ${truncate(safeResponse)}`,
      ),
    onSOAPCallFailure: (call, ex) =>
      logger.warn(`SOAP-Error❌ ${call.urn}#${call.methodName} ${ex}`),
  };
}
