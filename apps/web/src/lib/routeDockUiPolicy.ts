import type { RideUiStage } from "../hooks/useRideUiStage";

export type RouteDockUiPolicy = {
  isActiveRide: boolean;
  isPreRideReady: boolean;
  /** 주행 중 — 경로 편집·경유지 목록 숨김 */
  ridingDiet: boolean;
  /** Go 직전 — 저장·삭제는 MENU 로 유도 */
  preRideCompact: boolean;
  hideEditActions: boolean;
  hideStopsList: boolean;
  /** riding/paused 진입 시 패널 자동 접힘 */
  autoCollapse: boolean;
};

/** RouteDock 주행 중 편집 UI 접기 — 단일 진실(제품·계약 테스트 공유) */
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
    hideStopsList: ridingDiet,
    autoCollapse: isActiveRide,
  };
}
