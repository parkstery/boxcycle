import type { DocumentSnapshot } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { recomputeOpenTrailListing } from "./openTrailListingCore.js";
import { REGION } from "./region.js";

function trailIdFromParams(params: Record<string, string>): string {
  return typeof params.trailId === "string" ? params.trailId.trim() : "";
}

/**
 * 멤버·livePublicationRides 공통 — create/delete 만 listing 즉시 재계산.
 * update(하트비트 등)는 `openTrailListingOnTrailWritten`(throttled lastActivityAt)에 맡긴다.
 */
export function isSubcollectionCreateOrDelete(
  before: DocumentSnapshot | undefined,
  after: DocumentSnapshot | undefined,
): boolean {
  const had = Boolean(before?.exists);
  const has = Boolean(after?.exists);
  return had !== has;
}

async function runRecompute(trailId: string): Promise<void> {
  if (!trailId || trailId === "default") return;
  try {
    await recomputeOpenTrailListing(trailId);
  } catch (e) {
    console.warn("[openTrailListing] recompute failed", trailId, e);
  }
}

/** Trail 메타·활동 시각 변경 → listing 재계산 */
export const openTrailListingOnTrailWritten = onDocumentWritten(
  {
    document: "trails/{trailId}",
    region: REGION,
  },
  async (event) => {
    const trailId = trailIdFromParams(event.params as Record<string, string>);
    await runRecompute(trailId);
  },
);

/** 합류·이탈 즉시 반영 */
export const openTrailListingOnMemberWritten = onDocumentWritten(
  {
    document: "trails/{trailId}/members/{userId}",
    region: REGION,
  },
  async (event) => {
    const trailId = trailIdFromParams(event.params as Record<string, string>);
    if (!isSubcollectionCreateOrDelete(event.data?.before, event.data?.after)) return;
    await runRecompute(trailId);
  },
);

/** 라이브 라이드 생성·삭제만 즉시 반영 — 진행 하트비트(~1Hz) update 는 스킵 */
export const openTrailListingOnLiveCourseRideWritten = onDocumentWritten(
  {
    document: "trails/{trailId}/livePublicationRides/{uid}",
    region: REGION,
  },
  async (event) => {
    const trailId = trailIdFromParams(event.params as Record<string, string>);
    if (!isSubcollectionCreateOrDelete(event.data?.before, event.data?.after)) return;
    await runRecompute(trailId);
  },
);
