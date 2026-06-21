import type { LineStringGeometry, LngLat } from "./geo";
import {
  getDistanceMeters,
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  interpolatePoint,
  lineStringLengthMeters,
} from "./geo";
import { progressRatioToRouteDistanceMeters } from "./liveLocationSnapshot";
import {
  PEER_DRIVE_SIM_GRACE_MS,
  PEER_LIVE_RIDE_EXTRAP_MAX_MS,
} from "./rideSyncPolicy";
import type { TrailLiveRidePhase } from "./firestoreTrailLivePublicationRides";
import { estimateCrankRpmFromSpeedKmh } from "./riderPedalMotion";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "./registerPeerRiderPedalSprites";

export type MapPeerInput = {
  id: string;
  label?: string | null;
  distMeters?: number | null;
  sampleAtMs?: number | null;
  progressRatio?: number;
  lngLat?: LngLat;
  speedMps?: number | null;
  ridePhase?: TrailLiveRidePhase | null;
};

export type PeerDriveSimState = {
  label: string;
  hdg: number;
  phaseRev: number;
  pedalSpeedKmh: number;
  mode: "route" | "coords";
  pos: LngLat;
  target: LngLat;
  routeLenM: number;
  ridePhase: TrailLiveRidePhase;
  anchorDistM: number;
  anchorAtMs: number;
  liveSpeedMps: number;
  lastServerAtMs: number;
  /** mergePeerTargets 목록에서 마지막으로 본 시각 */
  lastInTargetsAtMs: number;
};

const PEER_MAX = 30;
const COORD_LERP_TAU_SEC = 0.34;
const PEDAL_SPEED_EMA = 0.35;
const DIST_EPS_M = 0.2;
const MAX_SPEED_MPS = 85 / 3.6;
/** 패킷 권위 dist 와 rAF 표시 간 허용 오차(m) — 이내면 연속 유지 */
const ANCHOR_SOFT_CORRECT_M = 3.5;

function clampDist(distM: number, routeLenM: number): number {
  if (!Number.isFinite(distM)) return 0;
  if (routeLenM <= 0) return Math.max(0, distM);
  return Math.max(0, Math.min(routeLenM, distM));
}

