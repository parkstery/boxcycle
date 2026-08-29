import type { LineStringGeometry, LngLat } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";
import { computeRouteProgressRatio, rideDistanceAlongRoute } from "./routeProgressMath";

/**
 * 이번 세션이 **실제로** 시작·종료한 경로상 지점(RIDE-CONTINUE-1 단계 B).
 *
 * 계획된 Route 의 출발·도착이 아니라, 31% 에서 시작해 43% 에서 끝난 Ride 의
 * 진짜 연결점을 복원하기 위한 값이다. 「다음 출발점」의 유일한 근거.
 */
export type RideSessionAnchors = {
  sessionStartLngLat: LngLat | null;
  sessionEndLngLat: LngLat | null;
  sessionStartRouteMeters: number;
  sessionEndRouteMeters: number;
  sessionStartProgressRatio: number;
  sessionEndProgressRatio: number;
};

export const EMPTY_RIDE_SESSION_ANCHORS: RideSessionAnchors = {
  sessionStartLngLat: null,
  sessionEndLngLat: null,
  sessionStartRouteMeters: 0,
  sessionEndRouteMeters: 0,
  sessionStartProgressRatio: 0,
  sessionEndProgressRatio: 0,
};

/** 비유한·음수는 0 으로 — NaN 이 anchor 를 Null Island 로 보내지 않게 한다 */
function sanitizeMeters(v: number): number {
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

/**
 * 세션 시작·종료 anchor 계산.
 *
 * 경계 함수는 `liveForMap`(App) 과 **공유**한다 — `rideDistanceAlongRoute` 로 거리를 캡하고
 * `getPointOnRouteByDistance` 로 선상 좌표를 얻는다(별도 인덱스 보간을 만들지 않는다).
 *
 * - `startOffsetMeters` = 이어 달리기 시드(0 이면 처음부터)
 * - `endVirtualDistanceMeters` = 종료 시점의 **누적** 경로상 위치(virtualDistance)
 * - geometry 가 없거나 길이가 0 이면 좌표는 `null` — 호출부는 Ride 저장을 계속한다.
 */
export function computeRideSessionAnchors(input: {
  geometry: LineStringGeometry | null | undefined;
  routeDistanceMeters: number;
  startOffsetMeters: number;
  endVirtualDistanceMeters: number;
}): RideSessionAnchors {
  const geometry = input.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
    return EMPTY_RIDE_SESSION_ANCHORS;
  }
  const geoLen = lineStringLengthMeters(geometry);
  if (!Number.isFinite(geoLen) || geoLen <= 0) return EMPTY_RIDE_SESSION_ANCHORS;

  const routeDistanceMeters = Number.isFinite(input.routeDistanceMeters)
    ? Math.max(0, input.routeDistanceMeters)
    : 0;
  const startMeters = rideDistanceAlongRoute(
    sanitizeMeters(input.startOffsetMeters),
    routeDistanceMeters,
    geoLen,
  );
  const endMetersRaw = rideDistanceAlongRoute(
    sanitizeMeters(input.endVirtualDistanceMeters),
    routeDistanceMeters,
    geoLen,
  );
  // end ≥ start — 종료가 시작보다 앞설 수 없다(퇴화 입력 방어).
  const endMeters = Math.max(startMeters, endMetersRaw);

  return {
    sessionStartLngLat: getPointOnRouteByDistance(geometry, startMeters),
    sessionEndLngLat: getPointOnRouteByDistance(geometry, endMeters),
    sessionStartRouteMeters: startMeters,
    sessionEndRouteMeters: endMeters,
    sessionStartProgressRatio: computeRouteProgressRatio(
      startMeters,
      routeDistanceMeters,
      geoLen,
    ),
    sessionEndProgressRatio: computeRouteProgressRatio(endMeters, routeDistanceMeters, geoLen),
  };
}
