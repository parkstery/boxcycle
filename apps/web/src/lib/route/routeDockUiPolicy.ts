import type { RideUiStage } from "../../hooks/useRideUiStage";

export type RouteDockUiPolicy = {
  isActiveRide: boolean;
  isPreRideReady: boolean;
  /** 주행 시작(또는 복원) 시 주소 카드를 접힌 상태로 두고 › 로 펼친다 — 숨기지 않는다 */
  collapseOnRideStart: boolean;
  /** 주행 중 — 경로 **편집** UI 숨김. 정보(경유지 목록)는 이 플래그로 숨기지 않는다 */
  ridingDiet: boolean;
  hideStopsList: boolean;
  /** 주행 중에는 경유지 삭제 등 경로 변형을 막는다(표시는 하되 조작만 잠금) */
  lockStopEditing: boolean;
};

export function isRouteDockActiveRide(stage: RideUiStage): boolean {
  return stage === "riding" || stage === "paused";
}

/** 주행·일시정지 화면에서 RouteDock 이 처음 보일 때 펼침 여부. 무경로는 LED만. */
export function routeDockDefaultExpanded(stage: RideUiStage, stopCount = 1): boolean {
  if (stopCount <= 0) return false;
  return !isRouteDockActiveRide(stage);
}

/**
 * RouteDock 이 화면에 나오는 stage — 표시 여부의 단일 진실.
 *
 * RouteDock 자신과, 「센서 칩을 어느 슬롯에 그릴지」를 정하는 `sensorChipSlot` 이
 * 같은 판정을 쓴다. 둘이 갈라지면 칩이 두 곳에 뜨거나(중복) 어느 곳에도 안 뜬다(소실).
 *
 * 2026-10-28: idle 포함 주행 가능 stage 는 모두 RouteDock. 접힘·무경로는 LED만,
 * 펼치면 접기 LED + 센서 알약. 숨기는 곳은 화면을 덮는 게이트와 결과 시트뿐이다.
 */
export function isRouteDockVisible(stage: RideUiStage): boolean {
  return stage !== "gate" && stage !== "gate-nickname" && stage !== "summary";
}

/**
 * RouteDock 주행 중 UI 정책 — 단일 진실(제품·계약 테스트 공유).
 *
 * 2026-09-28 Chief: 주행 시작 시 자동 접힘을 없앴다. 그때 dock 헤더에 Go·일시정지·종료가
 * 있어 접으면 멈추기 어려웠다. 조작부는 `RideControlBar` 로 옮겨 그 이유는 사라졌다.
 *
 * 2026-10-24 Chief: **숨기지 말고 접는다.** 주행 시작(또는 riding/paused 복원) 시 카드는
 * 접힌 상태(› 펼치기)로 두고, 사용자가 펼치면 경유지 정보는 그대로 보인다.
 * riding ↔ paused 는 사용자의 펼침 선택을 바꾸지 않는다.
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
  const isActiveRide = isRouteDockActiveRide(stage);
  const isPreRideReady = stage === "ready-to-start";
  const ridingDiet = isActiveRide;
  return {
    isActiveRide,
    isPreRideReady,
    collapseOnRideStart: true,
    ridingDiet,
    // 정보는 숨기지 않는다.
    hideStopsList: false,
    lockStopEditing: isActiveRide || editLocked,
  };
}
