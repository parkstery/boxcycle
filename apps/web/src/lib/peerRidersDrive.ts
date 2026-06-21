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
import type { TrailLiveRidePhase } from "./firestoreTrailLivePublicationRides";
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
  /** m/s — 송신 측 속도 */
  speedMps?: number | null;
  ridePhase?: TrailLiveRidePhase | null;
};

type RouteSample = { distM: number; tMs: number; speedMps: number };

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
  /** rAF 표시 거리 — 보간 목표를 부드럽게 추적 */
  displayDistM: number;
  /** 앵커 수신 시각 — 서버 lastSeenAt 우선 */
  sampleAtMs: number;
  /** m/s — 최근 패킷 속도 */
  speedMps: number;
  routeLenM: number;
  /** 최근 2개 route 샘플 — 선형 보간 */
  samples: RouteSample[];
  ridePhase: TrailLiveRidePhase;
};

const PEER_MAX = 30;
const COORD_LERP_TAU_SEC = 0.34;
const SPEED_EMA = 0.5;
const DIST_EPS_M = 0.25;
const DEFAULT_SPEED_MPS = PEER_EXTRAP_DEFAULT_SPEED_KMH / 3.6;
const MAX_SPEED_MPS = 85 / 3.6;
const MAX_EXTRAP_AFTER_LAST_SAMPLE_SEC = 2;
/** route peer — Firestore 패킷 간 표시 거리 스무딩 */
const ROUTE_DIST_LERP_TAU_SEC = 0.32;
const ROUTE_DIST_SNAP_EPS_M = 0.12;
const ROUTE_DIST_MAX_CATCHUP_MPS = 18;

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

function pushRouteSample(samples: RouteSample[], sample: RouteSample): void {
  const last = samples[samples.length - 1];
  if (last && last.tMs === sample.tMs && Math.abs(last.distM - sample.distM) < DIST_EPS_M) {
    last.speedMps = sample.speedMps;
    return;
  }
  if (last && sample.tMs < last.tMs) return;
  samples.push(sample);
  while (samples.length > 2) samples.shift();
}

function routeDistFromSamples(
  samples: RouteSample[],
  ridePhase: TrailLiveRidePhase,
  routeLenM: number,
  nowMs: number,
): number {
  if (ridePhase === "completed" || ridePhase === "paused") {
    const s = samples[samples.length - 1];
    return s ? clampDist(s.distM, routeLenM) : 0;
  }
  if (samples.length === 0) return 0;
  if (samples.length === 1) {
    const s = samples[0];
    const speed = s.speedMps > 0.02 ? s.speedMps : DEFAULT_SPEED_MPS;
    const elapsed = Math.max(0, (nowMs - s.tMs) / 1000);
    return clampDist(
      s.distM + speed * Math.min(elapsed, MAX_EXTRAP_AFTER_LAST_SAMPLE_SEC),
      routeLenM,
    );
  }
  const [a, b] = samples;
  if (nowMs <= a.tMs) return clampDist(a.distM, routeLenM);
  if (nowMs >= b.tMs) {
    const speed = b.speedMps > 0.02 ? b.speedMps : DEFAULT_SPEED_MPS;
    const elapsed = (nowMs - b.tMs) / 1000;
    return clampDist(
      b.distM + speed * Math.min(Math.max(0, elapsed), MAX_EXTRAP_AFTER_LAST_SAMPLE_SEC),
      routeLenM,
    );
  }
  const span = b.tMs - a.tMs;
  const u = span > 0 ? (nowMs - a.tMs) / span : 1;
  return clampDist(a.distM + (b.distM - a.distM) * u, routeLenM);
}

