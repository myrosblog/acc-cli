import { input, password, select } from "@inquirer/prompts";

/**
 * Adapter around `@inquirer/prompts` (the same prompt library aio-cli relies on).
 * Encapsulates interactive terminal prompts behind a clean, mockable interface
 * so business services (e.g. AccAuth) can ask the user for missing input
 * without coupling to a specific prompt library, and so tests can stub it.
 *
 * IMPORTANT: callers must guard interactive prompts with
 * {@link PromptAdapter#isInteractive}
 * so that scripted / CI usage (no TTY) never blocks waiting for stdin.
 *
 * @class PromptAdapter
 */
class PromptAdapter {
  /**
   * @param {NodeJS.ReadStream} stdin - input stream, defaults to process.stdin
   * @param {{input: Function, password: Function, select: Function}} prompts - prompt functions, injectable
   *   because the real ones need a TTY
   */
  constructor(stdin = process.stdin, prompts = { input, password, select }) {
    this.stdin = stdin;
    this.prompts = prompts;
  }

  /**
   * Whether the process is attached to an interactive terminal.
   * @returns {boolean} true if stdin is a TTY, false otherwise
   */
  isInteractive() {
    return Boolean(this.stdin && this.stdin.isTTY);
  }

  /**
   * Free-text prompt.
   * @param {string} message text to display to the user
   * @param {object} [opts] extra `@inquirer/input` options
   * @returns {Promise<string>} the user input
   */
  async input(message, opts = {}) {
    return this.prompts.input({ message, ...opts });
  }

  /**
   * Masked password prompt (input is hidden from the terminal and history).
   * @param {string} message text to display to the user
   * @param {object} [opts] extra `@inquirer/password` options
   * @returns {Promise<string>} the user input
   */
  async password(message, opts = {}) {
    return this.prompts.password({ message, mask: "*", ...opts });
  }

  /**
   * Single-choice list prompt.
   * @param {string} message text to display to the user
   * @param {Array<{name: string, value: *}>} choices the list of choices to present
   * @param {object} [opts] extra `@inquirer/select` options
   * @returns {Promise<*>} the selected choice's value
   */
  async select(message, choices, opts = {}) {
    return this.prompts.select({ message, choices, ...opts });
  }
}

export default PromptAdapter;
