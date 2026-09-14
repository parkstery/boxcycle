import type { RideUiStage } from "../hooks/useRideUiStage";

export type RouteDockUiPolicy = {
  isActiveRide: boolean;
  isPreRideReady: boolean;
  /** 주행 중 — 경로 **편집** UI 숨김. 정보(경유지 목록)는 이 플래그로 숨기지 않는다 */
  ridingDiet: boolean;
  /** Go 직전 — 저장·삭제는 MENU 로 유도 */
  preRideCompact: boolean;
  hideEditActions: boolean;
  hideStopsList: boolean;
  /** 주행 중에는 경유지 삭제 등 경로 변형을 막는다(표시는 하되 조작만 잠금) */
  lockStopEditing: boolean;
  /** riding/paused 진입 시 패널 자동 접힘 */
  autoCollapse: boolean;
};

/**
 * RouteDock 주행 중 편집 UI 접기 — 단일 진실(제품·계약 테스트 공유).
 *
 * 의도는 **지도를 가리는 면적을 줄이는 것**이지 정보를 없애는 것이 아니다.
 * 따라서 주행 중 동작은 두 가지로 분리한다:
 *   - `autoCollapse`  주행 시작 시 패널을 접는다 → 지도 가림 최소화
 *   - `ridingDiet`    펼쳤을 때 **편집** UI(저장·삭제·경유지 삭제)만 뺀다
 * 경유지 목록 같은 **정보는 펼치면 그대로 보여야 한다** — 접기로만 감춘다.
 * (2026-09-15: ridingDiet 가 목록까지 숨겨 펼친 패널이 빈 껍데기가 되던 것을 수정)
 */
export function routeDockUiPolicy(
  stage: RideUiStage,
  editLocked = false,
): RouteDockUiPolicy {
  const isActiveRide = stage === "riding" || stage === "paused";
  const isPreRideReady = stage === "ready-to-start";
  const ridingDiet = isActiveRide;
  const preRideCompact = isPreRideReady;
  return {
    isActiveRide,
    isPreRideReady,
    ridingDiet,
    preRideCompact,
    hideEditActions: ridingDiet || preRideCompact || editLocked,
    // 정보는 숨기지 않는다 — 가림 최소화는 autoCollapse 가 담당한다.
    hideStopsList: false,
    lockStopEditing: isActiveRide || editLocked,
    autoCollapse: isActiveRide,
  };
}
