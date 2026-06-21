import type { LineStringGeometry, LngLat } from "./geo";
import { getPeerMotionRegistry } from "./peerMotion";

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
