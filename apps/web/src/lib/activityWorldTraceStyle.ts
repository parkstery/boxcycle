/** Activity World 라이브·흔적 — 사용자 경로·Trail과 동일한 red 계열 */
export const ACTIVITY_TRACE_RED = "#dc2626";

/** 라이브 = 100% */
export const ACTIVITY_TRACE_LIVE_STRENGTH = 1;

/** heat 시작 opacity (오늘 주행, transparency 30%) */
export const ACTIVITY_TRACE_HEAT_OPACITY_START = 0.7;

/** heat 하루 경과마다 opacity 감소량 */
export const ACTIVITY_TRACE_HEAT_OPACITY_DECAY_PER_DAY = 0.1;

/** heat 최소 opacity (6일차) */
export const ACTIVITY_TRACE_HEAT_OPACITY_FLOOR = 0.1;

/** heat 표시 윈도 — `recentRideCount7d`·reconcile 과 맞춤 */
export const ACTIVITY_TRACE_HEAT_MAX_AGE_DAYS = 7;

/** @deprecated — {@link resolveHeatTraceStrength} 일 단위 decay 사용 */
export const ACTIVITY_TRACE_TODAY_STRENGTH = ACTIVITY_TRACE_HEAT_OPACITY_START;

/** @deprecated */
export const ACTIVITY_TRACE_WEEK_STRENGTH = 0.5;

/** @deprecated */
export const ACTIVITY_TRACE_OLDER_STRENGTH = ACTIVITY_TRACE_HEAT_OPACITY_FLOOR;

const MS_PER_DAY = 86_400_000;

/**
 * `courseActivity.updatedAt` 기준 heat 선·점 강도.
 * 라이브는 항상 {@link ACTIVITY_TRACE_LIVE_STRENGTH}.
 *
 * 오늘 0.7 → 하루마다 0.1 감소 → 7일 이상 0 (미표시).
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
    return ACTIVITY_TRACE_HEAT_OPACITY_START;
  }
  const ageMs = Math.max(0, nowMs - updatedAtMs);
  const ageDays = Math.floor(ageMs / MS_PER_DAY);
  if (ageDays >= ACTIVITY_TRACE_HEAT_MAX_AGE_DAYS) return 0;
  const opacity =
    ACTIVITY_TRACE_HEAT_OPACITY_START - ageDays * ACTIVITY_TRACE_HEAT_OPACITY_DECAY_PER_DAY;
  return Math.max(ACTIVITY_TRACE_HEAT_OPACITY_FLOOR, opacity);
}
