import type { LineStringGeometry, LngLat } from "./geo";
import { lineStringLengthMeters } from "./geo";
import { sanitizeTrailId } from "./firestoreTrail";
import {
  GLOBAL_LIVE_PRESENCE_MAX_WRITE_INTERVAL_MS,
  GLOBAL_LIVE_PRESENCE_MIN_MOVE_METERS,
  GLOBAL_LIVE_PRESENCE_MIN_WRITE_INTERVAL_MS,
  TRAIL_LIVE_PROGRESS_HEARTBEAT_MS,
  PEER_MOTION_PUBLISH_INTERVAL_MS,
  haversineMeters,
  roundLngLatForLiveShare,
} from "./rideSyncPolicy";

/** compute-once → fan-out publish 입력 */
export type LiveLocationPublishInput = {
  lngLat: LngLat | null;
  trailId: string;
  publicationId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  /** 가상 주행 속도(km/h) — peer speedMps publish */
  speedKmh?: number;
  /** running=live, paused=paused */
  routeRidePhase?: "live" | "paused";
};

/** 단일 위치·진행률 스냅샷 — publish fan-out 의 단일 진실 */
export type LiveLocationSnapshot = {
  lngLat: LngLat;
  trailId: string;
  publicationId: string;
  progressRatio: number;
  /** geometry 위 주행 거리(m) — peer 표시·외삽용 */
  distMetersAlongRoute: number;
  routeReady: boolean;
  speedMps: number;
  routeRidePhase: "live" | "paused";
};

/** 본인·동행 공통 — geometry 위 주행 거리(m). `liveForMap`·rAF 샘플과 동일 */
export function rideDistanceAlongRoute(
  virtualDistanceMeters: number,
  routeDistanceMeters: number,
  geometryLengthMeters: number,
): number {
  const geoLen = geometryLengthMeters > 0 ? geometryLengthMeters : 0;
  const routeCap = routeDistanceMeters > 0 ? routeDistanceMeters : geoLen;
  if (geoLen <= 0 && routeCap <= 0) return Math.max(0, virtualDistanceMeters);
  const cap = geoLen > 0 ? Math.min(routeCap, geoLen) : routeCap;
  return Math.min(Math.max(0, virtualDistanceMeters), cap);
}

/**
 * 경로 진행률 — **geometry 길이 기준** (클라이언트별 Directions 거리 차이 무시).
 * publish·peer·본인 위치가 같은 fraction 을 쓰도록 한다.
 */
export function computeRouteProgressRatio(
  virtualDistanceMeters: number,
  routeDistanceMeters: number,
  geometryLengthMeters: number,
): number {
  const geoLen = geometryLengthMeters > 0 ? geometryLengthMeters : 0;
  const denom = geoLen > 0 ? geoLen : routeDistanceMeters > 0 ? routeDistanceMeters : 0;
  if (denom <= 0) return 0;
  const dist = rideDistanceAlongRoute(virtualDistanceMeters, routeDistanceMeters, geoLen);
  return Math.max(0, Math.min(1, dist / denom));
}

/** geometry fraction → 지도 거리(m) */
export function progressRatioToRouteDistanceMeters(
  progressRatio: number,
  geometryLengthMeters: number,
): number {
  const geoLen = geometryLengthMeters > 0 ? geometryLengthMeters : 0;
  if (geoLen <= 0) return 0;
  const p = Math.max(0, Math.min(1, progressRatio));
  return p * geoLen;
}

export function buildLiveLocationSnapshot(input: LiveLocationPublishInput): LiveLocationSnapshot | null {
  if (!input.lngLat) return null;
  const publicationId = input.publicationId?.trim() ?? "";
  const hasGeometry = Boolean(input.routeGeometry?.coordinates?.length);
  const routeReady = Boolean(publicationId && hasGeometry);
  const geoLen =
    hasGeometry && input.routeGeometry ? lineStringLengthMeters(input.routeGeometry) : 0;
  const distMetersAlongRoute = rideDistanceAlongRoute(
    input.virtualDistanceMeters,
    input.routeDistanceMeters,
    geoLen,
  );
  const speedKmh = input.speedKmh ?? 0;
  const speedMps =
    input.routeRidePhase === "paused"
      ? 0
      : Number.isFinite(speedKmh)
        ? Math.max(0, speedKmh / 3.6)
        : 0;
  return {
    lngLat: roundLngLatForLiveShare(input.lngLat),
    trailId: sanitizeTrailId(input.trailId),
    publicationId,
    progressRatio: computeRouteProgressRatio(
      input.virtualDistanceMeters,
      input.routeDistanceMeters,
      geoLen,
    ),
    distMetersAlongRoute,
    routeReady,
    speedMps,
    routeRidePhase: input.routeRidePhase ?? "live",
  };
}

export type LiveLocationPublishThrottleState = {
  globalWriteAt: number;
  globalLngLat: LngLat | null;
  routeWriteAt: number;
  routeRatio: number;
  routeDistM: number;
  motionWriteAt: number;
};

export function createLiveLocationPublishThrottleState(): LiveLocationPublishThrottleState {
  return {
    globalWriteAt: 0,
    globalLngLat: null,
    routeWriteAt: 0,
    routeRatio: -1,
    routeDistM: -1,
    motionWriteAt: 0,
  };
}

export function shouldPublishGlobalPresence(
  now: number,
  state: LiveLocationPublishThrottleState,
  lngLat: LngLat,
): boolean {
  const elapsed = state.globalWriteAt === 0 ? GLOBAL_LIVE_PRESENCE_MAX_WRITE_INTERVAL_MS : now - state.globalWriteAt;
  const maxDue = state.globalWriteAt === 0 || elapsed >= GLOBAL_LIVE_PRESENCE_MAX_WRITE_INTERVAL_MS;
  const minOk = state.globalWriteAt === 0 || elapsed >= GLOBAL_LIVE_PRESENCE_MIN_WRITE_INTERVAL_MS;
  const moved =
    state.globalLngLat == null ? true : haversineMeters(state.globalLngLat, lngLat) >= GLOBAL_LIVE_PRESENCE_MIN_MOVE_METERS;
  if (!minOk && !maxDue) return false;
  return maxDue || moved;
}

/** 1Hz — 절대 distMeters+speedMps. delta 조건 없음(수신 측 2-sample 보간 전제). */
export function shouldPublishRouteProgress(
  now: number,
  state: LiveLocationPublishThrottleState,
  _progressRatio: number,
  _distMetersAlongRoute: number,
): boolean {
  if (state.routeWriteAt === 0) return true;
  return now - state.routeWriteAt >= TRAIL_LIVE_PROGRESS_HEARTBEAT_MS;
}

/** 5Hz — RTDB motion (Firestore 와 분리) */
export function shouldPublishPeerMotion(now: number, state: LiveLocationPublishThrottleState): boolean {
  if (state.motionWriteAt === 0) return true;
  return now - state.motionWriteAt >= PEER_MOTION_PUBLISH_INTERVAL_MS;
}

export function markPeerMotionPublished(state: LiveLocationPublishThrottleState, now: number): void {
  state.motionWriteAt = now;
}

export function markGlobalPresencePublished(
  state: LiveLocationPublishThrottleState,
  now: number,
  lngLat: LngLat,
): void {
  state.globalWriteAt = now;
  state.globalLngLat = lngLat;
}

export function markRouteProgressPublished(
  state: LiveLocationPublishThrottleState,
  now: number,
  progressRatio: number,
  distMetersAlongRoute: number,
): void {
  state.routeWriteAt = now;
  state.routeRatio = progressRatio;
  state.routeDistM = distMetersAlongRoute;
}
