// sdk
import accSdk from "@adobe/acc-js-sdk";
const { DomUtil } = accSdk;
import { codes, wrapSdkError } from "../../helpers/AccErrors.js";
const {
  INSTANCE_INFO_SDK_TESTCNX_FAILED,
  INSTANCE_INFO_SDK_SERVERTIME_FAILED,
  INSTANCE_INFO_SDK_CNXINFO_FAILED,
  INSTANCE_INFO_SDK_DUMPSTATE_FAILED,
} = codes;
// acc
import { withSpinner } from "../../helpers/withSpinner.js";

/**
 * Builds the diagnostic report of an ACC instance (`acc instance info`).
 *
 * @class AccInstanceInfo
 */
class AccInstanceInfo {
  /**
   * @type {AioLogger}
   */
  logger;

  /**
   * @type {Function} to create spinner, injected for easier unit testing
   */
  createSpinner;

  /**
   * Creates a new AccInstanceInfo.
   *
   * @param {AioLogger} logger - Logger instance for logging messages
   * @param {Client} client - Authenticated ACC client
   * @param {Function} createSpinner - Factory of the spinner displaying progress
   * @example
   * const instanceInfo = new AccInstanceInfo(logger, client, createSpinner);
   */
  constructor(logger, client, createSpinner) {
    this.logger = logger;
    this.client = client;
    this.createSpinner = createSpinner;
  }

  /**
   * Diagnostic report combining read-only session/monitoring probes:
   *   - xtk:session#TestCnx (reachability ping)
   *   - xtk:session#GetServerTime (server clock)
   *   - xtk:session#GetCnxInfo (active connections + datasource)
   *   - nl:monitoring#DumpCurrentInstanceState (workflows & instance state)
   *
   * Best-effort, "doctor"-style: each probe runs in its own try/catch so one
   * failure doesn't hide the others. The caller gets the rendered report plus
   * the list of failed probes (to set a non-zero exit code).
   *
   * @returns {object} { text: string, errors: Array<Error> } the report and any errors
   */
  async info() {
    // GetServerTime returns a JS Date; the two XML probes return an Element
    // (not a Document), so DomUtil.toXMLString serializes them directly.
    const probes = [
      {
        title: "Connection (xtk:session#TestCnx)",
        run: () => this.adapterTestCnx(),
        render: () => "✅ reachable",
      },
      {
        title: "Server time (xtk:session#GetServerTime)",
        run: () => this.adapterGetServerTime(),
        render: (value) => value?.toISOString?.() ?? String(value),
      },
      {
        title: "Connection info (xtk:session#GetCnxInfo)",
        run: () => this.adapterGetCnxInfo(),
        render: (value) => DomUtil.toXMLString(value),
      },
      {
        title: "Instance state (nl:monitoring#DumpCurrentInstanceState)",
        run: () => this.adapterDumpCurrentInstanceState(),
        render: (value) => DomUtil.toXMLString(value),
      },
    ];

    const sections = [];
    const errors = [];
    for (const probe of probes) {
      try {
        const body = await withSpinner(
          this.createSpinner,
          { text: probe.title },
          async () => probe.render(await probe.run()),
        );
        sections.push(`== ${probe.title} ==\n${body}`);
      } catch (err) {
        errors.push(err);
        sections.push(`== ${probe.title} ==\n⚠️ ${err.message}`);
      }
    }

    const text = sections.join("\n\n");
    this.logger.verbose(text);
    return { text, errors };
  }

  /**
   * Adapter of xtk:session#TestCnx (reachability ping; resolves with no value).
   * @returns {Promise<void>}
   * @throws {CampaignException}
   */
  async adapterTestCnx() {
    try {
      return await this.client.NLWS.xtkSession.testCnx();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_TESTCNX_FAILED);
    }
  }

  /**
   * Adapter of xtk:session#GetServerTime.
   * @returns {Promise<Date>} the server clock
   * @throws {CampaignException}
   */
  async adapterGetServerTime() {
    try {
      return await this.client.NLWS.xtkSession.getServerTime();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_SERVERTIME_FAILED);
    }
  }

  /**
   * Adapter of xtk:session#GetCnxInfo. `.xml` forces the XML representation so
   * the result is returned as a DOM Element.
   * @returns {Promise<Element>} the `<infos>` element
   * @throws {CampaignException}
   */
  async adapterGetCnxInfo() {
    try {
      return await this.client.NLWS.xml.xtkSession.getCnxInfo();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_CNXINFO_FAILED);
    }
  }

  /**
   * Adapter of nl:monitoring#DumpCurrentInstanceState. Heavy call (~7s): the
   * caller must open the connection with a raised `timeout` (the SDK default of
   * 5s is too short). `.xml` returns the `<elemMonitoring>` element.
   * @returns {Promise<Element>} the `<elemMonitoring>` element
   * @throws {CampaignException}
   */
  async adapterDumpCurrentInstanceState() {
    try {
      return await this.client.NLWS.xml.nlMonitoring.dumpCurrentInstanceState();
    } catch (err) {
      throw wrapSdkError(err, INSTANCE_INFO_SDK_DUMPSTATE_FAILED);
    }
  }
}

export default AccInstanceInfo;
