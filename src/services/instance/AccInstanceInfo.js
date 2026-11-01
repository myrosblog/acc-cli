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
 * Builds the diagnostic report of an instance (`acc instance info`).
 *
 * @class AccInstanceInfo
 */
class AccInstanceInfo {
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
   * Builds the report from four read-only probes: xtk:session#TestCnx
   * (reachability), xtk:session#GetServerTime (clock), xtk:session#GetCnxInfo
   * (connections, datasource) and nl:monitoring#DumpCurrentInstanceState
   * (workflows, instance state). Each probe has its own try/catch, so a failure
   * does not hide the others.
   *
   * @returns {{text: string, errors: Array<Error>}} The report and the errors of the failed probes
   */
  async info() {
    // GetServerTime returns a Date, the XML probes an Element that
    // DomUtil.toXMLString serializes directly
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
   * Wraps xtk:session#TestCnx, a reachability ping.
   *
   * @returns {Promise<void>} Resolves with no value when the instance answers
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
   * Wraps xtk:session#GetServerTime.
   *
   * @returns {Promise<Date>} The server clock
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
   * Wraps xtk:session#GetCnxInfo. `.xml` returns a DOM Element.
   *
   * @returns {Promise<Element>} The `<infos>` element
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
   * Wraps nl:monitoring#DumpCurrentInstanceState. It takes about 7 s, above the
   * SDK default timeout of 5 s: connect with a raised `timeout`.
   *
   * @returns {Promise<Element>} The `<elemMonitoring>` element
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
