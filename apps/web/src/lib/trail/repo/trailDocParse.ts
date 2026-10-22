/**
 * `trails/{id}` · `openTrailListings/{id}` 문서 → `TrailInstance` 공통 파싱.
 * firestoreTrailInstance 와 firestoreOpenTrailListings 가 같은 필드 규칙을 쓴다.
 */
import { resolvePublicationIdFromDoc } from "../../firebase/converters";
import type { TrailInstance } from "../trailTypes";

export function timestampToMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { toMillis?: () => number }).toMillis === "function"
  ) {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** trail 문서와 listing 문서가 같은 규칙으로 읽는 필드 */
export function parseTrailCoreFields(
  data: Record<string, unknown>,
): Pick<TrailInstance, "hostUid" | "displayNumber" | "publicationId" | "regionLabel" | "distanceKm"> {
  return {
    hostUid: typeof data.hostUid === "string" ? data.hostUid : "",
    displayNumber:
      typeof data.displayNumber === "number" && Number.isFinite(data.displayNumber)
        ? Math.max(1, Math.min(999, Math.floor(data.displayNumber)))
        : 1,
    publicationId: resolvePublicationIdFromDoc(data),
    regionLabel:
      typeof data.regionLabel === "string" && data.regionLabel.trim() ? data.regionLabel.trim() : null,
    distanceKm:
      typeof data.distanceKm === "number" && Number.isFinite(data.distanceKm) ? data.distanceKm : null,
  };
}

/** `trails/{id}` 문서 → TrailInstance (liveRiderCount 제외) */
export function parseTrailInstance(id: string, data: Record<string, unknown>): TrailInstance {
  return {
    id,
    ...parseTrailCoreFields(data),
    visibility: data.visibility === "private" ? "private" : "open",
    status:
      data.status === "archived"
        ? "archived"
        : data.status === "closed"
          ? "closed"
          : "open",
    createdAtMs: timestampToMs(data.createdAt),
    lastActivityAtMs: timestampToMs(data.lastActivityAt),
  };
}
