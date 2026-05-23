import { startTransition, useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import { subscribeOpenTrailListings } from "../lib/firestoreOpenTrailListings";
import type { TrailInstance } from "../lib/firestoreTrailInstance";

/**
 * Trailhead 공개 Trail 목록 — `openTrailListings` onSnapshot (polling 없음).
 * loading 은 구독 최초 1회만 true.
 */
export function useOpenTrails(opts: { enabled: boolean }) {
  const [rows, setRows] = useState<TrailInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opts.enabled) {
      startTransition(() => {
        setRows([]);
        setError(null);
        setLoading(false);
      });
      return;
    }

    let firstSnapshot = true;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    const unsub = subscribeOpenTrailListings(
      (next) => {
        startTransition(() => {
          setRows(next);
          setError(null);
          if (firstSnapshot) {
            setLoading(false);
            firstSnapshot = false;
          }
        });
      },
      (err: FirestoreError) => {
        startTransition(() => {
          setError(err.message);
          if (firstSnapshot) {
            setLoading(false);
            firstSnapshot = false;
          }
        });
      },
    );

    return () => {
      unsub();
    };
  }, [opts.enabled]);

  return { rows, loading, error };
}
