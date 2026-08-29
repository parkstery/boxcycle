import type { LngLat } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";
import type { SavedRoute } from "./firestoreSavedRoutes";
import type { StoredRideSession } from "./rideSessionsStorage";
import { isDiscardableRideRecord, ROUTE_COMPLETION_RATIO_THRESHOLD } from "./rideRecordPolicy";
import { progressRatioToRouteDistanceMeters } from "./routeProgressMath";

/**
 * 「다음 주행」 후보(RIDE-CONTINUE-1 §4.3).
 *
 * v1 에서는 `users/{uid}.nextRide` 같은 mutable pointer 문서를 만들지 않는다 —
 * 최근 Ride 와 SavedRoute 에서 **파생**한다. 그래서 Route 가 삭제·완주되면 후보도 자동 무효화된다.
 */
export type NextRideTarget =
  | {
      kind: "resume_route";
      rideId: string;
      routeId: string;
      progressRatio: number;
      anchorLngLat: LngLat;
    }
  | {
      kind: "extend_from_ride";
      rideId: string;
      anchorLngLat: LngLat;
    };

/** 카드 렌더에 필요한 원본까지 묶은 결과 — 문구 조합은 컴포넌트가 한다 */
export type NextRideView = {
  target: NextRideTarget;
  ride: StoredRideSession;
  /** `resume_route` 일 때의 SavedRoute. `extend_from_ride` 면 null */
  route: SavedRoute | null;
};

function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** 좌표 유효성 — legacy Ride 의 빈 값을 `[0,0]`(Null Island) 로 추측하지 않는다 */
function asLngLat(v: unknown): LngLat | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const lng = Number(v[0]);
  const lat = Number(v[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function endedAtMs(ride: StoredRideSession): number {
  const t = Date.parse(ride.endedAt);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** 유효 Ride(폐기 필터 통과)만 종료시각 내림차순으로 */
export function sortValidRidesNewestFirst(
  rides: readonly StoredRideSession[],
): StoredRideSession[] {
  return rides
    .filter((r): r is StoredRideSession => Boolean(r))
    .filter((r) => !isDiscardableRideRecord(r.distanceMeters, r.elapsedSec))
    .slice()
    .sort((a, b) => endedAtMs(b) - endedAtMs(a));
}

/**
 * SavedRoute 의 최대 진행률 지점(재개점) 좌표.
 *
 * ⚠ 재개 위치의 진실은 **SavedRoute 의 `lastProgressRatio`** 이지 최근 Ride 의 종료 좌표가 아니다.
 * 43% 까지 간 Route 를 「처음부터」 타고 20% 에서 끝내도 재개점은 43% 다.
 */
export function resumeAnchorForRoute(route: SavedRoute): LngLat | null {
  const geoLen = lineStringLengthMeters(route.geometry);
  if (!Number.isFinite(geoLen) || geoLen <= 0) return null;
  const meters = progressRatioToRouteDistanceMeters(clamp01(route.lastProgressRatio), geoLen);
  return getPointOnRouteByDistance(route.geometry, meters);
}

/**
 * 다음 주행 후보 해석.
 *
 * 1. 유효 Ride 를 종료시각 내림차순으로 본다.
 * 2. 본인 미완주 SavedRoute 와 연결되고 `0 < progress < 0.98` 이면 `resume_route`.
 * 3. 그 외 `sessionEndLngLat` 이 있으면 `extend_from_ride`(Route 가 삭제됐어도 가능).
 * 4. 좌표도 Route 도 없으면(legacy Ride) 그 Ride 는 후보를 만들지 않는다.
 */
export function resolveNextRideTarget(input: {
  rides: readonly StoredRideSession[];
  savedRoutes: readonly SavedRoute[];
}): NextRideTarget | null {
  return resolveNextRideView(input)?.target ?? null;
}

export function resolveNextRideView(input: {
  rides: readonly StoredRideSession[];
  savedRoutes: readonly SavedRoute[];
}): NextRideView | null {
  const ordered = sortValidRidesNewestFirst(input.rides);
  for (const ride of ordered) {
    const routeId = ride.userRouteId?.trim();
    if (routeId) {
      const route = input.savedRoutes.find((r) => r.id === routeId) ?? null;
      if (route && route.completed !== 1) {
        const progressRatio = clamp01(route.lastProgressRatio);
        if (progressRatio > 0 && progressRatio < ROUTE_COMPLETION_RATIO_THRESHOLD) {
          const anchorLngLat = resumeAnchorForRoute(route);
          if (anchorLngLat) {
            return {
              target: {
                kind: "resume_route",
                rideId: ride.id,
                routeId: route.id,
                progressRatio,
                anchorLngLat,
              },
              ride,
              route,
            };
          }
        }
      }
    }
    const anchorLngLat = asLngLat(ride.sessionEndLngLat);
    if (anchorLngLat) {
      return {
        target: { kind: "extend_from_ride", rideId: ride.id, anchorLngLat },
        ride,
        route: null,
      };
    }
  }
  return null;
}

/** 최근 주행 목록의 행 액션(§3.6) — legacy Ride 는 기록만 표시한다 */
export type RecentRideActions = {
  /** 실제 종료 지점이 있어 지도에서 볼 수 있는가 */
  canShowOnMap: boolean;
  /** 본인 미완주 SavedRoute 라 이어 달릴 수 있는가 */
  resumeRouteId: string | null;
  /** 실제 종료 지점에서 새 경로를 만들 수 있는가 */
  extendAnchor: LngLat | null;
};

export function resolveRecentRideActions(
  ride: StoredRideSession,
  savedRoutes: readonly SavedRoute[],
): RecentRideActions {
  const anchor = asLngLat(ride.sessionEndLngLat);
  const routeId = ride.userRouteId?.trim();
  const route = routeId ? (savedRoutes.find((r) => r.id === routeId) ?? null) : null;
  const progressRatio = route ? clamp01(route.lastProgressRatio) : 0;
  const resumable =
    route != null &&
    route.completed !== 1 &&
    progressRatio > 0 &&
    progressRatio < ROUTE_COMPLETION_RATIO_THRESHOLD &&
    resumeAnchorForRoute(route) != null;
  return {
    canShowOnMap: anchor != null,
    resumeRouteId: resumable ? route!.id : null,
    extendAnchor: anchor,
  };
}
