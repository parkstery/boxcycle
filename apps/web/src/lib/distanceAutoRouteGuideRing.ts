import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
} from "./distanceAutoRouteErrors";

/**
 * 클릭 권장 범위(도넛) — 5A-R2 §2.
 *
 * 3F-C-R1 이 도넛을 폐기했던 근거(「직선 비율과 도로거리 사이에 단조 관계가 없다」)는
 * 지금도 참이다. 문제였던 것은 **추측한 고정 비율을 실패를 결정하는 hard gate 로 쓴 것**이다.
 * 이번 도넛은 성격이 다르다 — 바깥은 **부등식**, 안쪽은 **실측**, 역할은 **안내**다.
 */

/**
 * 안쪽 원 = `D / λ_max`. `λ_max` 는 실측에서 온다.
 *
 * 강남 실측(5A-1 24 표본, 자동차): λ = 도로거리/직선거리 가 1.2~2.0 으로 흩어지고
 * 400 m 표본의 λ 는 1.23~1.54 다. 감리 참고값(5 km 표본 p75 = 1.54)과도 맞는다.
 * **보수적으로 1.5** 를 쓴다 — 안쪽 원을 너무 크게 잡으면 성공할 수 있는 지점을
 * 「너무 가깝다」고 잘못 안내하게 된다.
 *
 * 이 값은 **안내용**이지 판정용이 아니다. 실제 실패 판정은 서버가 실측 도로거리로 한다.
 */
export const DISTANCE_AUTO_ROUTE_GUIDE_INNER_RATIO = 1.5;

export type DistanceAutoRouteGuideRadii = {
  /** 안쪽 원 반지름(km) — 이 안은 실패 가능성이 높다 */
  innerKm: number;
  /**
   * 바깥 원 반지름(km) = **D**.
   *
   * 도로거리는 직선거리보다 항상 크거나 같다(λ ≥ 1). 따라서 **직선거리 ≥ D 인 지점을
   * 클릭하면 도로거리 ≥ D 가 보장되고 「너무 가까움」 실패가 원리적으로 불가능하다.**
   * 추정이 아니라 부등식이므로 다른 값을 쓸 이유가 없다.
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
  return { innerKm: safe / DISTANCE_AUTO_ROUTE_GUIDE_INNER_RATIO, outerKm: safe };
}
