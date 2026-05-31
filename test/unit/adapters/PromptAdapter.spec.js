import { expect } from "chai";
import PromptAdapter from "../../../src/adapters/PromptAdapter.js";

describe("PromptAdapter", () => {
  describe("isInteractive", () => {
    it("should be true when stdin is a TTY", () => {
      const adapter = new PromptAdapter({ isTTY: true });
      expect(adapter.isInteractive()).to.be.true;
    });

    it("should be false when stdin is not a TTY", () => {
      const adapter = new PromptAdapter({ isTTY: false });
      expect(adapter.isInteractive()).to.be.false;
    });

    it("should be false when isTTY is undefined (piped/CI)", () => {
      const adapter = new PromptAdapter({});
      expect(adapter.isInteractive()).to.be.false;
    });

    it("should be false when stdin is missing", () => {
      const adapter = new PromptAdapter(null);
      expect(adapter.isInteractive()).to.be.false;
    });
  });

  it("should expose the prompt methods", () => {
    const adapter = new PromptAdapter({});
    expect(adapter.input).to.be.a("function");
    expect(adapter.password).to.be.a("function");
  });
});
