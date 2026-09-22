/**
 * Logs a snapshot of acc-js-sdk's internal cache counters for the
 * entity/option/method caches (reads, writes, hits, etc.), for auditability.
 *
 * `Cache._stats` is a private, unexported field: acc-js-sdk has no public
 * getter for it, only a periodic (~5 min) observability event unsuited to
 * acc-cli's short-lived, one-shot commands. This reads the field directly
 * off the already-held `client` instance instead, as a one-time snapshot
 * taken right after login, not a live tracker: most counters will be near
 * zero at that point and are never logged again afterwards.
 *
 * @param {AioLogger} logger the logger to write cache stats to
 * @param {Client} client the acc-js-sdk client returned by sdk.init()
 * @returns {void}
 */
export default function logCacheStats(logger, client) {
  const caches = {
    entityCache: client._entityCache,
    methodCache: client._methodCache,
    optionCache: client._optionCache,
  };
  for (const [name, cache] of Object.entries(caches)) {
    if (!cache?._stats) {
      continue;
    }
    const {
      reads,
      writes,
      removals,
      clears,
      memoryHits,
      storageHits,
      loads,
      saves,
    } = cache._stats;
    logger.verbose(
      `CACHE-Stats📊 ${name} reads=${reads} writes=${writes} removals=${removals} clears=${clears} memoryHits=${memoryHits} storageHits=${storageHits} loads=${loads} saves=${saves}`,
    );
  }
}
