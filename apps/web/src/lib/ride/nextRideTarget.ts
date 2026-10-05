import type { LngLat } from "../geo/geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "../geo/geo";
import type { SavedRoute } from "../route/repo/firestoreSavedRoutes";
import type { StoredRideSession } from "./rideSessionsStorage";
import { isDiscardableRideRecord, ROUTE_COMPLETION_RATIO_THRESHOLD, resumeOffsetMetersFrom } from "./rideRecordPolicy";

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
 *
 * Codex CP1: Use shared `resumeOffsetMetersFrom` helper to apply 0.97 cap consistently
 * across card/prep/Go. lastProgressRatio (routeDistanceMeters basis) → capped offset → geometry coordinate.
 */
export function resumeAnchorForRoute(route: SavedRoute): LngLat | null {
  const geoLen = lineStringLengthMeters(route.geometry);
  if (!Number.isFinite(geoLen) || geoLen <= 0) return null;
  const routeDistMeters = Number.isFinite(route.distanceMeters) ? route.distanceMeters : geoLen;
  // Shared helper applies 0.97 cap (ROUTE_RESUME_MAX_RATIO)
  const offsetMeters = resumeOffsetMetersFrom(route.lastProgressRatio, routeDistMeters);
  return getPointOnRouteByDistance(route.geometry, offsetMeters);
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
  activeRouteId?: string | null;
}): NextRideTarget | null {
  return resolveNextRideView(input)?.target ?? null;
}

/**
 * 다음 주행 후보 해석.
 *
 * activeRouteId 파라미터에 따른 동작:
 * - string: 해당 경로를 우선 반환. 관련 Ride가 없으면 minimal view 합성.
 * - null: 슬롯이 비어있음 — resume 경로를 새로 고르지 않고 extend_from_ride만.
 * - undefined: legacy 동작 — 기존 알고리즘 그대로(테스트 하위호환).
 */
export function resolveNextRideView(input: {
  rides: readonly StoredRideSession[];
  savedRoutes: readonly SavedRoute[];
  activeRouteId?: string | null;
}): NextRideView | null {
  const { activeRouteId } = input;

  // 슬롯에 활성 경로가 있으면 그것을 우선 반환
  if (typeof activeRouteId === "string") {
    const route = input.savedRoutes.find((r) => r.id === activeRouteId) ?? null;
    if (route && route.completed !== 1) {
      const progressRatio = clamp01(route.lastProgressRatio);
      if (progressRatio > 0 && progressRatio < ROUTE_COMPLETION_RATIO_THRESHOLD) {
        const anchorLngLat = resumeAnchorForRoute(route);
        if (anchorLngLat) {
          // 관련 Ride를 history에서 찾는다
          const ordered = sortValidRidesNewestFirst(input.rides);
          const existingRide = ordered.find((r) => r.userRouteId?.trim() === activeRouteId);
          // 관련 Ride가 없으면 minimal StoredRideSession 합성
          // 실측 운동 거리·시간을 조작하지 않는다 — 카드 경로 진행 표시 전용
          const ride: StoredRideSession = existingRide ?? {
            id: `slot:${route.id}`,
            endedAt: route.updatedAtIso,
            elapsedSec: 0,
            distanceMeters: 0,
            avgSpeedKmh: 0,
            caloriesEstimate: 0,
            routeDistanceMeters: route.distanceMeters,
            routeDurationSec: route.durationSec,
            userRouteId: route.id,
            routeName: route.name,
            completionRatio: progressRatio,
            sessionEndLngLat: anchorLngLat,
          };
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
    // 활성 슬롯이 지정됐는데 그 경로가 재개 불능이면 다른 Route resume으로 우회하지 않는다
    // (extend_from_ride 만 허용 — 다슬롯 제품 경로 금지)
  }

  // activeRouteId===null 또는 string(무효 A): resume을 새로 고르지 않고 extend_from_ride만
  // activeRouteId===undefined: legacy — 기존 알고리즘 전체 실행
  const suppressDerivedResume = activeRouteId !== undefined;

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
            if (suppressDerivedResume) {
              // 슬롯 API 사용 경로: 파생 resume 금지
            } else {
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
  /**
   * 다른 경로가 슬롯을 점유해 이 Ride 의 이어달리기가 막혔는가.
   * activeRouteId 미전달(undefined, legacy) 시 항상 false.
   */
  resumeBlocked: boolean;
};

export function resolveRecentRideActions(
  ride: StoredRideSession,
  savedRoutes: readonly SavedRoute[],
  options?: { activeRouteId?: string | null },
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

  const activeRouteId = options?.activeRouteId; // undefined = legacy(슬롯 미사용)

  // 다른 경로가 활성일 때: resumeRouteId 차단 + resumeBlocked=true
  const blocked =
    typeof activeRouteId === "string" && activeRouteId !== null
      ? activeRouteId !== routeId
      : false;

  // activeRouteId===null: 슬롯 비어있음 — 재개 허용(UI가 acquire)
  // activeRouteId===undefined: legacy — 기존 동작 그대로
  const showResume = resumable && !blocked;

  return {
    canShowOnMap: anchor != null,
    resumeRouteId: showResume ? route!.id : null,
    extendAnchor: anchor,
    resumeBlocked: resumable && blocked,
  };
}
