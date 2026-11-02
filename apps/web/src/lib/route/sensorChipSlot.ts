import type { RideUiStage } from "../../hooks/useRideUiStage";

/**
 * 센서는 한 자리에만 그린다 — Chief 11-02 v4(B단계): 계기판 맨 앞 칸(`hud`).
 * 두 곳에 뜨면 getByRole 이 strict 위반으로 깨지고, 어디에도 없으면 「센서 없음」에 닿지 못해 Go 가 잠긴다.
 */
export type SensorChipSlot = "hud" | "none";
export type SensorChipSlotInput = {
  stage: RideUiStage;
  hasCadence: boolean;
};
export function sensorChipSlot(input: SensorChipSlotInput): SensorChipSlot {
  const { stage, hasCadence } = input;
  // 인증 진입 및 결과에서는 센서 조작을 숨긴다.
  if (!hasCadence || stage === "gate" || stage === "gate-nickname" || stage === "summary") {
    return "none";
  }
  return "hud";
}
