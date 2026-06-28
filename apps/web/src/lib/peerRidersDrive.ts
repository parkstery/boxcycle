import type { LineStringGeometry, LngLat } from "./geo";
import { lineStringLengthMeters } from "./geo";
import { getPeerMotionRegistry, type PeerMotionRegistry } from "./peerMotion";
import { getPeerSyncSelfDistM } from "./peerMotion/peerSyncDebug";

/** DEV 전용 — self distM 과 peer distM 을 한 줄 평문으로 (펼치지 않아도 보이게) */
let peerDriveDevLogAt = 0;
function peerDriveDevLog(
  registry: PeerMotionRegistry,
  nowMs: number,
  routeLenM: number,
): void {
  if (!import.meta.env.DEV) return;
  if (nowMs - peerDriveDevLogAt < 1_000) return;
  const snap = registry.debugSnapshot(nowMs);
  if (snap.length === 0) return;
  peerDriveDevLogAt = nowMs;
  const self = Math.round(getPeerSyncSelfDistM() * 10) / 10;
  const parts = snap.map(
    (p) =>
      `${p.uid}: disp=${p.displayDistM} newest=${p.newestDistM} gap(newest-self)=${
        Math.round((p.newestDistM - self) * 10) / 10
      } age=${p.newestAgeMs}ms buf=${p.buf} spd=${p.speedMps}`,
  );
  console.debug(
    `[peerSync] self=${self} routeLen=${Math.round(routeLenM)} | ${parts.join(" || ")}`,
  );
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
  registry.step(dtSec, routeGeometry, nowMs);
  peerDriveDevLog(registry, nowMs, routeGeometry ? lineStringLengthMeters(routeGeometry) : 0);
  const features = registry.buildRenderFeatures(routeGeometry).map((f) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: f.lngLat },
    properties: { id: f.id, label: f.label, pframe: f.pframe, hdg: f.hdg },
  }));
  return { type: "FeatureCollection", features };
}
