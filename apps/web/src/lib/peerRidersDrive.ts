import type { LineStringGeometry, LngLat } from "./geo";
import {
  getDistanceMeters,
  getPointOnRouteByDistance,
  interpolatePoint,
  lineStringLengthMeters,
} from "./geo";
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
  lastTargetMs: number;
  mode: "progress" | "coords";
  pos: LngLat;
  target: LngLat;
  targetProgress: number;
  simProgress: number;
  progressPerSec: number;
  routeLenM: number;
};

const PEER_MAX = 30;
const COORD_LERP_TAU_SEC = 0.34;
const PROGRESS_PULL_TAU_SEC = 2.2;
const SPEED_EMA = 0.5;
const PROGRESS_VEL_EMA = 0.35;
const PROGRESS_EPS = 1e-6;
const HEADING_LOOKAHEAD_M = 12;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function progressToSpeedKmh(progressPerSec: number, routeLenM: number): number {
  if (!Number.isFinite(progressPerSec) || routeLenM <= 0) return 0;
  return Math.min(85, Math.max(0, progressPerSec * routeLenM * 3.6));
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
  routeLenM: number,
  progress: number,
): LngLat | null {
  if (routeLenM <= 0) return null;
  return getPointOnRouteByDistance(geometry, clamp01(progress) * routeLenM);
}

function headingOnRouteProgress(
  geometry: LineStringGeometry,
  routeLenM: number,
  progress: number,
  getBearing: (a: LngLat, b: LngLat) => number,
): number {
  const distM = clamp01(progress) * routeLenM;
  const pos = getPointOnRouteByDistance(geometry, distM);
  const ahead = getPointOnRouteByDistance(geometry, Math.min(routeLenM, distM + HEADING_LOOKAHEAD_M));
  if (pos && ahead && getDistanceMeters(pos, ahead) >= 0.4) {
    return getBearing(pos, ahead);
  }
  return 0;
}

export function mergePeerTargets(
  sim: Map<string, PeerDriveSimState>,
  peers: MapPeerInput[],
  nowMs: number,
  routeGeometry: LineStringGeometry | null = null,
): void {
  const routeLenM = routeGeometry ? lineStringLengthMeters(routeGeometry) : 0;
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
        const pos = pointOnRouteProgress(routeGeometry, routeLenM, p) ?? [0, 0];
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
        });
      }
      continue;
    }

    cur.label = label;
    cur.routeLenM = routeLenM;

    if (mode === "progress" && routeGeometry && routeLenM > 0) {
      cur.mode = "progress";
      const nextP = clamp01(t.progressRatio!);
      const deltaP = nextP - cur.targetProgress;
      if (Math.abs(deltaP) > PROGRESS_EPS) {
        const dtSec = Math.max(0.04, (nowMs - cur.lastTargetMs) / 1000);
        const instPerSec = deltaP / dtSec;
        if (Number.isFinite(instPerSec)) {
          cur.progressPerSec =
            cur.progressPerSec * (1 - PROGRESS_VEL_EMA) + instPerSec * PROGRESS_VEL_EMA;
          const spd = progressToSpeedKmh(cur.progressPerSec, routeLenM);
          cur.emaSpeedKmh = cur.emaSpeedKmh * (1 - SPEED_EMA) + spd * SPEED_EMA;
        }
        cur.targetProgress = nextP;
        cur.lastTargetMs = nowMs;
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
  const progressPullAlpha =
    PROGRESS_PULL_TAU_SEC > 0 ? 1 - Math.exp(-clampedDt / PROGRESS_PULL_TAU_SEC) : 1;

  const features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: LngLat };
    properties: { id: string; label: string; pframe: number; hdg: number };
  }> = [];

  for (const [id, s] of sim) {
    if (s.mode === "progress" && routeGeometry && s.routeLenM > 0) {
      if (Math.abs(s.progressPerSec) > PROGRESS_EPS) {
        s.simProgress = clamp01(s.simProgress + s.progressPerSec * clampedDt);
      }
      s.simProgress = clamp01(
        s.simProgress + (s.targetProgress - s.simProgress) * progressPullAlpha * 0.22,
      );
      const pos = pointOnRouteProgress(routeGeometry, s.routeLenM, s.simProgress);
      if (pos) {
        s.pos = pos;
        s.target = pos;
        const h = headingOnRouteProgress(routeGeometry, s.routeLenM, s.simProgress, getBearing);
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
