import { startTransition, useEffect, useMemo, useState } from "react";
import type { ActivityWorldMapDot } from "../lib/activityWorldLod";
import {
  ACTIVITY_TRACE_LIVE_STRENGTH,
  resolveClosedPresenceOpacity,
} from "../lib/activityWorldTraceStyle";
import {
  fetchPublicPublicationPresences,
  PUBLICATION_PRESENCE_POLL_MS,
  type PublicationPresenceSnapshot,
} from "../lib/firestorePublicationPresence";

export type WorldPublicationPresenceOverlayStats = {
  activeCount: number;
  closedCount: number;
  anchorMissing: number;
};

type UseWorldPublicationPresenceOverlayOpts = {
  enabled: boolean;
  refreshNonce?: number;
};

function presenceToDots(rows: readonly PublicationPresenceSnapshot[]): {
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
  anchorMissing: number;
} {
  const pulseDots: ActivityWorldMapDot[] = [];
  const heatDots: ActivityWorldMapDot[] = [];
  let anchorMissing = 0;

  for (const row of rows) {
    const lngLat = row.representativePoint;
    if (!lngLat) {
      anchorMissing += 1;
      continue;
    }
    const publicationId = row.publicationId;
    if (row.status === "active" && row.activeRiderCount > 0) {
      pulseDots.push({
        courseId: publicationId,
        lngLat,
        pulseLevel: Math.min(3, Math.max(1, row.activeRiderCount)),
        kind: "pulse",
        traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
      });
    } else if (row.status === "closed") {
      heatDots.push({
        courseId: publicationId,
        lngLat,
        pulseLevel: 1,
        kind: "heat",
        traceStrength: resolveClosedPresenceOpacity(row.closedAtMs),
      });
    }
  }

  return { pulseDots, heatDots, anchorMissing };
}

/**
 * World Activity Presence (M1·M2) — `publicationPresence` 저빈도 폴링.
 * 카탈로그 `courseActivity` dot 대신 월드 맵 1차 dot 소스.
 */
export function useWorldPublicationPresenceOverlay(opts: UseWorldPublicationPresenceOverlayOpts): {
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
  presenceByPublicationId: ReadonlyMap<string, PublicationPresenceSnapshot>;
  overlayStats: WorldPublicationPresenceOverlayStats;
} {
  const { enabled, refreshNonce = 0 } = opts;
  const [rows, setRows] = useState<PublicationPresenceSnapshot[]>([]);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => setRows([]));
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const list = await fetchPublicPublicationPresences();
        if (!cancelled) startTransition(() => setRows(list));
      } catch {
        if (!cancelled) startTransition(() => setRows([]));
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), PUBLICATION_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || refreshNonce === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchPublicPublicationPresences();
        if (!cancelled) startTransition(() => setRows(list));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, enabled]);

  const presenceByPublicationId = useMemo(() => {
    const m = new Map<string, PublicationPresenceSnapshot>();
    for (const r of rows) m.set(r.publicationId, r);
    return m;
  }, [rows]);

  const { pulseDots, heatDots, anchorMissing } = useMemo(() => presenceToDots(rows), [rows]);

  const overlayStats = useMemo(
    (): WorldPublicationPresenceOverlayStats => ({
      activeCount: rows.filter((r) => r.status === "active" && r.activeRiderCount > 0).length,
      closedCount: rows.filter((r) => r.status === "closed").length,
      anchorMissing,
    }),
    [rows, anchorMissing],
  );

  return { pulseDots, heatDots, presenceByPublicationId, overlayStats };
}
