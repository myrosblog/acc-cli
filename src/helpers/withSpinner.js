/**
 * Spinner factory with the ora shape that renders nothing, for callers that
 * show no progress. It saves withSpinner() and its callers from null checks.
 *
 * @returns {object} a spinner whose methods do nothing
 */
export function createNoopSpinner() {
  return {
    start() {
      return this;
    },
    succeed() {},
    warn() {},
    fail() {},
  };
}

/**
 * Runs a task under a spinner and settles the spinner with its outcome, so a
 * failure is marked on the step that broke instead of being reported only at
 * the end. The task error is rethrown unchanged.
 *
 * @param {Function} createSpinner - factory (text) => ora spinner
 * @param {object} labels - spinner texts
 * @param {string} labels.text - shown while the task runs
 * @param {string} [labels.succeed] - shown once the task resolved, defaults to `text`
 * @param {string} [labels.fail] - shown once the task threw, defaults to `text`
 * @param {Function} task - async function to run
 * @returns {Promise<*>} whatever the task resolves to
 */
export async function withSpinner(createSpinner, labels, task) {
  const { text, succeed = text, fail = text } = labels;
  const spinner = createSpinner(text).start();
  try {
    const result = await task();
    spinner.succeed(succeed);
    return result;
  } catch (error) {
    spinner.fail(fail);
    throw error;
  }
}