function stepRouteDisplayDistM(s: PeerDriveSimState, targetDistM: number, dtSec: number): number {
  const err = targetDistM - s.displayDistM;
  if (Math.abs(err) < ROUTE_DIST_SNAP_EPS_M) return targetDistM;
  const alpha = ROUTE_DIST_LERP_TAU_SEC > 0 ? 1 - Math.exp(-dtSec / ROUTE_DIST_LERP_TAU_SEC) : 1;
  let step = err * alpha;
  const maxStep = ROUTE_DIST_MAX_CATCHUP_MPS * dtSec;
  if (Math.abs(step) > maxStep) step = Math.sign(step) * maxStep;
  return clampDist(s.displayDistM + step, s.routeLenM);
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
    const ridePhase: TrailLiveRidePhase = t.ridePhase ?? "live";

    if (!cur) {
      if (mode === "route" && routeGeometry && routeLenM > 0) {
        const distM = resolvePeerDistM(t, routeLenM)!;
        const publishedSpeed =
          typeof t.speedMps === "number" && Number.isFinite(t.speedMps)
            ? capSpeedMps(t.speedMps)
            : DEFAULT_SPEED_MPS;
        const pos = pointOnRouteDistM(routeGeometry, distM) ?? [0, 0];
        sim.set(t.id, {
          label,
          hdg: 0,
          phaseRev: 0,
          emaSpeedKmh: publishedSpeed * 3.6 * 0.5,
          mode: "route",
          pos,
          target: pos,
          anchorDistM: distM,
          displayDistM: distM,
          sampleAtMs,
          speedMps: publishedSpeed,
          routeLenM,
          samples: [{ distM, tMs: sampleAtMs, speedMps: publishedSpeed }],
          ridePhase,
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
          displayDistM: 0,
          sampleAtMs,
          speedMps: 0,
          routeLenM: 0,
          samples: [],
          ridePhase: "live",
        });
      }
      continue;
    }

    cur.label = label;
    cur.routeLenM = routeLenM;
    cur.ridePhase = ridePhase;

    if (mode === "route" && routeGeometry && routeLenM > 0) {
      cur.mode = "route";
      const nextDistM = resolvePeerDistM(t, routeLenM)!;
      const publishedSpeed =
        typeof t.speedMps === "number" && Number.isFinite(t.speedMps)
          ? capSpeedMps(t.speedMps)
          : null;
      const prevSample = cur.samples[cur.samples.length - 1];
      let speedMps = publishedSpeed;
      if (speedMps == null && prevSample && sampleAtMs > prevSample.tMs) {
        const dtSec = (sampleAtMs - prevSample.tMs) / 1000;
        if (dtSec > 0.04) {
          speedMps = capSpeedMps((nextDistM - prevSample.distM) / dtSec);
        }
      }
      if (speedMps == null) speedMps = cur.speedMps > 0.02 ? cur.speedMps : DEFAULT_SPEED_MPS;

      const distChanged = Math.abs(nextDistM - cur.anchorDistM) > DIST_EPS_M;
      const timeAdvanced = sampleAtMs > cur.sampleAtMs;
      if (distChanged || timeAdvanced || ridePhase !== cur.ridePhase) {
        pushRouteSample(cur.samples, { distM: nextDistM, tMs: sampleAtMs, speedMps });
        cur.anchorDistM = nextDistM;
        cur.sampleAtMs = sampleAtMs;
        cur.speedMps = speedMps;
        const spdKmh = speedMps * 3.6;
        cur.emaSpeedKmh = cur.emaSpeedKmh * (1 - SPEED_EMA) + spdKmh * SPEED_EMA;
      } else if (publishedSpeed != null) {
        cur.speedMps = publishedSpeed;
      }
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
      const targetDistM = routeDistFromSamples(s.samples, s.ridePhase, s.routeLenM, nowMs);
      s.displayDistM = stepRouteDisplayDistM(s, targetDistM, clampedDt);
      const pos = pointOnRouteDistM(routeGeometry, s.displayDistM);
      if (pos) {
        s.pos = pos;
        s.target = pos;
        const h = headingOnRouteDistM(routeGeometry, s.displayDistM);
        const spdKmh =
          s.ridePhase === "paused" || s.ridePhase === "completed"
            ? 0
            : s.speedMps > 0.02
              ? s.speedMps * 3.6
              : s.emaSpeedKmh;
        if (h !== 0 || spdKmh > 0.38) s.hdg = h;
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
        : s.emaSpeedKmh > 0.38
          ? s.emaSpeedKmh
          : s.speedMps > 0.02
            ? s.speedMps * 3.6
            : DEFAULT_SPEED_MPS * 3.6;
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
