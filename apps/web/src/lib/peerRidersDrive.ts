import type { LineStringGeometry, LngLat } from "./geo";
import {
  getDistanceMeters,
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  interpolatePoint,
  lineStringLengthMeters,
} from "./geo";
import { progressRatioToRouteDistanceMeters } from "./liveLocationSnapshot";
import { PEER_EXTRAP_DEFAULT_SPEED_KMH } from "./rideSyncPolicy";
import { estimateCrankRpmFromSpeedKmh } from "./riderPedalMotion";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "./registerPeerRiderPedalSprites";

export type MapPeerInput = {
  id: string;
  label?: string | null;
  /** geometry 위 주행 거리(m) — 우선 */
  distMeters?: number | null;
  /** Firestore lastSeenAt ms — 외삽 기준 시각 */
  sampleAtMs?: number | null;
  /** distMeters 없을 때 폴백 */
  progressRatio?: number;
  /** progress·dist 모두 없을 때 폴백 */
  lngLat?: LngLat;
};

export type PeerDriveSimState = {
  label: string;
  hdg: number;
  phaseRev: number;
  emaSpeedKmh: number;
  mode: "route" | "coords";
  pos: LngLat;
  target: LngLat;
  /** 마지막 수신 거리 앵커(m) */
  anchorDistM: number;
  /** 앵커 수신 시각 — 서버 lastSeenAt 우선 */
  sampleAtMs: number;
  /** m/s — 샘플 간 EMA */
  speedMps: number;
  routeLenM: number;
};

const PEER_MAX = 30;
const COORD_LERP_TAU_SEC = 0.34;
const SPEED_EMA = 0.5;
const SPEED_MPS_EMA = 0.42;
const DIST_EPS_M = 0.25;
const DEFAULT_SPEED_MPS = PEER_EXTRAP_DEFAULT_SPEED_KMH / 3.6;
const MAX_SPEED_MPS = 85 / 3.6;

function clampDist(distM: number, routeLenM: number): number {
  if (!Number.isFinite(distM)) return 0;
  if (routeLenM <= 0) return Math.max(0, distM);
  return Math.max(0, Math.min(routeLenM, distM));
}

function capSpeedMps(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_SPEED_MPS;
  return Math.max(0, Math.min(MAX_SPEED_MPS, v));
}

function resolvePeerDistM(peer: MapPeerInput, routeLenM: number): number | null {
  if (typeof peer.distMeters === "number" && Number.isFinite(peer.distMeters)) {
    return clampDist(peer.distMeters, routeLenM);
  }
  if (
    routeLenM > 0 &&
    typeof peer.progressRatio === "number" &&
    Number.isFinite(peer.progressRatio)
  ) {
    return clampDist(progressRatioToRouteDistanceMeters(peer.progressRatio, routeLenM), routeLenM);
  }
  return null;
}

function resolvePeerMode(
  peer: MapPeerInput,
  routeGeometry: LineStringGeometry | null,
  routeLenM: number,
): "route" | "coords" {
  if (routeGeometry && routeLenM > 0 && resolvePeerDistM(peer, routeLenM) != null) {
    return "route";
  }
  if (peer.lngLat) return "coords";
  return "coords";
}

function pointOnRouteDistM(geometry: LineStringGeometry, distM: number): LngLat | null {
  return getPointOnRouteByDistance(geometry, distM);
}

function headingOnRouteDistM(geometry: LineStringGeometry, distM: number): number {
  return headingAtRouteDistanceMeters(geometry, distM) ?? 0;
}

function peerExtrapSpeedMps(s: PeerDriveSimState): number {
  return s.speedMps > 0.02 ? s.speedMps : DEFAULT_SPEED_MPS;
}

/**
 * 앵커 + 속도로 표시 거리(m).
 * publish 간격(최대 ~8s) 동안 rAF 와 동일하게 전진 — 상한 없음(stale peer 는 presence 구독에서 제거).
 */
function extrapolatePeerDistM(s: PeerDriveSimState, nowMs: number): number {
  const elapsedSec = Math.max(0, (nowMs - s.sampleAtMs) / 1000);
  return clampDist(s.anchorDistM + peerExtrapSpeedMps(s) * elapsedSec, s.routeLenM);
}

