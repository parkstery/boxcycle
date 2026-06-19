import type { LineStringGeometry, LngLat } from "./geo";
import {
  getDistanceMeters,
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  interpolatePoint,
  lineStringLengthMeters,
} from "./geo";
import { progressRatioToRouteDistanceMeters } from "./liveLocationSnapshot";
import { TRAIL_LIVE_PROGRESS_MAX_WRITE_MS } from "./rideSyncPolicy";
import { estimateCrankRpmFromSpeedKmh } from "./riderPedalMotion";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "./registerPeerRiderPedalSprites";

export type MapPeerInput = {
  id: string;
  label?: string | null;
  /** 경로 진행률(0~1) — 동일 코스 geometry 가 있으면 lngLat 보다 우선 */
  progressRatio?: number;
  /** progressRatio 없을 때 폴백 */
  lngLat?: LngLat;
};

export type PeerDriveSimState = {
  label: string;
  hdg: number;
  phaseRev: number;
  emaSpeedKmh: number;
  /** 마지막 네트워크 progress 수신 시각 */
  lastTargetMs: number;
  mode: "progress" | "coords";
  pos: LngLat;
  target: LngLat;
  /** 마지막 수신 progress (앵커) */
  targetProgress: number;
  simProgress: number;
  /** progress/s — 최근 샘플 간격에서 EMA 추정 */
  progressPerSec: number;
  routeLenM: number;
  /** Directions 총거리 — publish progressRatio 와 동일 기준 */
  routeCapM: number;
};

const PEER_MAX = 30;
const COORD_LERP_TAU_SEC = 0.34;
const SPEED_EMA = 0.5;
const PROGRESS_VEL_EMA = 0.42;
const PROGRESS_EPS = 1e-6;
/** publish max 간격 + 여유 — 그 이상은 외삽하지 않음 */
const MAX_EXTRAP_SEC = TRAIL_LIVE_PROGRESS_MAX_WRITE_MS / 1000 + 2;
/** 85 km/h 상한에 대응하는 progress/s (routeCap 기준) */
const MAX_PROGRESS_PER_SEC = 0.028;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function progressToSpeedKmh(progressPerSec: number, routeCapM: number): number {
  if (!Number.isFinite(progressPerSec) || routeCapM <= 0) return 0;
  return Math.min(85, Math.max(0, progressPerSec * routeCapM * 3.6));
}

function capProgressPerSec(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_PROGRESS_PER_SEC, v));
}

/** 앵커 + 최근 속도로 표시 progress (프레임마다 재계산) */
function extrapolatePeerProgress(s: PeerDriveSimState, nowMs: number): number {
  const elapsedSec = Math.max(0, (nowMs - s.lastTargetMs) / 1000);
  const leadSec = Math.min(elapsedSec, MAX_EXTRAP_SEC);
  return clamp01(s.targetProgress + s.progressPerSec * leadSec);
}

function resolvePeerMode(
  peer: MapPeerInput,
  routeGeometry: LineStringGeometry | null,
  routeLenM: number,
): "progress" | "coords" {
  if (
    routeGeometry &&
    routeLenM > 0 &&
    typeof peer.progressRatio === "number" &&
    Number.isFinite(peer.progressRatio)
  ) {
    return "progress";
  }
  if (peer.lngLat) return "coords";
  return "coords";
}

function pointOnRouteProgress(
  geometry: LineStringGeometry,
  geoLenM: number,
  progress: number,
  routeCapM: number,
): LngLat | null {
  if (geoLenM <= 0) return null;
  const distM = progressRatioToRouteDistanceMeters(progress, routeCapM, geoLenM);
  return getPointOnRouteByDistance(geometry, distM);
}

function headingOnRouteProgress(
  geometry: LineStringGeometry,
  geoLenM: number,
  progress: number,
  routeCapM: number,
): number {
  const distM = progressRatioToRouteDistanceMeters(progress, routeCapM, geoLenM);
  return headingAtRouteDistanceMeters(geometry, distM) ?? 0;
}

