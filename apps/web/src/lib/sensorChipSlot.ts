import type { RideUiStage } from "../hooks/useRideUiStage";
import { isRouteDockVisible } from "./routeDockUiPolicy";

/**
 * 센서 칩이 그려지는 자리 — RouteDock 아니면 없음.
 *
 * - `route-dock`  RouteDock 접이식 틀의 항상 보이는 첫 행(경로 → 센서 → Go)
 * - `none`        게이트·결과 시트 등 칩 자체를 숨기는 상태
 *
 * 2026-09-16: 우상단 폴백(`map-hud-tr`) 제거. 폴백이 있던 이유는 `idle` 에 dock 이
 * 없어서였는데 — 센서 시트가 「체험 속도로 준비」의 유일한 입구이고 그것이 Go 의
 * 사전조건이라 그 화면에서 칩이 사라지면 주행을 시작할 수 없다 — dock 을 `idle` 에도
 * 띄우면서(`isRouteDockVisible`) 근거가 사라졌다. 이제 우상단은 **모든 stage 에서**
 * 계정·맵 둘뿐이다.
 */
export type SensorChipSlot = "route-dock" | "none";

export type SensorChipSlotInput = {
  stage: RideUiStage;
  /** App 이 센서 상태를 넘겼는가(null 이면 칩 자체가 없다) */
  hasCadence: boolean;
  /** 인증 게이트가 화면을 덮고 있는가 */
  isGate: boolean;
  /** 주행 결과 시트가 떠 있는가 */
  isSummary: boolean;
};

export function sensorChipSlot(input: SensorChipSlotInput): SensorChipSlot {
  const { stage, hasCadence, isGate, isSummary } = input;
  if (!hasCadence || isGate || isSummary) return "none";
  return isRouteDockVisible(stage) ? "route-dock" : "none";
}
