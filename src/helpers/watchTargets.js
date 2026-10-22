import path from "node:path";
import { minimatch } from "minimatch";

/**
 * A glob pattern of a decomposed file, paired with the schema and xpath that
 * produced it, so a changed file can be traced back to its origin.
 * @typedef {object} WatchTarget
 * @property {string} pattern - glob relative to the watch path, "/" separated
 * @property {object} schemaConfig - the schema config holding the decompose entry
 * @property {string} xpath - the decompose xpath of the entry
 */

/**
 * Filters schemas to only those with a decompose configuration.
 *
 * @param {Array<object>} schemas - schema configs from acc.config.json
 * @returns {Array<object>} Array of schema configs with decompose
 */
export function getDecomposedSchemas(schemas) {
  return schemas.filter(
    (schemaConfig) =>
      schemaConfig.decompose &&
      typeof schemaConfig.decompose === "object" &&
      Object.keys(schemaConfig.decompose).length > 0,
  );
}

/**
 * Converts a filename template from acc.config.json into a glob pattern
 * relative to the watch path.
 *
 * Each placeholder becomes a single "*": attribute values are sanitized before
 * they are substituted, so a placeholder can never expand to more than one path
 * segment.
 *
 * @param {string} template - Filename template with attribute placeholders
 * @returns {string} Glob pattern relative to the watch path
 * @see sanitizeFilenameValue in helpers/filenameTemplate.js
 */
export function templateToGlob(template) {
  // Templates are rooted at the download directory, not at the filesystem root
  const relativeTemplate = template.replace(/^\/+/, "");
  return relativeTemplate.replace(/\{@?[^}]+\}/g, "*");
}

/**
 * Builds the watch targets, one per entry of every decomposed schema.
 *
 * @param {Array<object>} decomposedSchemas - Schemas with decompose config
 * @returns {Array<WatchTarget>} the watch targets
 */
export function buildWatchTargets(decomposedSchemas) {
  const watchTargets = [];

  for (const schemaConfig of decomposedSchemas) {
    for (const [xpath, decomposedFilename] of Object.entries(
      schemaConfig.decompose,
    )) {
      watchTargets.push({
        pattern: templateToGlob(decomposedFilename),
        schemaConfig,
        xpath,
      });
    }
  }

  return watchTargets;
}

/**
 * Normalizes a path to "/" separators, the form used by the glob patterns.
 *
 * @param {string} filePath - path with native separators
 * @returns {string} the same path with "/" separators
 */
export function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

/**
 * Finds the watch targets whose pattern matches a changed file.
 *
 * @param {Array<WatchTarget>} watchTargets - the targets to search
 * @param {string} filePath - Path of the changed file, relative to the watch path
 * @returns {Array<WatchTarget>} the matching targets, in watch order (empty when none)
 */
export function findMatchingTargets(watchTargets, filePath) {
  const posixPath = toPosixPath(filePath);
  return watchTargets.filter((target) => minimatch(posixPath, target.pattern));
}
