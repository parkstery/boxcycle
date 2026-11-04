import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { publicationWriteAffectsListing } from "./publicationListingCore.js";
import { recomputePublicationListing } from "./publicationListingStore.js";
import { REGION } from "./region.js";

/**
 * Publication 생성·수정·삭제 → 요약 목록 문서 재계산(G2).
 * 동행 켜기(`presenceEnabled`·`updatedAt` 만 바뀜)는 목록과 무관해 즉시 반환한다.
 * 이벤트 데이터가 아니라 원본을 다시 읽는다 — 순서가 뒤바뀐 이벤트가 옛 값으로 덮지 않게.
 */
export const publicationListingOnPublicationWritten = onDocumentWritten(
  {
    document: "routePublications/{publicationId}",
    region: REGION,
  },
  async (event) => {
    const publicationId = String((event.params as Record<string, string>).publicationId ?? "").trim();
    if (!publicationId) return;
    if (!publicationWriteAffectsListing(event.data?.before?.data(), event.data?.after?.data())) return;
    try {
      await recomputePublicationListing(getFirestore(), publicationId, resolveGeoRegion);
    } catch (e) {
      console.warn("[publicationListing] recompute failed", publicationId, e);
    }
  },
);
