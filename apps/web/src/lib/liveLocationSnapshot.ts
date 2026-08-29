import type { LineStringGeometry, LngLat } from "./geo";
import { lineStringLengthMeters } from "./geo";
import { computeRouteProgressRatio, rideDistanceAlongRoute } from "./routeProgressMath";
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
import type { PeerSyncSnapshotCapture } from "./peerMotion/peerSyncSnapshotCapture";
import {
  peekSampleAppliedSpeedKmh,
  peekSampleTargetSpeedKmh,
  peekSampleVirtualDistanceM,
} from "./peerMotion/peerSyncDistanceSamplers";

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
  /** DEV S3-DIAG-R2 — 스냅샷 생성 순간 동기 캡처. publish 페이로드에 넣지 않음 */
  diagCapture?: PeerSyncSnapshotCapture;
};

export {
  computeRouteProgressRatio,
  progressRatioToRouteDistanceMeters,
  rideDistanceAlongRoute,
} from "./routeProgressMath";

export function buildLiveLocationSnapshot(input: LiveLocationPublishInput): LiveLocationSnapshot | null {
  if (!input.lngLat) return null;
  const publicationId = input.publicationId?.trim() ?? "";
  const hasGeometry = Boolean(input.routeGeometry?.coordinates?.length);
  const routeReady = Boolean(publicationId && hasGeometry);
  const geoLen =
    hasGeometry && input.routeGeometry ? lineStringLengthMeters(input.routeGeometry) : 0;
  // S3B-1 D-0: 발행 거리는 rAF 원본. 미등록·idle(NaN) 만 React 200 ms 상태에 폴백.
  const sampled = peekSampleVirtualDistanceM();
  const virtualDistanceMeters = Number.isFinite(sampled) ? sampled : input.virtualDistanceMeters;
  const distMetersAlongRoute = rideDistanceAlongRoute(
    virtualDistanceMeters,
    input.routeDistanceMeters,
    geoLen,
  );
  // S3B-2 D-1: 발행 속도는 rAF 적용속도. 미등록·idle(NaN) 만 슬라이더 목표에 폴백.
  const sampledSpeed = peekSampleAppliedSpeedKmh();
  const speedKmh = Number.isFinite(sampledSpeed) ? sampledSpeed : (input.speedKmh ?? 0);
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
      virtualDistanceMeters,
      input.routeDistanceMeters,
      geoLen,
    ),
    distMetersAlongRoute,
    routeReady,
    speedMps,
    routeRidePhase: input.routeRidePhase ?? "live",
    ...(import.meta.env.DEV
      ? {
          diagCapture: {
            snapshotCapturedAt: Date.now(),
            authDistAtCapture: peekSampleVirtualDistanceM(),
            snapshotDistAtCapture: distMetersAlongRoute,
            appliedKmh: peekSampleAppliedSpeedKmh(),
            targetKmh: peekSampleTargetSpeedKmh(),
            routeLen: input.routeDistanceMeters,
            geoLen,
          },
        }
      : {}),
  };
}

export type LiveLocationPublishThrottleState = {
  globalWriteAt: number;
  globalLngLat: LngLat | null;
  routeWriteAt: number;
  routeRatio: number;
  routeDistM: number;
  routeSpeedMps: number;
  motionWriteAt: number;
  motionSpeedMps: number;
};

export function createLiveLocationPublishThrottleState(): LiveLocationPublishThrottleState {
  return {
    globalWriteAt: 0,
    globalLngLat: null,
    routeWriteAt: 0,
    routeRatio: -1,
    routeDistM: -1,
    routeSpeedMps: -1,
    motionWriteAt: 0,
    motionSpeedMps: -1,
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

/** 슬라이더 등 속도 변경 시 즉시 publish (≈1 km/h) */
const SPEED_PUBLISH_DELTA_MPS = 0.28;

/** 1Hz — 절대 distMeters+speedMps. 속도 변경 시 heartbeat 대기 없이 1회 publish */
export function shouldPublishRouteProgress(
  now: number,
  state: LiveLocationPublishThrottleState,
  _progressRatio: number,
  _distMetersAlongRoute: number,
  speedMps?: number,
): boolean {
  if (state.routeWriteAt === 0) return true;
  if (now - state.routeWriteAt >= TRAIL_LIVE_PROGRESS_HEARTBEAT_MS) return true;
  if (
    typeof speedMps === "number" &&
    Number.isFinite(speedMps) &&
    state.routeSpeedMps >= 0 &&
    Math.abs(speedMps - state.routeSpeedMps) >= SPEED_PUBLISH_DELTA_MPS
  ) {
    return true;
  }
  return false;
}

/** 5Hz RTDB motion — 속도 변경 시 즉시 publish */
export function shouldPublishPeerMotion(
  now: number,
  state: LiveLocationPublishThrottleState,
  speedMps?: number,
): boolean {
  if (state.motionWriteAt === 0) return true;
  if (now - state.motionWriteAt >= PEER_MOTION_PUBLISH_INTERVAL_MS) return true;
  if (
    typeof speedMps === "number" &&
    Number.isFinite(speedMps) &&
    state.motionSpeedMps >= 0 &&
    Math.abs(speedMps - state.motionSpeedMps) >= SPEED_PUBLISH_DELTA_MPS
  ) {
    return true;
  }
  return false;
}

export function markPeerMotionPublished(
  state: LiveLocationPublishThrottleState,
  now: number,
  speedMps?: number,
): void {
  state.motionWriteAt = now;
  if (typeof speedMps === "number" && Number.isFinite(speedMps)) {
    state.motionSpeedMps = speedMps;
  }
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
  speedMps?: number,
): void {
  state.routeWriteAt = now;
  state.routeRatio = progressRatio;
  state.routeDistM = distMetersAlongRoute;
  if (typeof speedMps === "number" && Number.isFinite(speedMps)) {
    state.routeSpeedMps = speedMps;
  }
}
