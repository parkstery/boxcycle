import { startTransition, useCallback, useEffect, useState } from "react";
import { fetchOpenTrailInstances, type TrailInstance } from "../lib/firestoreTrailInstance";

const OPEN_TRAILS_POLL_MS = 18_000;

export function useOpenTrails(opts: { enabled: boolean; refreshNonce?: number }) {
  const [rows, setRows] = useState<TrailInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!opts.enabled) return;
    setLoading(true);
    void fetchOpenTrailInstances()
      .then((next) => {
        startTransition(() => {
          setRows(next);
          setError(null);
        });
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        startTransition(() => setError(message));
      })
      .finally(() => setLoading(false));
  }, [opts.enabled]);

  useEffect(() => {
    if (!opts.enabled) {
      startTransition(() => {
        setRows([]);
        setError(null);
        setLoading(false);
      });
      return;
    }
    reload();
    const id = window.setInterval(reload, OPEN_TRAILS_POLL_MS);
    return () => window.clearInterval(id);
  }, [opts.enabled, opts.refreshNonce, reload]);

  return { rows, loading, error, reload };
}
