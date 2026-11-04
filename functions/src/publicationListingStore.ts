/**
 * `publicationListings/{id}` 읽기·쓰기. 판정·투영 규칙은 `publicationListingCore.ts`(순수).
 * 트리거(`publicationListingProjection.ts`)와 채우기 CLI(`cliBackfillPublicationListings.ts`)가 함께 쓴다.
 */
import { FieldValue, type Firestore, Timestamp } from "firebase-admin/firestore";
import {
  buildPublicationListing,
  type GeoResolver,
  listingFieldsEqual,
  PUBLICATION_LISTINGS_COLLECTION,
  ROUTE_PUBLICATIONS_COLLECTION,
} from "./publicationListingCore.js";

export type RecomputePublicationListingResult = "upserted" | "unchanged" | "removed" | "absent";

/**
 * 원본 데이터로 목록 문서를 맞춘다. `source` 가 undefined 면 원본이 없는 것(삭제)으로 본다.
 * `apply=false` 면 쓰지 않고 결과만 돌려준다(채우기 dry-run).
 */
export async function syncPublicationListing(
  db: Firestore,
  publicationId: string,
  source: Record<string, unknown> | undefined,
  resolveGeo: GeoResolver,
  options: { apply?: boolean; existing?: Record<string, unknown> | undefined | null } = {},
): Promise<RecomputePublicationListingResult> {
  const apply = options.apply !== false;
  const ref = db.collection(PUBLICATION_LISTINGS_COLLECTION).doc(publicationId);
  const existing =
    options.existing !== undefined ? (options.existing ?? undefined) : (await ref.get()).data();
  const fields = buildPublicationListing(publicationId, source, resolveGeo);
  if (!fields) {
    if (!existing) return "absent";
    if (apply) await ref.delete();
    return "removed";
  }
  if (listingFieldsEqual(fields, existing)) return "unchanged";
  if (apply) {
    const createdAt = source?.createdAt instanceof Timestamp ? source.createdAt : (existing?.createdAt ?? Timestamp.now());
    await ref.set({ ...fields, createdAt, updatedAt: FieldValue.serverTimestamp() });
  }
  return "upserted";
}

/** 원본을 읽어 목록 문서를 맞춘다(트리거 경로). */
export async function recomputePublicationListing(
  db: Firestore,
  publicationId: string,
  resolveGeo: GeoResolver,
): Promise<RecomputePublicationListingResult> {
  const snap = await db.collection(ROUTE_PUBLICATIONS_COLLECTION).doc(publicationId).get();
  return syncPublicationListing(db, publicationId, snap.exists ? snap.data() : undefined, resolveGeo);
}