export function mergePeerTargets(
  sim: Map<string, PeerDriveSimState>,
  peers: MapPeerInput[],
  nowMs: number,
  routeGeometry: LineStringGeometry | null = null,
  _routeDistanceMeters = 0,
): void {
  const routeLenM = routeGeometry ? lineStringLengthMeters(routeGeometry) : 0;
  const targets = peers.slice(0, PEER_MAX);
  const seen = new Set<string>();

  for (const t of targets) {
    seen.add(t.id);
    const label = (t.label?.trim() || "동행").slice(0, 48);
    const mode = resolvePeerMode(t, routeGeometry, routeLenM);
    const cur = sim.get(t.id);
    const sampleAtMs =
      typeof t.sampleAtMs === "number" && Number.isFinite(t.sampleAtMs) && t.sampleAtMs > 0
        ? t.sampleAtMs
        : nowMs;

    if (!cur) {
      if (mode === "route" && routeGeometry && routeLenM > 0) {
        const distM = resolvePeerDistM(t, routeLenM)!;
        const pos = pointOnRouteDistM(routeGeometry, distM) ?? [0, 0];
        sim.set(t.id, {
          label,
          hdg: 0,
          phaseRev: 0,
          emaSpeedKmh: PEER_EXTRAP_DEFAULT_SPEED_KMH * 0.5,
          mode: "route",
          pos,
          target: pos,
          anchorDistM: distM,
          sampleAtMs,
          speedMps: DEFAULT_SPEED_MPS,
          routeLenM,
        });
      } else if (t.lngLat) {
        sim.set(t.id, {
          label,
          hdg: 0,
          phaseRev: 0,
          emaSpeedKmh: 0,
          mode: "coords",
          pos: t.lngLat,
          target: t.lngLat,
          anchorDistM: 0,
          sampleAtMs,
          speedMps: 0,
          routeLenM: 0,
        });
      }
      continue;
    }

    cur.label = label;
    cur.routeLenM = routeLenM;

    if (mode === "route" && routeGeometry && routeLenM > 0) {
      cur.mode = "route";
      const nextDistM = resolvePeerDistM(t, routeLenM)!;
      const deltaM = nextDistM - cur.anchorDistM;
      if (Math.abs(deltaM) > DIST_EPS_M) {
        const dtSec = Math.max(0.04, (sampleAtMs - cur.sampleAtMs) / 1000);
        const instMps = capSpeedMps(deltaM / dtSec);
        cur.speedMps = capSpeedMps(cur.speedMps * (1 - SPEED_MPS_EMA) + instMps * SPEED_MPS_EMA);
        const spdKmh = cur.speedMps * 3.6;
        cur.emaSpeedKmh = cur.emaSpeedKmh * (1 - SPEED_EMA) + spdKmh * SPEED_EMA;
        cur.anchorDistM = nextDistM;
        cur.sampleAtMs = sampleAtMs;
      }
      /* distMeters·lastSeenAt 만 갱신된 경우 sampleAtMs 를 리셋하지 않음 — 외삽 시계 유지 */
      continue;
    }

    if (!t.lngLat) continue;
    cur.mode = "coords";
    const jumped = getDistanceMeters(cur.target, t.lngLat);
    if (jumped > 0.35) {
      const dtSec = Math.max(0.04, (nowMs - cur.sampleAtMs) / 1000);
      const instKmh = (jumped / dtSec) * 3.6;
      if (Number.isFinite(instKmh)) {
        cur.emaSpeedKmh =
          cur.emaSpeedKmh * (1 - SPEED_EMA) + Math.min(85, Math.max(0, instKmh)) * SPEED_EMA;
      }
      cur.target = t.lngLat;
      cur.sampleAtMs = nowMs;
    }
  }

  for (const id of [...sim.keys()]) {
    if (!seen.has(id)) sim.delete(id);
  }
}

export function stepPeerDriveAndBuildGeoJson(
  sim: Map<string, PeerDriveSimState>,
  dtSec: number,
  getBearing: (a: LngLat, b: LngLat) => number,
  routeGeometry: LineStringGeometry | null = null,
  nowMs = performance.now(),
): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; pframe: number; hdg: number };
  }>;
} {
  const clampedDt = Math.min(0.12, Math.max(0, dtSec));
  const coordAlpha =
    COORD_LERP_TAU_SEC > 0 ? 1 - Math.exp(-clampedDt / COORD_LERP_TAU_SEC) : 1;

  const features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; pframe: number; hdg: number };
  }> = [];

  for (const [id, s] of sim) {
    if (s.mode === "route" && routeGeometry && s.routeLenM > 0) {
      const distM = extrapolatePeerDistM(s, nowMs);
      const pos = pointOnRouteDistM(routeGeometry, distM);
      if (pos) {
        s.pos = pos;
        s.target = pos;
        const h = headingOnRouteDistM(routeGeometry, distM);
        if (h !== 0 || s.emaSpeedKmh > 0.38) s.hdg = h;
      }
    } else {
      s.pos = interpolatePoint(s.pos, s.target, coordAlpha);
      const dist = getDistanceMeters(s.pos, s.target);
      if (dist > 1.2) {
        s.hdg = getBearing(s.pos, s.target);
      }
    }

    const spd = s.emaSpeedKmh > 0.38 ? s.emaSpeedKmh : peerExtrapSpeedMps(s) * 3.6;
    if (spd > 0.38) {
      const rpm = estimateCrankRpmFromSpeedKmh(spd);
      s.phaseRev += (rpm / 60) * clampedDt;
    }
    const pframeRaw =
      spd > 0.38
        ? ((Math.floor((s.phaseRev % 1) * PEER_RIDER_PEDAL_FRAME_COUNT) % PEER_RIDER_PEDAL_FRAME_COUNT) +
            PEER_RIDER_PEDAL_FRAME_COUNT) %
          PEER_RIDER_PEDAL_FRAME_COUNT
        : 0;
    const pframe = Number.isFinite(pframeRaw) ? pframeRaw : 0;
    const hdg = Number.isFinite(s.hdg) ? s.hdg : 0;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: s.pos },
      properties: {
        id,
        label: s.label,
        pframe,
        hdg,
      },
    });
  }

  return { type: "FeatureCollection", features };
}
