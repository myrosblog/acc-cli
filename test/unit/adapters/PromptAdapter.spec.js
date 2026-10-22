import { expect } from "chai";
import sinon from "sinon";
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

  // The real prompts need a TTY, so a recording stub receives the config the
  // adapter builds.
  function makeAdapter() {
    const prompts = {
      input: sinon.stub().resolves("typed"),
      password: sinon.stub().resolves("secret"),
      select: sinon.stub().resolves("picked"),
    };
    return { prompts, adapter: new PromptAdapter({}, prompts) };
  }

  describe("input", () => {
    it("should forward the message and the extra options", async () => {
      const { adapter, prompts } = makeAdapter();

      const answer = await adapter.input("Host?", { default: "http://x" });

      expect(answer).to.equal("typed");
      expect(prompts.input).to.have.been.calledOnceWith({
        message: "Host?",
        default: "http://x",
      });
    });
  });

  describe("password", () => {
    it("should mask the input with * by default", async () => {
      const { adapter, prompts } = makeAdapter();

      const answer = await adapter.password("Password?");

      expect(answer).to.equal("secret");
      expect(prompts.password).to.have.been.calledOnceWith({
        message: "Password?",
        mask: "*",
      });
    });

    it("should let the caller override the mask", async () => {
      const { adapter, prompts } = makeAdapter();

      await adapter.password("Password?", { mask: "#" });

      expect(prompts.password).to.have.been.calledOnceWith({
        message: "Password?",
        mask: "#",
      });
    });
  });

  describe("select", () => {
    it("should forward the message, the choices and the extra options", async () => {
      const { adapter, prompts } = makeAdapter();
      const choices = [{ name: "Prod", value: "prod" }];

      const answer = await adapter.select("Alias?", choices, { loop: false });

      expect(answer).to.equal("picked");
      expect(prompts.select).to.have.been.calledOnceWith({
        message: "Alias?",
        choices,
        loop: false,
      });
    });
  });
});
