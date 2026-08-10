import type { LineStringGeometry, LngLat } from "./geo";
import { lineStringLengthMeters } from "./geo";
import { getPeerMotionRegistry, type PeerMotionRegistry } from "./peerMotion";
import { getPeerSyncSelfDistM } from "./peerMotion/peerSyncDebug";

/** DEV 전용 — self distM 과 peer distM 을 한 줄 평문으로 (펼치지 않아도 보이게) */
let peerDriveDevLogAt = 0;
function peerDriveDevLogMs(): number {
  // S1: ?peerSyncLogMs=200 으로 출발·감속 구간 표본을 늘린다. 기본 1s 유지.
  if (typeof location === "undefined") return 1_000;
  const raw = Number(new URLSearchParams(location.search).get("peerSyncLogMs"));
  return Number.isFinite(raw) && raw > 0 ? raw : 1_000;
}
function peerDriveDevLog(
  registry: PeerMotionRegistry,
  nowMs: number,
  routeLenM: number,
): void {
  if (!import.meta.env.DEV) return;
  if (nowMs - peerDriveDevLogAt < peerDriveDevLogMs()) return;
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
  // t=Date.now() 원값 — S1 시각 정렬용 (콘솔 wall-clock 과 별개)
  console.debug(
    `[peerSync] t=${nowMs} self=${self} routeLen=${Math.round(routeLenM)} | ${parts.join(" || ")}`,
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
