/**
 * Custom error class for Campaign CLI operations.
 * Extends the standard JavaScript Error class.
 *
 * @class CampaignError
 * @extends Error
 * @classdesc Custom error class for handling ACC-related errors
 *
 * @example
 * throw new CampaignError("Instance already exists");
 *
 * @example
 * try {
 *   await auth.login({ alias: "nonexistent" });
 * } catch (err) {
 *   if (err instanceof CampaignError) {
 *     console.error("Campaign error:", err.message);
 *   }
 * }
 */
class CampaignError extends Error {
  /**
   * Creates a new CampaignError instance.
   *
   * @param {string} [message] - Error message
   * @param {Object} [options] - Error options
   * @param {string} [options.cause] - Underlying cause of the error
   *
   * @example
   * // Simple error
   * throw new CampaignError("Instance not found");
   *
   * @example
   * // Error with cause
   * throw new CampaignError("Login failed", { cause: originalError });
   */
  constructor(message, options) {
    super(message, options);
    this.name = "CampaignError";
  }
}

export default CampaignError;
