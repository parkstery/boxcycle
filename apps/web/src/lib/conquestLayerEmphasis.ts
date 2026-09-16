/**
 * 「내 도로망」과 「설정된 경로선」 중 누가 위에 오는가 — 단계별 강조 판정.
 *
 * ## 왜 하나로 못 정하나
 *
 * 두 요구가 정면으로 충돌한다.
 *
 * - **주행 중**: 이미 내 것인 도로를 다시 달릴 때 내 도로망이 강한 빨강(#ef4444)에
 *   덮이면 안 된다. 그래서 2026-09 초에 궤적을 경로선 **위**로 올렸다.
 * - **경로 설정 중**: 그 순서 때문에 내 도로망이 커버한 구간에서 경로선이 통째로
 *   사라진다. 내 도로망은 z16 에서 7px·불투명도 0.95 인데 경로선은 4px 이라,
 *   1.75배 굵은 보라가 위에서 완전히 덮는다(2026-09-16 Chief).
 *
 * 하나의 순서로 둘 다 만족시키려니 한쪽이 죽었다. **단계마다 주인공이 다르다**:
 * 설정 중에는 지금 내가 만드는 경로가, 주행 중에는 획득이 주인공이다.
 *
 * 경로가 없는 화면(`idle`)에서는 낮출 이유가 없다 — 가릴 경로선 자체가 없고,
 * 내 도로망은 「넓은 맵에서 한눈에 보여야 한다」(rtwMapConfig).
 */

export type ConquestLayerEmphasisInput = {
  /** 주행·일시정지 중 */
  rideActive: boolean;
  /** 지도에 경로선이 올라와 있는가 */
  hasRoute: boolean;
};

export type ConquestLayerEmphasis = {
  /** 궤적(내 도로망·실시간)을 경로선 위로 올릴지 */
  tracesAboveRoute: boolean;
  /** 내 도로망(누적) 불투명도 */
  accumulatedOpacity: number;
};

/** 기본 — 내 도로망이 주인공(rtwMapConfig 의 RTW_TRACE_ACCUMULATED_PAINT 와 같은 값) */
export const CONQUEST_ACCUMULATED_OPACITY = 0.95;

/**
 * 경로 설정·확인 중 내 도로망 불투명도.
 * 0 이 아닌 이유: 「내가 이미 가진 도로」는 경로를 그리는 동안에도 유용한 배경 정보다.
 * 지우는 게 아니라 **배경으로 내리는 것**이다.
 */
export const CONQUEST_ACCUMULATED_OPACITY_DIMMED = 0.45;

export function conquestLayerEmphasis(
  input: ConquestLayerEmphasisInput,
): ConquestLayerEmphasis {
  const backgroundForRouteEditing = !input.rideActive && input.hasRoute;
  return backgroundForRouteEditing
    ? { tracesAboveRoute: false, accumulatedOpacity: CONQUEST_ACCUMULATED_OPACITY_DIMMED }
    : { tracesAboveRoute: true, accumulatedOpacity: CONQUEST_ACCUMULATED_OPACITY };
}
