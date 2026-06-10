// Module-level promise dedupe for session-stable GETs (tuning overrides,
// conformal table, decay table, market volatility). Multiple consumers across
// client-side navigations share one in-flight/settled promise instead of
// re-fetching. invalidate() lets a mutation (e.g. applying a tuning override)
// bust the cache so the next consumer refetches.

const cache = new Map<string, Promise<unknown>>();

export function fetchOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = loader().catch((e) => {
    // Don't cache failures — next consumer retries.
    cache.delete(key);
    throw e;
  });
  cache.set(key, p);
  return p;
}

export function invalidateFetchOnce(key: string): void {
  cache.delete(key);
}
