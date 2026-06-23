import { startTransition, useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";
import {
  mergeActiveOpenTrailRows,
  scheduleOpenTrailListingRefresh,
  subscribeOpenTrailListings,
} from "../lib/firestoreOpenTrailListings";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../lib/firestoreTrail";
import { countTrailLiveRidersFresh, subscribeTrailIdsWithActiveLiveRides } from "../lib/firestoreTrailLivePublicationRides";
import { fetchTrailInstance, type TrailInstance } from "../lib/firestoreTrailInstance";
import { trailHasConfiguredRoute } from "../lib/trailAccessPolicy";

/**
 * Trailhead MENU — `openTrailListings` + `livePublicationRides` CG (주행 중 Trail만).
 * listing 이 없거나 CF 미동기화여도 CG 기준으로 다른 라이더 Trail 을 표시한다.
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

    let cancelled = false;
    let firstSnapshot = true;
    let listingRows: TrailInstance[] = [];
    let activeTrailIds: string[] = [];
    const enrichedById = new Map<string, TrailInstance>();
    let enrichGen = 0;

    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    const emit = () => {
      if (cancelled) return;
      const fromActive = activeTrailIds
        .map((id) => enrichedById.get(id))
        .filter((t): t is TrailInstance => t != null);
      startTransition(() => {
        setRows(mergeActiveOpenTrailRows(listingRows, fromActive));
        setError(null);
        if (firstSnapshot) {
          setLoading(false);
          firstSnapshot = false;
        }
      });
    };

    const syncEnrichedFromActiveRides = async () => {
      const gen = ++enrichGen;
      for (const id of activeTrailIds) {
        scheduleOpenTrailListingRefresh(id);
      }

      for (const id of [...enrichedById.keys()]) {
        if (!activeTrailIds.includes(id)) enrichedById.delete(id);
      }

      const listedActive = new Set(
        listingRows
          .filter((t) => (t.liveRiderCount ?? 0) > 0)
          .map((t) => sanitizeTrailId(t.id)),
      );
      const toLoad = activeTrailIds.filter(
        (id) => {
          const tid = sanitizeTrailId(id);
          return tid !== DEFAULT_TRAIL_ID && !listedActive.has(tid);
        },
      );

      if (!toLoad.length) {
        emit();
        return;
      }

      const loaded = await Promise.all(
        toLoad.map(async (trailId) => {
          const meta = await fetchTrailInstance(trailId).catch(() => null);
          if (!meta || meta.status !== "open" || meta.visibility !== "open") return null;
          if (!trailHasConfiguredRoute(meta)) return null;
          const liveRiderCount = await countTrailLiveRidersFresh(trailId).catch(() => 0);
          if (liveRiderCount <= 0) return null;
          return { ...meta, liveRiderCount };
        }),
      );

      if (cancelled || gen !== enrichGen) return;
      for (const row of loaded) {
        if (row) enrichedById.set(row.id, row);
      }
      emit();
    };

    const unsubListings = subscribeOpenTrailListings(
      (next) => {
        listingRows = next;
        emit();
        void syncEnrichedFromActiveRides();
      },
      (err: FirestoreError) => {
        if (cancelled) return;
        startTransition(() => {
          setError(err.message);
          if (firstSnapshot) {
            setLoading(false);
            firstSnapshot = false;
          }
        });
      },
    );

    const unsubActive = subscribeTrailIdsWithActiveLiveRides(
      (ids) => {
        activeTrailIds = ids.map(sanitizeTrailId).filter((id) => id !== DEFAULT_TRAIL_ID);
        void syncEnrichedFromActiveRides();
      },
      (err: FirestoreError) => {
        if (cancelled) return;
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
      cancelled = true;
      unsubListings();
      unsubActive();
    };
  }, [opts.enabled]);

  return { rows, loading, error };
}
