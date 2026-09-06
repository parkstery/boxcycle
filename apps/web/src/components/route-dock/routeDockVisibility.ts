import type { RideUiStage } from "../../hooks/useRideUiStage";

/** Stages where RouteDock mounts (same predicate as RouteDock.tsx `visible`). */
export function isRouteDockStageVisible(stage: RideUiStage): boolean {
  return (
    stage === "idle" ||
    stage === "setup" ||
    stage === "ready-to-start" ||
    stage === "riding" ||
    stage === "paused"
  );
}

/**
 * 10-combo visibility: idle|setup|ready-to-start|riding|paused x expanded true|false.
 * Chip lives in the always-visible top bar (outside collapsible panel).
 */
export function isCadenceChipVisibleInRouteDock(
  stage: RideUiStage,
  _expanded: boolean,
): boolean {
  return isRouteDockStageVisible(stage);
}
