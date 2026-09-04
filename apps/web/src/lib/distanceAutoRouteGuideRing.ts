import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
} from "./distanceAutoRouteErrors";

/**
 * 클릭 권장 범위(도넛) — 5A-R2 §2 (기하 정정: 안쪽 = D, 바깥 = 1.5D).
 *
 * 3F-C-R1 이 도넛을 폐기했던 근거(「직선 비율과 도로거리 사이에 단조 관계가 없다」)는
 * 지금도 참이다. 문제였던 것은 **추측한 고정 비율을 실패를 결정하는 hard gate 로 쓴 것**이다.
 * 이번 도넛은 성격이 다르다 — 안쪽은 **부등식**, 바깥은 **UI**, 역할은 **안내**다.
 *
 * 서버 실패 판정은 도넛과 무관하다: `road < D − 5m` → 안내·실패·우회 미호출.
 */

/**
 * 바깥 원 = `D × ratio`. UI 판단이다. 그 밖도 기능은 정상이므로 **실패시키지 않는다**.
 *
 * 권장 띠(도넛)는 `[D, 1.5D]` — 직선 ≥ D 이면 도로 ≥ D 가 보장되어(λ ≥ 1)
 * 「너무 가까움」 실패와 우리가 만드는 우회 중복이 원리적으로 없다.
 */
export const DISTANCE_AUTO_ROUTE_GUIDE_OUTER_RATIO = 1.5;

export type DistanceAutoRouteGuideRadii = {
  /**
   * 안쪽 원 반지름(km) = **D**.
   *
   * 도로거리 ≥ 직선거리(λ ≥ 1). 따라서 **직선거리 ≥ D 인 지점을 클릭하면
   * 도로거리 ≥ D 가 보장되고 「너무 가까움」 실패가 원리적으로 불가능하다.**
   * 추정이 아니라 부등식이므로 다른 값을 쓸 이유가 없다.
   */
  innerKm: number;
  /**
   * 바깥 원 반지름(km) = **1.5D**.
   * 권장 띠의 바깥 가장자리. 그 밖 클릭도 실패시키지 않는다(보통 offered).
   */
  outerKm: number;
};

/** 목표 거리(km) → 도넛 반지름. 퇴화 입력에서도 유한한 값을 준다. */
export function resolveDistanceAutoRouteGuideRadii(targetKm: number): DistanceAutoRouteGuideRadii {
  const n = Number(targetKm);
  const safe =
    Number.isFinite(n) && n > 0
      ? Math.min(DISTANCE_AUTO_ROUTE_KM_MAX, Math.max(DISTANCE_AUTO_ROUTE_KM_MIN, n))
      : DISTANCE_AUTO_ROUTE_KM_MIN;
  return {
    innerKm: safe,
    outerKm: safe * DISTANCE_AUTO_ROUTE_GUIDE_OUTER_RATIO,
  };
}