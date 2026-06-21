import type { LineStringGeometry, LngLat } from "./geo";
import {
  getDistanceMeters,
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  interpolatePoint,
  lineStringLengthMeters,
} from "./geo";
import { progressRatioToRouteDistanceMeters } from "./liveLocationSnapshot";
import { PEER_SPEED_EXTRAP_MAX_MS } from "./rideSyncPolicy";
import type { TrailLiveRidePhase } from "./firestoreTrailLivePublicationRides";
import { estimateCrankRpmFromSpeedKmh } from "./riderPedalMotion";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "./registerPeerRiderPedalSprites";

export type MapPeerInput = {
  id: string;
  label?: string | null;
  /** geometry 위 주행 거리(m) — 우선 */
  distMeters?: number | null;
  /** Firestore lastSeenAt ms — 패킷 식별·stale 판정 */
  sampleAtMs?: number | null;
  /** distMeters 없을 때 폴백 */
  progressRatio?: number;
  /** progress·dist 모두 없을 때 폴백 */
  lngLat?: LngLat;
  /** m/s — 패킷 간 rAF 전진 + 페달 */
  speedMps?: number | null;
  ridePhase?: TrailLiveRidePhase | null;
};

type RouteSample = {
  distM: number;
  receivedAtMs: number;
  serverAtMs: number;
  speedMps: number;
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
  samples: RouteSample[];
  ridePhase: TrailLiveRidePhase;
  lastServerAtMs: number;
  /** 최신 송신 speedMps — 패킷 대기 중 rAF 전진 */
  liveSpeedMps: number;
};

const PEER_MAX = 30;
const COORD_LERP_TAU_SEC = 0.34;
const PEDAL_SPEED_EMA = 0.35;
const DIST_EPS_M = 0.2;
const MAX_SPEED_MPS = 85 / 3.6;

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

function impliedSpeedMps(cur: RouteSample, prev: RouteSample | undefined): number {
  if (cur.speedMps > 0.02) return cur.speedMps;
  if (!prev) return 0;
  const dtSec = (cur.receivedAtMs - prev.receivedAtMs) / 1000;
  if (dtSec < 0.04) return 0;
  return capSpeedMps((cur.distM - prev.distM) / dtSec);
}

function pushRouteSample(samples: RouteSample[], sample: RouteSample): void {
  const last = samples[samples.length - 1];
  if (last) {
    if (sample.distM < last.distM - DIST_EPS_M) return;
    if (
      Math.abs(sample.distM - last.distM) < DIST_EPS_M &&
      sample.receivedAtMs - last.receivedAtMs < 80
    ) {
      last.speedMps = sample.speedMps;
      return;
    }
  }
  samples.push(sample);
  while (samples.length > 2) samples.shift();
}

/** 송신 speedMps — 패킷 도착 전 rAF 연속 전진 (상한 PEER_SPEED_EXTRAP_MAX_MS) */
function extrapDistFromSample(
  sample: RouteSample,
  prev: RouteSample | undefined,
  nowMs: number,
  routeLenM: number,
): number {
  const speed = impliedSpeedMps(sample, prev);
  if (speed <= 0.02) return clampDist(sample.distM, routeLenM);
  const elapsedMs = Math.max(0, nowMs - sample.receivedAtMs);
  const cappedMs = Math.min(elapsedMs, PEER_SPEED_EXTRAP_MAX_MS);
  return clampDist(sample.distM + speed * (cappedMs / 1000), routeLenM);
}

/**
 * 샘플 사이 선형 보간 + 마지막 샘플 이후 송신 speedMps 전진.
 * (extrapolation 0 이면 패킷 간 멈춤 → 전진 반복)
 */
function routeDistFromSamples(
  samples: RouteSample[],
  ridePhase: TrailLiveRidePhase,
  routeLenM: number,
  nowMs: number,
): number {
  if (samples.length === 0) return 0;
  const last = samples[samples.length - 1]!;

  if (ridePhase === "completed" || ridePhase === "paused") {
    return clampDist(last.distM, routeLenM);
  }

  if (samples.length === 1) {
    return extrapDistFromSample(last, undefined, nowMs, routeLenM);
  }

  const [a, b] = samples;
  if (nowMs <= a.receivedAtMs) return clampDist(a.distM, routeLenM);
  if (nowMs < b.receivedAtMs) {
    const span = b.receivedAtMs - a.receivedAtMs;
    const u = span > 0 ? (nowMs - a.receivedAtMs) / span : 1;
    return clampDist(a.distM + (b.distM - a.distM) * u, routeLenM);
  }

  return extrapDistFromSample(b, a, nowMs, routeLenM);
}

