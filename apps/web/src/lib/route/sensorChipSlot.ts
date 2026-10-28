import type { RideUiStage } from "../../hooks/useRideUiStage";

/** Sensor has one persistent location: RouteDock. The ride bar never owns it. */
export type SensorChipSlot = "route-dock" | "none";
export type SensorChipSlotInput = {
  stage: RideUiStage;
  hasCadence: boolean;
  /** Kept for callers that also render route disclosure; never affects the sensor. */
  expanded: boolean;
};
export function sensorChipSlot(input: SensorChipSlotInput): SensorChipSlot {
  const { stage, hasCadence } = input;
  // 인증 진입 및 결과에서는 센서 조작을 숨긴다.
  if (!hasCadence || stage === "gate" || stage === "gate-nickname" || stage === "summary") {
    return "none";
  }
  return "route-dock";
}
