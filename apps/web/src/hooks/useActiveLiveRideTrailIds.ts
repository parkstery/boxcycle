import { startTransition, useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import { subscribeTrailIdsWithActiveLiveRides } from "../lib/firestoreTrailLivePublicationRides";

/** `livePublicationRides` collection group — 지금 주행 중인 Trail id 목록 */
export function useActiveLiveRideTrailIds(opts: { enabled: boolean }) {
  const [trailIds, setTrailIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opts.enabled) {
      startTransition(() => {
        setTrailIds([]);
        setError(null);
      });
      return;
    }

    startTransition(() => setError(null));
    const unsub = subscribeTrailIdsWithActiveLiveRides(
      (ids) => {
        startTransition(() => {
          setTrailIds(ids);
          setError(null);
        });
      },
      (err: FirestoreError) => {
        startTransition(() => setError(err.message));
      },
    );

    return () => unsub();
  }, [opts.enabled]);

  return { trailIds, error };
}
