import { expect } from "chai";
import { hideCommand } from "../../../src/helpers/hideCommand.js";

describe("hideCommand", () => {
  class Parent {
    static aliases = ["topic:old"];
    static hiddenAliases = ["topic:older"];
    static description = "Parent description.";
  }

  it("should hide the command", () => {
    expect(hideCommand(Parent).hidden).to.be.true;
  });

  it("should move aliases to hidden aliases, since oclif shows aliases of hidden commands", () => {
    const Hidden = hideCommand(Parent);
    expect(Hidden.aliases).to.deep.equal([]);
    expect(Hidden.hiddenAliases).to.have.members(["topic:old", "topic:older"]);
  });

  it("should accept a parent without aliases", () => {
    class NoAliases {}
    expect(hideCommand(NoAliases).hiddenAliases).to.deep.equal([]);
  });

  it("should keep the parent behavior", () => {
    const Hidden = hideCommand(Parent);
    expect(Hidden.description).to.equal("Parent description.");
    expect(Object.getPrototypeOf(Hidden)).to.equal(Parent);
  });

  it("should not modify the parent", () => {
    hideCommand(Parent);
    expect(Parent.hidden).to.be.undefined;
    expect(Parent.aliases).to.deep.equal(["topic:old"]);
  });
});
