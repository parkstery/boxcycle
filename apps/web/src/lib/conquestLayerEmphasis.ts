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
 * ## 주인공이 아니라고 지우지는 않는다
 *
 * 경로선에 흰 테두리를 둘러 분리하려던 시도(2026-09-16 1차)는 폐기했다. 테두리가
 * 내 도로망보다 굵어 **경로선은 살고 내 도로망이 죽었다** — 문제를 반대편으로 옮겼을
 * 뿐이다. 색을 덧대지 않고 **순서 + 폭 차이**로 둘을 동시에 읽히게 한다.
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
  /**
   * 내 도로망 선 폭의 하한(px). `null` 이면 기본 줌 보간 그대로.
   *
   * 경로선 **아래**로 깔리는 단계에서만 쓴다. 경로선은 줌과 무관하게 4px 고정인데
   * 내 도로망은 z12 에서 4px, z8 에서 2.8px 라 — 하한이 없으면 z12 이하에서
   * 경로선이 더 굵어 내 도로망이 통째로 사라진다(선을 지운 것과 같아진다).
   */
  accumulatedMinWidthPx: number | null;
};

/** 기본 — 내 도로망이 주인공(rtwMapConfig 의 RTW_TRACE_ACCUMULATED_PAINT 와 같은 값) */
export const CONQUEST_ACCUMULATED_OPACITY = 0.95;

/**
 * 경로 설정·확인 중 내 도로망 불투명도.
 * 0 이 아닌 이유: 「내가 이미 가진 도로」는 경로를 그리는 동안에도 유용한 배경 정보다.
 * 지우는 게 아니라 **배경으로 내리는 것**이다.
 */
export const CONQUEST_ACCUMULATED_OPACITY_DIMMED = 0.6;

/**
 * 경로 설정 중 내 도로망 폭 하한 — 경로선(4px) 양옆에 1.5px 씩 띠가 남는 값.
 * 흰 테두리(casing)로 경로선을 분리하려던 시도는 폐기했다: 테두리가 7.5px 라
 * 7px 내 도로망을 통째로 덮어, 경로선은 살고 내 도로망이 죽었다(2026-09-16 Chief).
 * 색을 덧대는 대신 **폭 차이**로 둘을 동시에 읽히게 한다.
 */
export const CONQUEST_ACCUMULATED_MIN_WIDTH_PX = 7;

export function conquestLayerEmphasis(
  input: ConquestLayerEmphasisInput,
): ConquestLayerEmphasis {
  const backgroundForRouteEditing = !input.rideActive && input.hasRoute;
  return backgroundForRouteEditing
    ? {
        tracesAboveRoute: false,
        accumulatedOpacity: CONQUEST_ACCUMULATED_OPACITY_DIMMED,
        accumulatedMinWidthPx: CONQUEST_ACCUMULATED_MIN_WIDTH_PX,
      }
    : {
        tracesAboveRoute: true,
        accumulatedOpacity: CONQUEST_ACCUMULATED_OPACITY,
        accumulatedMinWidthPx: null,
      };
}
