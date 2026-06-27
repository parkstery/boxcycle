import type { LineStringGeometry, LngLat } from "./geo";
import { getPeerMotionRegistry, type PeerMotionRegistry } from "./peerMotion";

/** DEV 전용 — peer auth vs display 오차를 1초 간격 콘솔 로그 (구조적 지연 측정) */
let peerDriveDevLogAt = 0;
function peerDriveDevLog(registry: PeerMotionRegistry, nowMs: number): void {
  if (!import.meta.env.DEV) return;
  if (nowMs - peerDriveDevLogAt < 1_000) return;
  const snap = registry.debugSnapshot(nowMs);
  if (snap.length === 0) return;
  peerDriveDevLogAt = nowMs;
  console.debug("[peerSync] render", snap);
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
  peerDriveDevLog(registry, nowMs);
  const features = registry.buildRenderFeatures(routeGeometry).map((f) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: f.lngLat },
    properties: { id: f.id, label: f.label, pframe: f.pframe, hdg: f.hdg },
  }));
  return { type: "FeatureCollection", features };
}
