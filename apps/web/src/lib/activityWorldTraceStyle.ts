/** Activity World 라이브·흔적 — 사용자 경로·Trail과 동일한 red 계열 */
export const ACTIVITY_TRACE_RED = "#dc2626";

/** 라이브 = 100% */
export const ACTIVITY_TRACE_LIVE_STRENGTH = 1;

/** 오늘(24h 이내) 흔적 */
export const ACTIVITY_TRACE_TODAY_STRENGTH = 0.8;

/** 지난 7일 흔적(오늘 제외 구간) */
export const ACTIVITY_TRACE_WEEK_STRENGTH = 0.5;

/** 7일 이전 흔적 */
export const ACTIVITY_TRACE_OLDER_STRENGTH = 0.3;

const MS_PER_DAY = 86_400_000;

/**
 * `courseActivity.updatedAt` 기준 heat 선·점 강도(0.3 | 0.5 | 0.8).
 * 라이브는 항상 {@link ACTIVITY_TRACE_LIVE_STRENGTH}.
 */
/** closed publication presence — `closedAt` 기준 fade (260523 설계 §5.2) */
export function resolveClosedPresenceOpacity(
  closedAtMs: number | null,
  nowMs: number = Date.now(),
): number {
  if (closedAtMs == null || !Number.isFinite(closedAtMs)) return ACTIVITY_TRACE_WEEK_STRENGTH;
  const ageMs = Math.max(0, nowMs - closedAtMs);
  if (ageMs < MS_PER_DAY) return 0.85;
  if (ageMs < 7 * MS_PER_DAY) return 0.55;
  if (ageMs < 30 * MS_PER_DAY) return 0.3;
  return 0.1;
}

export function resolveHeatTraceStrength(
  updatedAtMs: number | null,
  nowMs: number = Date.now(),
): number {
  if (updatedAtMs == null || !Number.isFinite(updatedAtMs)) {
    return ACTIVITY_TRACE_WEEK_STRENGTH;
  }
  const ageMs = Math.max(0, nowMs - updatedAtMs);
  if (ageMs < MS_PER_DAY) return ACTIVITY_TRACE_TODAY_STRENGTH;
  if (ageMs < 7 * MS_PER_DAY) return ACTIVITY_TRACE_WEEK_STRENGTH;
  return ACTIVITY_TRACE_OLDER_STRENGTH;
}
