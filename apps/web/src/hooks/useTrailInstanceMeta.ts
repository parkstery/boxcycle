import { startTransition, useCallback, useEffect, useState } from "react";
import { fetchTrailInstance, type TrailInstance } from "../lib/firestoreTrailInstance";
import { DEFAULT_TRAIL_ID } from "../lib/firestoreTrail";

export function useTrailInstanceMeta(
  trailId: string,
  enabled: boolean,
  /** Trail 생성·MENU 합류 직후 Firestore fetch 전까지 표시용 */
  seed: TrailInstance | null = null,
) {
  const [meta, setMeta] = useState<TrailInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const reload = useCallback(() => setRefreshNonce((n) => n + 1), []);
  const seededMeta = seed?.id === trailId ? seed : null;
  const resolvedMeta = meta ?? seededMeta;

  useEffect(() => {
    if (!enabled || trailId === DEFAULT_TRAIL_ID) {
      startTransition(() => {
        setMeta(null);
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchTrailInstance(trailId)
      .then((next) => {
        if (!cancelled) startTransition(() => setMeta(next));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trailId, enabled, refreshNonce]);

  return { meta: resolvedMeta, loading, reload };
}
