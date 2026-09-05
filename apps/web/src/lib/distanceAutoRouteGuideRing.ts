import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
} from "./distanceAutoRouteErrors";

/**
 * 클릭 권장 원(안내) — 5A-R2c §2 (Chief: 원 하나, 반지름 = D).
 *
 * 도넛(`[D, 1.5D]`)은 폐기했다. 화면에는 목표 거리 D 를 반지름으로 하는
 * **파선 원 하나**만 그린다. 안내 문구는 「{N} km 반경의 원 주변 도로를 선택하세요」.
 *
 * 서버 판정과 독립이다: `road < D − 5m` 만 안내·실패·환불이다.
 * 직선 ≥ D 이면 도로 ≥ D 이므로(λ ≥ 1) 부족분·우회·우리가 만드는 중복이 없다.
 */

/** 목표 거리(km) → 안내 원 반지름(km) = D. 퇴화 입력에서도 유한한 값을 준다. */
export function resolveDistanceAutoRouteGuideRadiusKm(targetKm: number): number {
  const n = Number(targetKm);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(DISTANCE_AUTO_ROUTE_KM_MAX, Math.max(DISTANCE_AUTO_ROUTE_KM_MIN, n));
  }
  return DISTANCE_AUTO_ROUTE_KM_MIN;
}
