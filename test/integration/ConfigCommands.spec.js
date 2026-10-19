import { expect } from "chai";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

// Loads the real oclif configuration: it is the only way to check that the commands of
// this package win over the same ids in @adobe/aio-cli-plugin-config.
describe("config commands", () => {
  it("should show only `config`, `config edit`, `config get` and `config set` of the aio plugin", async () => {
    const oclifConfig = await Config.load({ root: PROJECT_ROOT });
    const visibleIds = oclifConfig.commands
      .filter((command) => command.id.startsWith("config") && !command.hidden)
      .map((command) => command.id);
    expect(visibleIds).to.have.members([
      "config",
      "config:edit",
      "config:get",
      "config:set",
    ]);
  });

  it("should keep the hidden commands and their aliases callable", async () => {
    const oclifConfig = await Config.load({ root: PROJECT_ROOT });
    const hiddenIds = oclifConfig.commands
      .filter((command) => command.id.startsWith("config") && command.hidden)
      .map((command) => command.id);
    expect(hiddenIds).to.have.members([
      "config:clear",
      "config:delete",
      "config:del",
      "config:rm",
      "config:list",
      "config:ls",
    ]);
  });

  it("should not use the plugin usage of `config set`, whose inline comments become the README title", async () => {
    const oclifConfig = await Config.load({ root: PROJECT_ROOT });
    expect(oclifConfig.findCommand("config:set").usage).to.be.undefined;
  });

  it("should list `auth` once, as a topic, and keep the hidden `auth` command callable", async () => {
    const oclifConfig = await Config.load({ root: PROJECT_ROOT });
    const authCommand = oclifConfig.findCommand("auth");
    const authTopic = oclifConfig.topics.find((topic) => topic.name === "auth");
    expect(authCommand.hidden).to.be.true;
    expect(authTopic.hidden).to.not.be.true;
    // The topic text comes from package.json, the command text from Auth: keep them equal
    expect(authTopic.description).to.equal(authCommand.description);
  });
});
