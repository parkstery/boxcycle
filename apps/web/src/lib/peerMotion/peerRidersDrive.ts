import type { LineStringGeometry, LngLat } from "../geo/geo";
import { lineStringLengthMeters } from "../geo/geo";
import { getPeerMotionRegistry, type PeerMotionRegistry } from "./index";
import { getPeerSyncSelfDistM } from "./peerSyncDebug";

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
  routeLenMOf: () => number,
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
    `[peerSync] t=${nowMs} self=${self} routeLen=${Math.round(routeLenMOf())} | ${parts.join(" || ")}`,
  );
}

export function stepPeerDriveAndBuildGeoJson(
  _sim: unknown,
  dtSec: number,
  _getBearing: (a: LngLat, b: LngLat) => number,
  routeGeometry: LineStringGeometry | null = null,
  nowMs = Date.now(),
  opts?: {
    /**
     * 표시용 좌표·방향을 만들지. 기본 true.
     *
     * 2026-09-27 — 호출부가 **결과를 버리면서도 계산은 다 시켰다**
     * (`showPeerSprites ? peerFc : EMPTY`). 낮은 줌에서 동행을 안 그리는데도 경로 위
     * 좌표·방향 샘플링이 사람 수만큼 돌았다. 게이트를 계산 **앞**으로 옮긴다.
     *
     * ⚠️ 위치 적분(`step`)은 **언제나** 돈다. 멈추면 다시 켤 때 동행이 제자리로 훅 뛴다.
     * 건너뛰는 것은 **그릴 때만 필요한 것**뿐이다.
     */
    buildFeatures?: boolean;
  },
): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; phaseRev: number; hdg: number };
  }>;
} {
  const registry = getPeerMotionRegistry();
  registry.pruneInactive(nowMs);
  registry.step(dtSec, routeGeometry, nowMs);
  // 길이는 **DEV 로그가 실제로 찍을 때만** 잰다 — 인자로 넘기면 운영에서도 매 프레임 O(n) 이 돈다.
  peerDriveDevLog(registry, nowMs, () => (routeGeometry ? lineStringLengthMeters(routeGeometry) : 0));
  if (opts?.buildFeatures === false) return { type: "FeatureCollection", features: [] };
  const features = registry.buildRenderFeatures(routeGeometry).map((f) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: f.lngLat },
    properties: { id: f.id, label: f.label, phaseRev: f.phaseRev, hdg: f.hdg },
  }));
  return { type: "FeatureCollection", features };
}
