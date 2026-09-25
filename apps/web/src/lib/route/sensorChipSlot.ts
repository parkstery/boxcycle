import type { RideUiStage } from "../../hooks/useRideUiStage";
import { isRouteDockVisible, routeDockUiPolicy } from "./routeDockUiPolicy";

/**
 * 센서 신호가 그려지는 자리 — RouteDock 아니면 없음.
 *
 * - `route-dock-chip`   접이식 틀의 항상 보이는 첫 행에 센서 칩(rpm·상태 텍스트)
 * - `route-dock-caret`  접혀서 칩이 빠진 자리 — 캐럿 폭에 **LED 로 연결만** 표시
 * - `none`              게이트·결과 시트 등 dock 자체가 없거나, 센서 상태가 없는 경우
 *
 * 2026-09-16: 우상단 폴백(`map-hud-tr`) 제거. 폴백이 있던 이유는 `idle` 에 dock 이
 * 없어서였는데 — 센서 시트가 「센서 없음」의 유일한 입구이고 그것이 Go 의
 * 사전조건이라 그 화면에서 칩이 사라지면 주행을 시작할 수 없다 — dock 을 `idle` 에도
 * 띄우면서(`isRouteDockVisible`) 근거가 사라졌다. 이제 우상단은 **모든 stage 에서**
 * 계정·맵 둘뿐이다.
 *
 * 2026-09-26: 판정이 두 곳에 있던 것을 여기로 모았다. 이 모듈은 2갈래(`route-dock`·
 * `none`)만 알았고, 제품(`RouteDock`)은 그 사이 **접힘 캐럿 LED** 라는 세 번째 갈래를
 * 인라인으로 갖게 됐다(09-23 `c66699a`). 모듈을 아무도 호출하지 않았으므로 갈라진 것을
 * 아무것도 알아채지 못했고, 계약 시험만이 **자기 자신을 소비자로 둔 축퇴**가 됐다.
 * 이제 `RouteDock` 이 이 함수를 호출한다 — 갈라질 자리를 없앤 것이 요점이다.
 */
export type SensorChipSlot = "route-dock-chip" | "route-dock-caret" | "none";

export type SensorChipSlotInput = {
  stage: RideUiStage;
  /** App 이 센서 상태를 넘겼는가(null 이면 신호 자체가 없다) */
  hasCadence: boolean;
  /** dock 패널이 펼쳐져 있는가 — 접힘은 칩 대신 캐럿 LED 로 간다 */
  expanded: boolean;
};

export type SensorChipSlotView = {
  /**
   * 주행 중 접힘 — 칩(텍스트)을 빼고 캐럿 폭만 남긴다(20260923-minimap 지시01 §3).
   * 레이아웃 클래스 `route-dock-anchor--ride-collapsed` 의 근거이기도 하다.
   */
  rideCollapsed: boolean;
  /**
   * 첫 화면(idle) 접힘 — 펼쳐 봐야 빈 목록뿐이라 캐럿을 누르면 **센서 시트를 연다**
   * (지시04 §A, D7). 레이아웃 클래스 `route-dock-anchor--caret-only` 의 근거.
   */
  preRouteCollapsed: boolean;
  /** 둘 중 하나라도 참 — 칩이 아니라 캐럿 LED 로 간다 */
  caretOnly: boolean;
  slot: SensorChipSlot;
};

/**
 * 접힘 형태와 센서 자리를 **한 번에** 정한다.
 *
 * 접힘 여부는 레이아웃 클래스와 센서 자리의 **공통 원인**이다. 따로 계산하면
 * 09-23 처럼 한쪽만 바뀌어 조용히 갈라진다.
 */
export function sensorChipSlotView(input: SensorChipSlotInput): SensorChipSlotView {
  const { stage, hasCadence, expanded } = input;
  const { isActiveRide } = routeDockUiPolicy(stage);

  const rideCollapsed = isActiveRide && !expanded;
  const preRouteCollapsed = stage === "idle" && hasCadence;
  const caretOnly = rideCollapsed || preRouteCollapsed;

  let slot: SensorChipSlot = "none";
  if (hasCadence && isRouteDockVisible(stage)) {
    slot = caretOnly ? "route-dock-caret" : "route-dock-chip";
  }
  return { rideCollapsed, preRouteCollapsed, caretOnly, slot };
}

export function sensorChipSlot(input: SensorChipSlotInput): SensorChipSlot {
  return sensorChipSlotView(input).slot;
}
