import { expect } from "chai";
import AuthDecode from "../../../src/commands/auth/decode.js";
import AuthInit from "../../../src/commands/auth/init.js";
import AuthIp from "../../../src/commands/auth/ip.js";
import AuthList from "../../../src/commands/auth/list.js";
import AuthLogin from "../../../src/commands/auth/login.js";
import InstanceCheck from "../../../src/commands/instance/check.js";
import InstanceExec from "../../../src/commands/instance/exec.js";
import InstanceInfo from "../../../src/commands/instance/info.js";
import InstancePull from "../../../src/commands/instance/pull.js";
import InstanceQueryDef from "../../../src/commands/instance/queryDef.js";
import InstanceSoap from "../../../src/commands/instance/soap.js";
import InstanceTemplate from "../../../src/commands/instance/template.js";
import InstanceWatch from "../../../src/commands/instance/watch.js";
import MonitorTest from "../../../src/commands/monitor/test.js";

const COMMANDS = [
  AuthDecode,
  AuthInit,
  AuthIp,
  AuthList,
  AuthLogin,
  InstanceCheck,
  InstanceExec,
  InstanceInfo,
  InstancePull,
  InstanceQueryDef,
  InstanceSoap,
  InstanceTemplate,
  InstanceWatch,
  MonitorTest,
];

// `-h` and `-v` are declared as additionalHelpFlags / additionalVersionFlags in package.json
const RESERVED_CHARS = ["h", "v"];

/**
 * Lists the short flag characters of a command, as oclif sees them (baseFlags first, then flags).
 *
 * @param {Function} CommandClass - oclif command class
 * @returns {string[]} Short flag characters, in declaration order
 */
const shortCharsOf = (CommandClass) =>
  Object.values({ ...CommandClass.baseFlags, ...CommandClass.flags })
    .map((flag) => flag.char)
    .filter(Boolean);

describe("Short flag characters", () => {
  COMMANDS.forEach((CommandClass) => {
    describe(CommandClass.name, () => {
      it("should not reuse a short flag character", () => {
        // oclif silently binds a duplicated character to the first flag declared
        const chars = shortCharsOf(CommandClass);
        expect(chars).to.have.members([...new Set(chars)]);
      });

      it("should not use a character reserved for help or version", () => {
        shortCharsOf(CommandClass).forEach((char) =>
          expect(RESERVED_CHARS).to.not.include(char),
        );
      });
    });
  });
});
