/**
 * Published catalog visibility-resume refresh policy (pure).
 * Success TTL gates automatic re-reads; force bypasses; failures never become freshness.
 */

/** Successful catalog result freshness for automatic (visibility) refresh. */
export const PUBLISHED_CATALOG_TTL_MS = 5 * 60_000;

export type PublishedCatalogRefreshDecision = "fetch" | "use_cache";

export type PublishedCatalogRefreshInput = {
  hasCachedResult: boolean;
  lastSuccessAtMs: number | null;
  nowMs: number;
  ttlMs?: number;
  force: boolean;
};

export function decidePublishedCatalogRefresh(
  input: PublishedCatalogRefreshInput,
): PublishedCatalogRefreshDecision {
  if (input.force) return "fetch";
  if (!input.hasCachedResult || input.lastSuccessAtMs == null) return "fetch";
  const ttl = input.ttlMs ?? PUBLISHED_CATALOG_TTL_MS;
  const age = input.nowMs - input.lastSuccessAtMs;
  if (!Number.isFinite(age) || age < 0 || age >= ttl) return "fetch";
  return "use_cache";
}

/** Concurrent automatic refreshes share one in-flight promise. */
export function createInflightDeduper<T>(): {
  isInflight: () => boolean;
  run: (factory: () => Promise<T>) => Promise<T>;
  reset: () => void;
} {
  let inflight: Promise<T> | null = null;
  return {
    isInflight: () => inflight != null,
    run(factory) {
      if (inflight) return inflight;
      const p = Promise.resolve()
        .then(factory)
        .finally(() => {
          if (inflight === p) inflight = null;
        });
      inflight = p;
      return p;
    },
    reset() {
      inflight = null;
    },
  };
}
