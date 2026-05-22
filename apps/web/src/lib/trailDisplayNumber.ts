import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "./firestoreTrail";
import { TRAILHEAD_LABEL } from "./productTerms";

/** UI 표시용 Trail 번호 (1–999 → `001` … `999`) */
export function formatTrailDisplayNumber(displayNumber: number | null | undefined): string {
  if (displayNumber == null || !Number.isFinite(displayNumber)) return "???";
  const n = Math.max(1, Math.min(999, Math.floor(displayNumber)));
  return String(n).padStart(3, "0");
}

export type TrailDisplayMeta = { displayNumber: number } | null | undefined;

/** HUD·네임태그용 — `short`: `042` / `Trailhead`, `room`: `Trail 042` / `Trailhead` */
export function resolveTrailDisplayLabel(
  trailId: string,
  meta: TrailDisplayMeta,
): { short: string; room: string } {
  const tid = sanitizeTrailId(trailId);
  if (tid === DEFAULT_TRAIL_ID) {
    return { short: TRAILHEAD_LABEL, room: TRAILHEAD_LABEL };
  }
  const short = meta ? formatTrailDisplayNumber(meta.displayNumber) : tid.slice(0, 8);
  return { short, room: `Trail ${short}` };
}

/** Firestore Trail 문서용 표시 번호 (충돌 시 UI에서 구분은 `trailId`) */
export function pickRandomTrailDisplayNumber(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 999) + 1;
}
