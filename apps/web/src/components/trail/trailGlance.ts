import { sanitizeTrailId, DEFAULT_TRAIL_ID } from "../../lib/trail/repo/firestoreTrail";
import type { TrailInstance } from "../../lib/trail/repo/firestoreTrailInstance";
import { compareOpenTrailsForListing, isActiveOpenTrailListing } from "../../lib/trail/repo/firestoreOpenTrailListings";
import { TRAIL_LABEL } from "../../lib/terms/productTerms";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";

/**
 * 지금 달리는 Trail 목록 — 메뉴 패널의 개수와 지도 오른쪽 목록이 같은 규칙으로 고른다.
 * 열린 공개 Trail만, 주행 중이면 내 Trail(목록에 없더라도)을 맨 위에, 대기 중이면 내 Trail은 뺀다.
 */
export function listOpenTrailsForDisplay(
  openTrails: TrailInstance[],
  activeTrailId: string,
  currentTrail: TrailInstance | null,
  rideSessionActive: boolean,
): TrailInstance[] {
  const active = sanitizeTrailId(activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;
  const open = openTrails
    .filter((t) => t.status === "open" && t.visibility === "open" && isActiveOpenTrailListing(t))
    .sort(compareOpenTrailsForListing);
  if (rideSessionActive) {
    if (!onTrailhead && currentTrail?.id === active && !open.some((t) => t.id === active)) {
      return [currentTrail, ...open];
    }
    return open;
  }
  return open.filter((t) => t.id !== active);
}

export function trailDisplayName(t: TrailInstance): string {
  const region = t.regionLabel?.trim();
  return region || `${TRAIL_LABEL} ${formatTrailDisplayNumber(t.displayNumber)}`;
}

export function trailKmLabel(t: TrailInstance): string | null {
  if (t.distanceKm == null || !Number.isFinite(t.distanceKm)) return null;
  return `${t.distanceKm.toFixed(1)}`;
}

export function trailRiderCount(t: TrailInstance): number | null {
  return t.liveRiderCount != null && Number.isFinite(t.liveRiderCount) ? t.liveRiderCount : null;
}

export function trailRowLabel(t: TrailInstance): string {
  const parts: string[] = [trailDisplayName(t)];
  if (t.regionLabel?.trim()) parts.push(`${TRAIL_LABEL} ${formatTrailDisplayNumber(t.displayNumber)}`);
  const km = trailKmLabel(t);
  if (km) parts.push(`${km} km`);
  const riders = trailRiderCount(t);
  if (riders != null) parts.push(`주행 중 ${riders}명`);
  parts.push(t.visibility === "private" ? "비공개" : "공개");
  return parts.join(", ");
}

export { shortTrailPlace } from "../../lib/trail/shortTrailPlace";
