import { expect } from "chai";
import sinon from "sinon";
import {
  createNoopSpinner,
  withSpinner,
} from "../../../src/helpers/withSpinner.js";

describe("withSpinner module", () => {
  // Records the calls, unlike test/helpers.js makeSpinner which discards them
  const makeRecordingSpinner = () => {
    const spinner = {
      start: sinon.stub(),
      succeed: sinon.spy(),
      fail: sinon.spy(),
    };
    spinner.start.returns(spinner);
    return spinner;
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("withSpinner", () => {
    it("starts the spinner with the text, settles it with the succeed label and returns the result", async () => {
      const spinner = makeRecordingSpinner();
      const createSpinner = sinon.stub().returns(spinner);

      const result = await withSpinner(
        createSpinner,
        { text: "Running", succeed: "Done", fail: "Broken" },
        async () => 42,
      );

      expect(result).to.equal(42);
      expect(createSpinner).to.have.been.calledOnceWithExactly("Running");
      expect(spinner.start).to.have.been.calledOnce;
      expect(spinner.succeed).to.have.been.calledOnceWithExactly("Done");
      expect(spinner.fail).not.to.have.been.called;
    });

    it("settles with the fail label and rethrows the same error", async () => {
      const spinner = makeRecordingSpinner();
      const error = new Error("boom");

      await expect(
        withSpinner(
          () => spinner,
          { text: "Running", succeed: "Done", fail: "Broken" },
          async () => {
            throw error;
          },
        ),
      ).to.be.rejectedWith(error);

      expect(spinner.fail).to.have.been.calledOnceWithExactly("Broken");
      expect(spinner.succeed).not.to.have.been.called;
    });

    it("reuses the text for the succeed and fail labels when they are omitted", async () => {
      const okSpinner = makeRecordingSpinner();
      await withSpinner(
        () => okSpinner,
        { text: "Stage" },
        async () => {},
      );
      expect(okSpinner.succeed).to.have.been.calledOnceWithExactly("Stage");

      const koSpinner = makeRecordingSpinner();
      await expect(
        withSpinner(
          () => koSpinner,
          { text: "Stage" },
          async () => {
            throw new Error("boom");
          },
        ),
      ).to.be.rejected;
      expect(koSpinner.fail).to.have.been.calledOnceWithExactly("Stage");
    });

    it("waits for the task before settling the spinner", async () => {
      const spinner = makeRecordingSpinner();
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });

      const pending = withSpinner(
        () => spinner,
        { text: "Stage" },
        () => gate,
      );
      await Promise.resolve();
      expect(spinner.succeed).not.to.have.been.called;

      release();
      await pending;
      expect(spinner.succeed).to.have.been.calledOnce;
    });

    it("settles the spinner when the task throws synchronously", async () => {
      const spinner = makeRecordingSpinner();

      await expect(
        withSpinner(
          () => spinner,
          { text: "Stage" },
          () => {
            throw new Error("sync boom");
          },
        ),
      ).to.be.rejectedWith("sync boom");

      expect(spinner.fail).to.have.been.calledOnceWithExactly("Stage");
    });
  });

  describe("createNoopSpinner", () => {
    it("returns a spinner whose start() is chainable and whose methods do nothing", () => {
      const spinner = createNoopSpinner();

      expect(spinner.start()).to.equal(spinner);
      expect(() => {
        spinner.succeed("ok");
        spinner.warn("careful");
        spinner.fail("ko");
      }).not.to.throw();
    });

    it("can be handed to withSpinner as the spinner factory", async () => {
      const result = await withSpinner(
        createNoopSpinner,
        { text: "Stage" },
        async () => "value",
      );

      expect(result).to.equal("value");
    });
  });
});