export function mergePeerTargets(
  sim: Map<string, PeerDriveSimState>,
  peers: MapPeerInput[],
  nowMs: number,
  routeGeometry: LineStringGeometry | null = null,
  routeDistanceMeters = 0,
): void {
  const routeLenM = routeGeometry ? lineStringLengthMeters(routeGeometry) : 0;
  const routeCapM = routeDistanceMeters > 0 ? routeDistanceMeters : routeLenM;
  const targets = peers.slice(0, PEER_MAX);
  const seen = new Set<string>();

  for (const t of targets) {
    seen.add(t.id);
    const label = (t.label?.trim() || "동행").slice(0, 48);
    const mode = resolvePeerMode(t, routeGeometry, routeLenM);
    const cur = sim.get(t.id);

    if (!cur) {
      if (mode === "progress" && routeGeometry && routeLenM > 0) {
        const p = clamp01(t.progressRatio!);
        const pos = pointOnRouteProgress(routeGeometry, routeLenM, p, routeCapM) ?? [0, 0];
        sim.set(t.id, {
          label,
          hdg: 0,
          phaseRev: 0,
          emaSpeedKmh: 0,
          lastTargetMs: nowMs,
          mode: "progress",
          pos,
          target: pos,
          targetProgress: p,
          simProgress: p,
          progressPerSec: 0,
          routeLenM,
          routeCapM,
        });
      } else if (t.lngLat) {
        sim.set(t.id, {
          label,
          hdg: 0,
          phaseRev: 0,
          emaSpeedKmh: 0,
          lastTargetMs: nowMs,
          mode: "coords",
          pos: t.lngLat,
          target: t.lngLat,
          targetProgress: 0,
          simProgress: 0,
          progressPerSec: 0,
          routeLenM: 0,
          routeCapM: 0,
        });
      }
      continue;
    }

    cur.label = label;
    cur.routeLenM = routeLenM;
    cur.routeCapM = routeCapM;

    if (mode === "progress" && routeGeometry && routeLenM > 0) {
      cur.mode = "progress";
      const nextP = clamp01(t.progressRatio!);
      const deltaP = nextP - cur.targetProgress;
      if (Math.abs(deltaP) > PROGRESS_EPS) {
        const dtSec = Math.max(0.04, (nowMs - cur.lastTargetMs) / 1000);
        const instPerSec = capProgressPerSec(deltaP / dtSec);
        cur.progressPerSec = capProgressPerSec(
          cur.progressPerSec * (1 - PROGRESS_VEL_EMA) + instPerSec * PROGRESS_VEL_EMA,
        );
        const spd = progressToSpeedKmh(cur.progressPerSec, routeCapM);
        cur.emaSpeedKmh = cur.emaSpeedKmh * (1 - SPEED_EMA) + spd * SPEED_EMA;
        cur.targetProgress = nextP;
        cur.lastTargetMs = nowMs;
        cur.simProgress = extrapolatePeerProgress(cur, nowMs);
      }
      continue;
    }

    if (!t.lngLat) continue;
    cur.mode = "coords";
    const jumped = getDistanceMeters(cur.target, t.lngLat);
    if (jumped > 0.35) {
      const dtSec = Math.max(0.04, (nowMs - cur.lastTargetMs) / 1000);
      const instKmh = (jumped / dtSec) * 3.6;
      if (Number.isFinite(instKmh)) {
        cur.emaSpeedKmh =
          cur.emaSpeedKmh * (1 - SPEED_EMA) + Math.min(85, Math.max(0, instKmh)) * SPEED_EMA;
      }
      cur.target = t.lngLat;
      cur.lastTargetMs = nowMs;
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
    if (s.mode === "progress" && routeGeometry && s.routeLenM > 0) {
      s.simProgress = extrapolatePeerProgress(s, nowMs);
      const pos = pointOnRouteProgress(routeGeometry, s.routeLenM, s.simProgress, s.routeCapM);
      if (pos) {
        s.pos = pos;
        s.target = pos;
        const h = headingOnRouteProgress(routeGeometry, s.routeLenM, s.simProgress, s.routeCapM);
        if (h !== 0 || s.emaSpeedKmh > 0.38) s.hdg = h;
      }
    } else {
      s.pos = interpolatePoint(s.pos, s.target, coordAlpha);
      const dist = getDistanceMeters(s.pos, s.target);
      if (dist > 1.2) {
        s.hdg = getBearing(s.pos, s.target);
      }
    }

    const spd = s.emaSpeedKmh;
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
