import type { RideUiStage } from "../../hooks/useRideUiStage";

/** Stages where RouteDock mounts (same predicate as RouteDock.tsx `visible`). */
export function isRouteDockStageVisible(stage: RideUiStage): boolean {
  return (
    stage === "setup" ||
    stage === "ready-to-start" ||
    stage === "riding" ||
    stage === "paused"
  );
}

/**
 * Cadence chip surface (UI-DECLUTTER-SENSOR-6A).
 * - RouteDock stages: chip lives in dock header (outside collapsible body).
 * - Otherwise (idle/gate/summary): MapHud top-right fallback when dock is absent
 *   (signed-out / map-only: stage is gate so dock does not show).
 */
export function resolveCadenceChipSurface(
  stage: RideUiStage,
): "route-dock" | "map-hud-tr" {
  return isRouteDockStageVisible(stage) ? "route-dock" : "map-hud-tr";
}

/**
 * 8-combo visibility: setup|ready-to-start|riding|paused x expanded true|false.
 * Chip is outside the collapsible body, so expanded must not hide it.
 */
export function isCadenceChipVisibleInRouteDock(
  stage: RideUiStage,
  _expanded: boolean,
): boolean {
  return resolveCadenceChipSurface(stage) === "route-dock";
}