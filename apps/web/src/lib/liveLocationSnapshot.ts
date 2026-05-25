import type { LineStringGeometry, LngLat } from "./geo";
import { sanitizeTrailId } from "./firestoreTrail";
import {
  GLOBAL_LIVE_PRESENCE_MAX_WRITE_INTERVAL_MS,
  GLOBAL_LIVE_PRESENCE_MIN_MOVE_METERS,
  GLOBAL_LIVE_PRESENCE_MIN_WRITE_INTERVAL_MS,
  TRAIL_LIVE_PROGRESS_MAX_WRITE_MS,
  TRAIL_LIVE_PROGRESS_MIN_DELTA,
  TRAIL_LIVE_PROGRESS_MIN_WRITE_MS,
  haversineMeters,
  roundLngLatForLiveShare,
} from "./rideSyncPolicy";

/** compute-once → fan-out publish 입력 */
export type LiveLocationPublishInput = {
  lngLat: LngLat | null;
  trailId: string;
  courseId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
};

/** 단일 위치·진행률 스냅샷 — publish fan-out 의 단일 진실 */
export type LiveLocationSnapshot = {
  lngLat: LngLat;
  trailId: string;
  courseId: string;
  progressRatio: number;
  routeReady: boolean;
};

export function computeRouteProgressRatio(
  virtualDistanceMeters: number,
  routeDistanceMeters: number,
): number {
  const tot = routeDistanceMeters > 0 ? routeDistanceMeters : 0;
  if (tot <= 0) return 0;
  return Math.max(0, Math.min(1, virtualDistanceMeters / tot));
}

export function buildLiveLocationSnapshot(input: LiveLocationPublishInput): LiveLocationSnapshot | null {
  if (!input.lngLat) return null;
  const courseId = input.courseId?.trim() ?? "";
  const hasGeometry = Boolean(input.routeGeometry?.coordinates?.length);
  const routeReady = Boolean(courseId && hasGeometry);
  return {
    lngLat: roundLngLatForLiveShare(input.lngLat),
    trailId: sanitizeTrailId(input.trailId),
    courseId,
    progressRatio: computeRouteProgressRatio(input.virtualDistanceMeters, input.routeDistanceMeters),
    routeReady,
  };
}

export type LiveLocationPublishThrottleState = {
  globalWriteAt: number;
  globalLngLat: LngLat | null;
  routeWriteAt: number;
  routeRatio: number;
};

export function createLiveLocationPublishThrottleState(): LiveLocationPublishThrottleState {
  return {
    globalWriteAt: 0,
    globalLngLat: null,
    routeWriteAt: 0,
    routeRatio: -1,
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

export function shouldPublishRouteProgress(
  now: number,
  state: LiveLocationPublishThrottleState,
  progressRatio: number,
): boolean {
  const elapsed = state.routeWriteAt === 0 ? TRAIL_LIVE_PROGRESS_MAX_WRITE_MS : now - state.routeWriteAt;
  const maxDue = state.routeWriteAt === 0 || elapsed >= TRAIL_LIVE_PROGRESS_MAX_WRITE_MS;
  const deltaOk = state.routeRatio < 0 || Math.abs(progressRatio - state.routeRatio) >= TRAIL_LIVE_PROGRESS_MIN_DELTA;
  const minOk = state.routeWriteAt === 0 || now - state.routeWriteAt >= TRAIL_LIVE_PROGRESS_MIN_WRITE_MS;
  if (!maxDue && !(deltaOk && minOk)) return false;
  return true;
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
): void {
  state.routeWriteAt = now;
  state.routeRatio = progressRatio;
}
