import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "./firestoreTrail";

/** 세션 내 Trail id → `displayNumber` — fetch·seed 전에도 HUD·네임태그에 번호 즉시 표시 */
const displayNumberByTrailId = new Map<string, number>();

export function rememberTrailDisplayNumber(trailId: string, displayNumber: number): void {
  const tid = sanitizeTrailId(trailId);
  if (tid === DEFAULT_TRAIL_ID || !Number.isFinite(displayNumber)) return;
  displayNumberByTrailId.set(tid, Math.max(1, Math.min(999, Math.floor(displayNumber))));
}

export function readTrailDisplayNumberCache(trailId: string): number | undefined {
  return displayNumberByTrailId.get(sanitizeTrailId(trailId));
}

export function forgetTrailDisplayNumber(trailId: string): void {
  displayNumberByTrailId.delete(sanitizeTrailId(trailId));
}

/** 테스트·Trailhead 복귀 */
export function clearTrailDisplayNumberCache(): void {
  displayNumberByTrailId.clear();
}
