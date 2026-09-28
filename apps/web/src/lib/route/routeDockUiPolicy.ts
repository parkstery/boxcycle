import type { RideUiStage } from "../../hooks/useRideUiStage";

export type RouteDockUiPolicy = {
  isActiveRide: boolean;
  isPreRideReady: boolean;
  /** 주행 중 — 경로 **편집** UI 숨김. 정보(경유지 목록)는 이 플래그로 숨기지 않는다 */
  ridingDiet: boolean;
  hideStopsList: boolean;
  /** 주행 중에는 경유지 삭제 등 경로 변형을 막는다(표시는 하되 조작만 잠금) */
  lockStopEditing: boolean;
};

/**
 * RouteDock 이 화면에 나오는 stage — 표시 여부의 단일 진실.
 *
 * RouteDock 자신과, 「센서 칩을 어느 슬롯에 그릴지」를 정하는 `sensorChipSlot` 이
 * 같은 판정을 쓴다. 둘이 갈라지면 칩이 두 곳에 뜨거나(중복) 어느 곳에도 안 뜬다(소실).
 *
 * 2026-09-16: `idle` 추가. 센서 칩이 dock 에 사는데 경로 없는 첫 화면에만 dock 이 없어
 * 우상단 폴백을 따로 들고 있어야 했다 — 그 stage 하나 때문에 칩이 두 자리를 오갔다.
 * 숨기는 곳은 화면을 덮는 게이트와 결과 시트뿐이다.
 */
export function isRouteDockVisible(stage: RideUiStage): boolean {
  return stage !== "gate" && stage !== "gate-nickname" && stage !== "summary";
}

/**
 * RouteDock 주행 중 UI 정책 — 단일 진실(제품·계약 테스트 공유).
 *
 * 2026-09-28 Chief: **주행 시작 시 자동 접힘을 없앤다.** dock 헤더가 Go·일시정지·종료
 * 버튼 자리가 되었으므로, 접어 버리면 멈추려는 사용자가 버튼을 찾지 못한다.
 * 접는 판단은 사용자에게 맡긴다 — 위치가 고정되어 있어야 몸이 기억한다.
 * (종전 `autoCollapse` 필드는 이 결정과 함께 삭제. 「지도 가림 최소화」는 사용자의 접기로.)
 *
 * 저장·삭제는 dock 에서 빠졌다(각각 주행 결과 시트·경로 설정 팝업이 단일 창구).
 * 그래서 `hideEditActions`·`preRideCompact` 도 함께 삭제했다 — 숨길 대상이 없다.
 * 남은 주행 중 동작은 `ridingDiet`(편집성 보조 UI 제거)와 `lockStopEditing`(조작 잠금)뿐.
 * 경유지 목록 같은 **정보는 펼치면 그대로 보여야 한다**.
 */
export function routeDockUiPolicy(
  stage: RideUiStage,
  editLocked = false,
): RouteDockUiPolicy {
  const isActiveRide = stage === "riding" || stage === "paused";
  const isPreRideReady = stage === "ready-to-start";
  const ridingDiet = isActiveRide;
  return {
    isActiveRide,
    isPreRideReady,
    ridingDiet,
    // 정보는 숨기지 않는다.
    hideStopsList: false,
    lockStopEditing: isActiveRide || editLocked,
  };
}
