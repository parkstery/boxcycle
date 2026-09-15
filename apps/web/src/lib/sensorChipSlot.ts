import type { RideUiStage } from "../hooks/useRideUiStage";
import { isRouteDockVisible } from "./routeDockUiPolicy";

/**
 * 센서 칩이 그려지는 자리 — **정확히 한 곳**이거나 아무 곳도 아니다.
 *
 * - `route-dock`  RouteDock 접이식 틀의 항상 보이는 행(경로 → 센서 → Go)
 * - `map-hud-tr`  우상단 폴백. RouteDock 이 아예 없는 stage(`idle` 등)에서만.
 * - `none`        게이트·결과 시트 등 칩 자체를 숨기는 상태
 *
 * ⚠ 폴백이 필요한 이유(UI-DECLUTTER-SENSOR-6A §4.3 확인 결과):
 * 센서 시트는 「체험 속도로 준비」의 **유일한** 입구이고 그것이 Go 의 사전조건이다.
 * 그런데 `idle`(경로 없음 = 앱 첫 화면)에는 RouteDock 이 없다 — 칩을 dock 전용으로
 * 두면 그 화면에서 주행 입력을 준비할 방법이 사라진다. 그래서 dock 이 없는 stage 에만
 * 우상단을 남긴다. 「우상단 3개 → 2개」는 dock 이 있는 네 stage 에서 성립한다.
 */
export type SensorChipSlot = "route-dock" | "map-hud-tr" | "none";

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
  return isRouteDockVisible(stage) ? "route-dock" : "map-hud-tr";
}
