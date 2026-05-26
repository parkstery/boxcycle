import { useEffect, useState } from "react";
import type { ActivityWorldMapDot } from "./activityWorldLod";
import { ACTIVITY_TRACE_LIVE_STRENGTH } from "./activityWorldTraceStyle";
import {
  fetchPublicPublicationPresencesDetailed,
  PUBLICATION_PRESENCE_POLL_MS,
} from "./firestorePublicationPresence";
import type { LngLat } from "./geo";

/** 260527 Map 표현 계층 디버그 Phase — `VITE_MAP_DEBUG_PHASE` (DEV 미설정 시 A) */
export type MapDebugPhase = "A" | "B" | "C";

export const MAP_DEBUG_PHASE_A_LNGLAT: LngLat = [127.035, 37.505];

export function getMapDebugPhase(): MapDebugPhase | null {
  const raw = import.meta.env.VITE_MAP_DEBUG_PHASE?.trim().toUpperCase();
  if (raw === "A" || raw === "B" || raw === "C") return raw;
  if (import.meta.env.DEV) return "A";
  return null;
}

export function isMapDebugPhaseA(): boolean {
  return getMapDebugPhase() === "A";
}

export function isMapDebugPhaseB(): boolean {
  return getMapDebugPhase() === "B";
}

export function isMapDebugPhaseC(): boolean {
  return getMapDebugPhase() === "C";
}

/** Phase A–C: trail·global·publication poll 등 world 변수 제거 */
export function shouldSkipLiveOverlaysOnMap(): boolean {
  const p = getMapDebugPhase();
  return p === "A" || p === "B" || p === "C";
}

/** 260527 §5 — Phase A·B 에서 moveToTop 금지 */
export function shouldMoveActivityWorldLayersToTop(): boolean {
  const p = getMapDebugPhase();
  if (p === "A" || p === "B") return false;
  if (p === "C") return true;
  return true;
}

/** Phase D 안정화 — raw dot 직접 MapView (LOD OFF) */
export function shouldSkipActivityWorldLod(): boolean {
  return import.meta.env.VITE_MAP_DEBUG_SKIP_LOD === "true";
}

export function shouldDisablePublicationOverlayHooks(): boolean {
  return shouldSkipLiveOverlaysOnMap();
}

export function buildMapDebugPhaseAHardcodedDot(): ActivityWorldMapDot {
  return {
    courseId: "debug-hardcoded",
    lngLat: MAP_DEBUG_PHASE_A_LNGLAT,
    pulseLevel: 1,
    kind: "pulse",
    traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
  };
}

export type MapDebugPhaseBMeta = {
  rowCount: number;
  fetchError: string | null;
};

/** Phase B — Firestore public presence 첫 1점 (B1) */
export function useMapDebugPhaseBPulseDot(enabled: boolean): {
  dot: ActivityWorldMapDot | null;
  meta: MapDebugPhaseBMeta;
} {
  const [dot, setDot] = useState<ActivityWorldMapDot | null>(null);
  const [meta, setMeta] = useState<MapDebugPhaseBMeta>({ rowCount: 0, fetchError: null });

  useEffect(() => {
    if (!enabled) {
      setDot(null);
      setMeta({ rowCount: 0, fetchError: null });
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const { rows, activeQueryError, closedQueryError } =
          await fetchPublicPublicationPresencesDetailed();
        if (cancelled) return;
        const fetchError = activeQueryError ?? closedQueryError ?? null;
        if (fetchError) {
          console.warn("[MapDebug:B] fetch", { activeQueryError, closedQueryError });
        }
        const withPoint = rows.find((r) => r.representativePoint);
        setMeta({ rowCount: rows.length, fetchError });
        if (withPoint?.representativePoint) {
          setDot({
            courseId: withPoint.publicationId,
            lngLat: withPoint.representativePoint,
            pulseLevel: 1,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          });
        } else {
          setDot(null);
          if (rows.length === 0) {
            console.warn("[MapDebug:B] rowCount: 0 — publication presence 없음");
          } else {
            console.warn("[MapDebug:B] rowCount > 0 but representativePoint 없음", {
              rowCount: rows.length,
            });
          }
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[MapDebug:B] fetch failed", e);
        setMeta({ rowCount: 0, fetchError: msg });
        setDot(null);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), PUBLICATION_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { dot, meta };
}
