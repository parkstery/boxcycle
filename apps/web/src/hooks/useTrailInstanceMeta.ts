import { useCallback, useEffect, useState } from "react";
import { fetchTrailInstance, type TrailInstance } from "../lib/trail/repo/firestoreTrailInstance";
import { DEFAULT_TRAIL_ID } from "../lib/trail/repo/firestoreTrail";
import { rememberTrailDisplayNumber } from "../lib/trail/trailDisplayNumberCache";

type ResolvedTrailMeta = { key: string; trailId: string; meta: TrailInstance | null };

export function useTrailInstanceMeta(
  trailId: string,
  enabled: boolean,
  /** Trail 생성·MENU 합류 직후 Firestore fetch 전까지 표시용 */
  seed: TrailInstance | null = null,
) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const reload = useCallback(() => setRefreshNonce((n) => n + 1), []);
  const fetchKey =
    enabled && trailId !== DEFAULT_TRAIL_ID ? `${trailId}:${refreshNonce}` : "";
  const [resolved, setResolved] = useState<ResolvedTrailMeta | null>(null);

  const seededMeta = seed?.id === trailId ? seed : null;
  const loading = Boolean(fetchKey) && resolved?.key !== fetchKey;
  // reload 중에는 같은 Trail 의 직전 meta 를 유지한다(종전 동작 — 이름이 깜빡이지 않게).
  const metaFromFetch = fetchKey && resolved?.trailId === trailId ? resolved.meta : null;
  const resolvedMeta = metaFromFetch ?? seededMeta;

  useEffect(() => {
    if (!fetchKey) return;
    let cancelled = false;
    void fetchTrailInstance(trailId)
      .then((next) => {
        if (!cancelled) {
          if (next) rememberTrailDisplayNumber(next.id, next.displayNumber);
          setResolved({ key: fetchKey, trailId, meta: next });
        }
      })
      .catch(() => {
        // 실패해도 loading 은 끝낸다(종전 finally). 같은 Trail 의 직전 meta 는 유지.
        if (!cancelled) {
          setResolved((prev) => ({
            key: fetchKey,
            trailId,
            meta: prev?.trailId === trailId ? prev.meta : null,
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, trailId]);

  return { meta: resolvedMeta, loading, reload };
}
