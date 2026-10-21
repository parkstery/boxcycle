import type { RideUiStage } from "../../hooks/useRideUiStage";

/** Sensor has one persistent location, independent of route address disclosure. */
export type SensorChipSlot = "ride-control-bar" | "none";
export type SensorChipSlotInput = {
  stage: RideUiStage;
  hasCadence: boolean;
  /** Kept for callers that also render route disclosure; never affects the sensor. */
  expanded: boolean;
};
export function sensorChipSlot(input: SensorChipSlotInput): SensorChipSlot {
  const {stage, hasCadence} = input;
  return hasCadence && stage !== "gate" && stage !== "gate-nickname" && stage !== "summary"
    ? "ride-control-bar" : "none";
}
