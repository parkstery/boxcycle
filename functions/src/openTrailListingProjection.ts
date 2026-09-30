import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from "firebase-functions/v2/firestore";
import { recomputeOpenTrailListing } from "./openTrailListingCore.js";
import { REGION } from "./region.js";

function trailIdFromParams(params: Record<string, string>): string {
  return typeof params.trailId === "string" ? params.trailId.trim() : "";
}

async function runRecompute(trailId: string): Promise<void> {
  if (!trailId || trailId === "default") return;
  try {
    await recomputeOpenTrailListing(trailId);
  } catch (e) {
    console.warn("[openTrailListing] recompute failed", trailId, e);
  }
}

async function recomputeListingForTrailParams(params: Record<string, string>): Promise<void> {
  await runRecompute(trailIdFromParams(params));
}

/** Trail 메타·활동 시각 변경 → listing 재계산 (throttled lastActivityAt 포함) */
export const openTrailListingOnTrailWritten = onDocumentWritten(
  {
    document: "trails/{trailId}",
    region: REGION,
  },
  async (event) => {
    await recomputeListingForTrailParams(event.params as Record<string, string>);
  },
);

/** 합류 즉시 반영 — update 는 트리거 자체가 발생하지 않음 */
export const openTrailListingOnMemberCreated = onDocumentCreated(
  {
    document: "trails/{trailId}/members/{userId}",
    region: REGION,
  },
  async (event) => {
    await recomputeListingForTrailParams(event.params as Record<string, string>);
  },
);

/** 이탈 즉시 반영 */
export const openTrailListingOnMemberDeleted = onDocumentDeleted(
  {
    document: "trails/{trailId}/members/{userId}",
    region: REGION,
  },
  async (event) => {
    await recomputeListingForTrailParams(event.params as Record<string, string>);
  },
);

/** 라이브 라이드 doc 생성 즉시 반영 — 하트비트 update 는 CF 미호출 */
export const openTrailListingOnLiveCourseRideCreated = onDocumentCreated(
  {
    document: "trails/{trailId}/livePublicationRides/{uid}",
    region: REGION,
  },
  async (event) => {
    await recomputeListingForTrailParams(event.params as Record<string, string>);
  },
);

/** 라이브 라이드 doc 삭제 즉시 반영 */
export const openTrailListingOnLiveCourseRideDeleted = onDocumentDeleted(
  {
    document: "trails/{trailId}/livePublicationRides/{uid}",
    region: REGION,
  },
  async (event) => {
    await recomputeListingForTrailParams(event.params as Record<string, string>);
  },
);
