import type { LineStringGeometry, LngLat } from "./geo";
import { progressRatioToRouteDistanceMeters } from "./liveLocationSnapshot";
import { getPeerMotionRegistry } from "./peerMotion";
import type { TrailLiveRidePhase } from "./firestoreTrailLivePublicationRides";

export type MapPeerInput = {
  id: string;
  label?: string | null;
  distMeters?: number | null;
  sampleAtMs?: number | null;
  progressRatio?: number;
  lngLat?: LngLat;
  speedMps?: number | null;
  ridePhase?: TrailLiveRidePhase | null;
  publicationId?: string | null;
};

/** @deprecated R1 — Registry 가 motion 상태를 보유. 호환용 타입 */
export type PeerDriveSimState = never;

/**
 * @deprecated R1 — motion ingest 는 PublicationSharedPresence → PeerMotionRegistry.
 * coords 전용 fallback 만 유지.
 */
export function mergePeerTargets(
  _sim: Map<string, never>,
  peers: MapPeerInput[],
  _nowMs: number,
  _routeGeometry: LineStringGeometry | null = null,
  routeDistanceMeters = 0,
): void {
  const registry = getPeerMotionRegistry();
  for (const t of peers) {
    const pid = t.publicationId?.trim();
    if (!pid) continue;
    let distM: number | null =
      typeof t.distMeters === "number" && Number.isFinite(t.distMeters)
        ? Math.max(0, t.distMeters)
        : null;
    if (distM == null && routeDistanceMeters > 0 && typeof t.progressRatio === "number") {
      distM = progressRatioToRouteDistanceMeters(t.progressRatio, routeDistanceMeters);
    }
    if (distM == null) continue;
    registry.ingest(
      {
        uid: t.id,
        publicationId: pid,
        distM,
        speedMps: typeof t.speedMps === "number" && Number.isFinite(t.speedMps) ? t.speedMps : 0,
        phase: t.ridePhase ?? "live",
        serverAtMs:
          typeof t.sampleAtMs === "number" && Number.isFinite(t.sampleAtMs) ? t.sampleAtMs : 0,
      },
      (t.label?.trim() || "동행").slice(0, 48),
    );
  }
}

export function stepPeerDriveAndBuildGeoJson(
  _sim: unknown,
  dtSec: number,
  _getBearing: (a: LngLat, b: LngLat) => number,
  routeGeometry: LineStringGeometry | null = null,
  nowMs = Date.now(),
): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; pframe: number; hdg: number };
  }>;
} {
  const registry = getPeerMotionRegistry();
  registry.pruneInactive(nowMs);
  registry.step(dtSec, routeGeometry);
  const features = registry.buildRenderFeatures(routeGeometry).map((f) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: f.lngLat },
    properties: { id: f.id, label: f.label, pframe: f.pframe, hdg: f.hdg },
  }));
  return { type: "FeatureCollection", features };
}