function setPedalSpeed(cur: PeerDriveSimState, speedMps: number): void {
  const capped = capSpeedMps(speedMps);
  cur.liveSpeedMps = capped;
  const spdKmh = capped * 3.6;
  cur.pedalSpeedKmh = cur.pedalSpeedKmh * (1 - PEDAL_SPEED_EMA) + spdKmh * PEDAL_SPEED_EMA;
}

function ingestRouteSample(
  cur: PeerDriveSimState,
  distM: number,
  speedMps: number,
  serverAtMs: number,
  ridePhase: TrailLiveRidePhase,
): void {
  const receivedAtMs = Date.now();
  const prev = cur.samples[cur.samples.length - 1];
  const cappedSpeed = capSpeedMps(speedMps);
  const sample: RouteSample = {
    distM,
    receivedAtMs,
    serverAtMs,
    speedMps: cappedSpeed > 0.02 ? cappedSpeed : impliedSpeedMps(
      { distM, receivedAtMs, serverAtMs, speedMps: 0 },
      prev,
    ),
  };
  pushRouteSample(cur.samples, sample);
  cur.ridePhase = ridePhase;
  setPedalSpeed(cur, sample.speedMps);
}

export function mergePeerTargets(
  sim: Map<string, PeerDriveSimState>,
  peers: MapPeerInput[],
  _nowMs: number,
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

    if (!cur) {
      if (mode === "route" && routeGeometry && routeLenM > 0) {
        const distM = resolvePeerDistM(t, routeLenM)!;
        const speedMps =
          typeof t.speedMps === "number" && Number.isFinite(t.speedMps) ? t.speedMps : 0;
        const serverAtMs =
          typeof t.sampleAtMs === "number" && t.sampleAtMs > 0 ? t.sampleAtMs : 0;
        const pos = pointOnRouteDistM(routeGeometry, distM) ?? [0, 0];
        const state: PeerDriveSimState = {
          label,
          hdg: 0,
          phaseRev: 0,
          pedalSpeedKmh: capSpeedMps(speedMps) * 3.6,
          mode: "route",
          pos,
          target: pos,
          routeLenM,
          samples: [],
          ridePhase,
          lastServerAtMs: serverAtMs,
          liveSpeedMps: capSpeedMps(speedMps),
        };
        ingestRouteSample(state, distM, speedMps, serverAtMs, ridePhase);
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
          samples: [],
          ridePhase: "live",
          lastServerAtMs: 0,
          liveSpeedMps: 0,
        });
      }
      continue;
    }

    cur.label = label;
    cur.routeLenM = routeLenM;

    if (mode === "route" && routeGeometry && routeLenM > 0) {
      cur.mode = "route";
      const nextDistM = resolvePeerDistM(t, routeLenM)!;
      const publishedSpeed =
        typeof t.speedMps === "number" && Number.isFinite(t.speedMps) ? t.speedMps : 0;
      const serverAtMs =
        typeof t.sampleAtMs === "number" && Number.isFinite(t.sampleAtMs) && t.sampleAtMs > 0
          ? t.sampleAtMs
          : 0;
      const isNewPacket =
        serverAtMs > cur.lastServerAtMs ||
        ridePhase !== cur.ridePhase ||
        Math.abs(nextDistM - (cur.samples[cur.samples.length - 1]?.distM ?? -1)) > DIST_EPS_M;

      if (isNewPacket) {
        ingestRouteSample(cur, nextDistM, publishedSpeed, serverAtMs, ridePhase);
        if (serverAtMs > 0) cur.lastServerAtMs = serverAtMs;
      } else {
        cur.ridePhase = ridePhase;
        if (publishedSpeed > 0) {
          setPedalSpeed(cur, publishedSpeed);
          const tail = cur.samples[cur.samples.length - 1];
          if (tail) tail.speedMps = cur.liveSpeedMps;
        }
      }
      continue;
    }

    if (!t.lngLat) continue;
    cur.mode = "coords";
    const jumped = getDistanceMeters(cur.target, t.lngLat);
    if (jumped > 0.35) {
      cur.target = t.lngLat;
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
      const distM = routeDistFromSamples(s.samples, s.ridePhase, s.routeLenM, nowMs);
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