function capSpeedMps(v: number): number {
  if (!Number.isFinite(v)) return 0;
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

function resolveLiveSpeedMps(
  publishedMps: number,
  nextDistM: number,
  prevDistM: number,
  serverAtMs: number,
  prevServerAtMs: number,
  fallbackMps: number,
): number {
  if (publishedMps > 0.02) return capSpeedMps(publishedMps);
  if (serverAtMs > prevServerAtMs && prevServerAtMs > 0) {
    const dtSec = (serverAtMs - prevServerAtMs) / 1000;
    if (dtSec > 0.04 && nextDistM >= prevDistM - DIST_EPS_M) {
      return capSpeedMps((nextDistM - prevDistM) / dtSec);
    }
  }
  if (fallbackMps > 0.02) return fallbackMps;
  return 0;
}

function routeDistFromAnchor(s: PeerDriveSimState, routeLenM: number, nowMs: number): number {
  if (s.ridePhase === "completed" || s.ridePhase === "paused") {
    return clampDist(s.anchorDistM, routeLenM);
  }
  if (s.liveSpeedMps <= 0.02) {
    return clampDist(s.anchorDistM, routeLenM);
  }
  const elapsedSec = Math.max(0, (nowMs - s.anchorAtMs) / 1000);
  const maxSec = PEER_LIVE_RIDE_EXTRAP_MAX_MS / 1000;
  const cappedSec = Math.min(elapsedSec, maxSec);
  return clampDist(s.anchorDistM + s.liveSpeedMps * cappedSec, routeLenM);
}

function setPedalSpeed(cur: PeerDriveSimState, speedMps: number): void {
  const capped = capSpeedMps(speedMps);
  const spdKmh = capped * 3.6;
  cur.pedalSpeedKmh = cur.pedalSpeedKmh * (1 - PEDAL_SPEED_EMA) + spdKmh * PEDAL_SPEED_EMA;
}

/** 패킷 도착 — 표시 위치 연속 유지 + 속도 갱신 */
function applyRoutePacket(
  cur: PeerDriveSimState,
  nextDistM: number,
  publishedMps: number,
  serverAtMs: number,
  ridePhase: TrailLiveRidePhase,
): void {
  const nowMs = Date.now();
  const displayed = routeDistFromAnchor(cur, cur.routeLenM, nowMs);
  const speed = resolveLiveSpeedMps(
    publishedMps,
    nextDistM,
    cur.anchorDistM,
    serverAtMs,
    cur.lastServerAtMs,
    cur.liveSpeedMps,
  );
  const err = nextDistM - displayed;

  cur.ridePhase = ridePhase;
  if (speed > 0.02) cur.liveSpeedMps = speed;

  if (Math.abs(err) <= ANCHOR_SOFT_CORRECT_M) {
    cur.anchorDistM = displayed;
  } else {
    cur.anchorDistM = nextDistM;
  }
  cur.anchorAtMs = nowMs;

  if (cur.liveSpeedMps > 0.02) setPedalSpeed(cur, cur.liveSpeedMps);
  if (serverAtMs > 0) cur.lastServerAtMs = serverAtMs;
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
    const ridePhase: TrailLiveRidePhase = t.ridePhase ?? "live";
    const publishedMps =
      typeof t.speedMps === "number" && Number.isFinite(t.speedMps) ? t.speedMps : 0;
    const serverAtMs =
      typeof t.sampleAtMs === "number" && Number.isFinite(t.sampleAtMs) && t.sampleAtMs > 0
        ? t.sampleAtMs
        : 0;

    if (!cur) {
      if (mode === "route" && routeGeometry && routeLenM > 0) {
        const distM = resolvePeerDistM(t, routeLenM)!;
        const pos = pointOnRouteDistM(routeGeometry, distM) ?? [0, 0];
        const state: PeerDriveSimState = {
          label,
          hdg: 0,
          phaseRev: 0,
          pedalSpeedKmh: capSpeedMps(publishedMps) * 3.6,
          mode: "route",
          pos,
          target: pos,
          routeLenM,
          ridePhase,
          anchorDistM: distM,
          anchorAtMs: nowMs,
          liveSpeedMps: capSpeedMps(publishedMps),
          lastServerAtMs: serverAtMs,
          lastInTargetsAtMs: nowMs,
        };
        if (publishedMps > 0.02) setPedalSpeed(state, publishedMps);
        sim.set(t.id, state);
      } else if (t.lngLat) {
        sim.set(t.id, {
          label,
          hdg: 0,
          phaseRev: 0,
          pedalSpeedKmh: 0,
          mode: "coords",
          pos: t.lngLat,
          target: t.lngLat,
          routeLenM: 0,
          ridePhase: "live",
          anchorDistM: 0,
          anchorAtMs: nowMs,
          liveSpeedMps: 0,
          lastServerAtMs: 0,
          lastInTargetsAtMs: nowMs,
        });
      }
      continue;
    }

    cur.label = label;
    cur.routeLenM = routeLenM;
    cur.lastInTargetsAtMs = nowMs;

    if (mode === "route" && routeGeometry && routeLenM > 0) {
      cur.mode = "route";
      const nextDistM = resolvePeerDistM(t, routeLenM)!;
      const isNewPacket =
        serverAtMs > cur.lastServerAtMs ||
        ridePhase !== cur.ridePhase ||
        Math.abs(nextDistM - cur.anchorDistM) > DIST_EPS_M;

      if (isNewPacket) {
        applyRoutePacket(cur, nextDistM, publishedMps, serverAtMs, ridePhase);
      } else {
        cur.ridePhase = ridePhase;
        if (publishedMps > 0.02) {
          cur.liveSpeedMps = capSpeedMps(publishedMps);
          setPedalSpeed(cur, cur.liveSpeedMps);
        }
      }
      continue;
    }

    if (!t.lngLat) continue;
    cur.mode = "coords";
    if (getDistanceMeters(cur.target, t.lngLat) > 0.35) {
      cur.target = t.lngLat;
    }
  }

  for (const id of [...sim.keys()]) {
    if (seen.has(id)) continue;
    const s = sim.get(id)!;
    if (nowMs - s.lastInTargetsAtMs <= PEER_DRIVE_SIM_GRACE_MS) continue;
    sim.delete(id);
  }
}

export function stepPeerDriveAndBuildGeoJson(
  sim: Map<string, PeerDriveSimState>,
  dtSec: number,
  getBearing: (a: LngLat, b: LngLat) => number,
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
      const distM = routeDistFromAnchor(s, s.routeLenM, nowMs);
      const pos = pointOnRouteDistM(routeGeometry, distM);
      if (pos) {
        s.pos = pos;
        s.target = pos;
        const h = headingOnRouteDistM(routeGeometry, distM);
        const moving = s.ridePhase === "live" && s.liveSpeedMps > 0.02;
        if (h !== 0 || moving) s.hdg = h;
      }
    } else {
      s.pos = interpolatePoint(s.pos, s.target, coordAlpha);
      const dist = getDistanceMeters(s.pos, s.target);
      if (dist > 1.2) {
        s.hdg = getBearing(s.pos, s.target);
      }
    }

    const spd =
      s.ridePhase === "paused" || s.ridePhase === "completed"
        ? 0
        : s.liveSpeedMps > 0.02
          ? s.liveSpeedMps * 3.6
          : s.pedalSpeedKmh;
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
      properties: { id, label: s.label, pframe, hdg },
    });
  }

  return { type: "FeatureCollection", features };
}
