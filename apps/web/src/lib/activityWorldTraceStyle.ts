/** Activity World 라이브·흔적 — 사용자 경로·Trail과 동일한 red 계열 */
export const ACTIVITY_TRACE_RED = "#dc2626";

/** heat dot·line 표시 윈도 — 최근 24시간 */
export const ACTIVITY_TRACE_HEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 주행 중 — 투명 0% (opacity 100%) */
export const ACTIVITY_TRACE_LIVE_OPACITY = 1;

/** @deprecated {@link ACTIVITY_TRACE_LIVE_OPACITY} */
export const ACTIVITY_TRACE_LIVE_STRENGTH = ACTIVITY_TRACE_LIVE_OPACITY;

/** 주행 완료 — 투명 30% (opacity 70%) */
export const ACTIVITY_TRACE_COMPLETED_OPACITY = 0.7;

export function isWithinActivityTraceHeatWindow(
  activityAtMs: number | null,
  nowMs: number = Date.now(),
): boolean {
  if (activityAtMs == null || !Number.isFinite(activityAtMs)) return false;
  return Math.max(0, nowMs - activityAtMs) < ACTIVITY_TRACE_HEAT_WINDOW_MS;
}

/** `courseActivity.updatedAt` 기준 — 24시간 이내만 completed opacity, 그 외 미표시 */
export function resolveHeatTraceStrength(
  updatedAtMs: number | null,
  nowMs: number = Date.now(),
): number {
  return isWithinActivityTraceHeatWindow(updatedAtMs, nowMs)
    ? ACTIVITY_TRACE_COMPLETED_OPACITY
    : 0;
}

/** closed publication presence — `closedAt` 기준 동일 규칙 */
export function resolveClosedPresenceOpacity(
  closedAtMs: number | null,
  nowMs: number = Date.now(),
): number {
  return isWithinActivityTraceHeatWindow(closedAtMs, nowMs)
    ? ACTIVITY_TRACE_COMPLETED_OPACITY
    : 0;
}
