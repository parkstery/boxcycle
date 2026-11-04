import {
  type DocumentData,
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";

import { PUBLICATION_LISTINGS_COLLECTION } from "./publicationListingCore.js";
import { TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION } from "./trailPaths.js";

export const TRAILS_COLLECTION = "trails";
export const OPEN_TRAIL_LISTINGS_COLLECTION = "openTrailListings";
const MEMBERS_SUB = "members";
const LIVE_SUB = TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION;

/** 클라이언트 `TRAIL_PRESENCE_STALE_MS` 와 동일 */
export const TRAIL_PRESENCE_STALE_MS = 240_000;

/**
 * listing `updatedAt` 이 이보다 오래되면 sweeper 가 삭제.
 * 앱의 listing 갱신 간격(`TRAIL_ACTIVITY_TOUCH_MIN_INTERVAL_MS` 110초)보다 길어야 한다 — 짧으면 달리는
 * Trail 이 목록에서 깜빡인다. 앱의 목록 판정과 같은 240초로 맞춘다(비용 L9).
 */
export const OPEN_TRAIL_LISTING_STALE_MS = TRAIL_PRESENCE_STALE_MS;

export type RecomputeOpenTrailListingResult = "upserted" | "removed" | "skipped";

type TrailMeta = {
  id: string;
  hostUid: string;
  displayNumber: number;
  publicationId: string | null;
  regionLabel: string | null;
  distanceKm: number | null;
  visibility: "open" | "private";
  status: "open" | "closed" | "archived";
};

function resolveTrailPublicationId(data: DocumentData | undefined): string | null {
  if (!data) return null;
  const publicationId =
    typeof data.publicationId === "string" && data.publicationId.trim()
      ? data.publicationId.trim()
      : "";
  return publicationId || null;
}

function presenceCutoff(): Timestamp {
  return Timestamp.fromMillis(Date.now() - TRAIL_PRESENCE_STALE_MS);
}

function timestampMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (raw instanceof Timestamp) return raw.toMillis();
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

function parseTrailMeta(trailId: string, data: DocumentData | undefined): TrailMeta | null {
  if (!data) return null;
  return {
    id: trailId,
    hostUid: typeof data.hostUid === "string" ? data.hostUid : "",
    displayNumber:
      typeof data.displayNumber === "number" && Number.isFinite(data.displayNumber)
        ? Math.max(1, Math.min(999, Math.floor(data.displayNumber)))
        : 1,
    publicationId: resolveTrailPublicationId(data),
    regionLabel:
      typeof data.regionLabel === "string" && data.regionLabel.trim() ? data.regionLabel.trim() : null,
    distanceKm:
      typeof data.distanceKm === "number" && Number.isFinite(data.distanceKm) ? data.distanceKm : null,
    visibility: data.visibility === "private" ? "private" : "open",
    status:
      data.status === "archived"
        ? "archived"
        : data.status === "closed"
          ? "closed"
          : "open",
  };
}

function isListableTrail(trail: TrailMeta): boolean {
  return trail.status === "open" && trail.visibility === "open" && Boolean(trail.publicationId?.trim());
}

/**
 * Trail 문서 쓰기가 목록을 바꿀 수 있는가. 쓰기 앞뒤가 모두 목록 대상이 아니면(비공개 Trail 의 활동 시각 갱신)
 * 재계산할 것이 없다 — 종전에는 없는 목록 문서를 매번 지웠다(비용 L9).
 */
export function trailWriteAffectsListing(
  trailId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
): boolean {
  if (!before || !after) return true;
  const was = parseTrailMeta(trailId, before);
  const now = parseTrailMeta(trailId, after);
  return Boolean((was && isListableTrail(was)) || (now && isListableTrail(now)));
}

/** Publication 요약 목록(G2)에서 Trail 목록으로 복사하는 지역 필드(G4). 새로 판정하지 않는다. */
export const TRAIL_LISTING_GEO_KEYS = [
  "geoQuadkey",
  "geoContinent",
  "geoCountry",
  "geoAdmin1",
  "geoResolverVersion",
] as const;

/**
 * 지역 필드를 이번 재계산에서 채워야 하는가. 같은 Publication 으로 이미 확인했으면(값이 없었어도) 건너뛴다 —
 * Trail 목록 재계산은 활동 시각마다 돌므로, 매번 Publication 목록을 읽으면 읽기가 그만큼 는다.
 * 목록 문서는 라이더가 없으면 지워지므로 「없었음」 기록은 다음 목록 문서에서 다시 확인된다.
 */
export function trailListingNeedsGeo(
  existing: DocumentData | undefined,
  publicationId: string,
): boolean {
  return !existing || existing.geoSourcePublicationId !== publicationId;
}

/** Publication 요약 목록 문서 → Trail 목록에 병합할 지역 필드. 요약 목록이 없으면 확인 표시만 남긴다. */
export function trailListingGeoFields(
  publicationId: string,
  publicationListing: DocumentData | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { geoSourcePublicationId: publicationId };
  for (const k of TRAIL_LISTING_GEO_KEYS) {
    const v = publicationListing?.[k];
    out[k] = typeof v === "string" || typeof v === "number" ? v : null;
  }
  return out;
}

async function countActiveParticipants(trailId: string): Promise<number> {
  const db = getFirestore();
  const cutoff = presenceCutoff();
  const trailRef = db.collection(TRAILS_COLLECTION).doc(trailId);
  const [membersSnap, liveSnap] = await Promise.all([
    trailRef.collection(MEMBERS_SUB).where("lastSeenAt", ">", cutoff).count().get(),
    trailRef.collection(LIVE_SUB).where("lastSeenAt", ">", cutoff).count().get(),
  ]);
  return Math.max(membersSnap.data().count, liveSnap.data().count);
}

/**
 * authoritative 컬렉션을 읽고 `openTrailListings/{trailId}` 전체 재계산(증감 없음).
 */
export async function recomputeOpenTrailListing(
  trailId: string,
): Promise<RecomputeOpenTrailListingResult> {
  if (!trailId || trailId === "default") return "skipped";

  const db = getFirestore();
  const listingRef = db.collection(OPEN_TRAIL_LISTINGS_COLLECTION).doc(trailId);
  const trailSnap = await db.collection(TRAILS_COLLECTION).doc(trailId).get();

  if (!trailSnap.exists) {
    await listingRef.delete().catch(() => {});
    return "removed";
  }

  const trail = parseTrailMeta(trailId, trailSnap.data());
  if (!trail || !isListableTrail(trail)) {
    await listingRef.delete().catch(() => {});
    return "removed";
  }

  const riderCount = await countActiveParticipants(trailId);
  if (riderCount <= 0) {
    await listingRef.delete().catch(() => {});
    return "removed";
  }

  const existingSnap = await listingRef.get();
  const existing = existingSnap.exists ? existingSnap.data() : undefined;
  const existingCreated = existing?.createdAt;
  const publicationId = trail.publicationId!;
  const geo = trailListingNeedsGeo(existing, publicationId)
    ? trailListingGeoFields(
        publicationId,
        (await db.collection(PUBLICATION_LISTINGS_COLLECTION).doc(publicationId).get()).data(),
      )
    : {};
  const trailCreatedMs = timestampMs(trailSnap.data()?.createdAt);
  const createdAt =
    existingCreated != null
      ? existingCreated
      : trailCreatedMs != null
        ? Timestamp.fromMillis(trailCreatedMs)
        : Timestamp.now();

  await listingRef.set(
    {
      trailId: trail.id,
      hostUid: trail.hostUid,
      displayNumber: trail.displayNumber,
      regionLabel: trail.regionLabel,
      distanceKm: trail.distanceKm,
      publicationId: trail.publicationId,
      riderCount,
      ...geo,
      createdAt,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return "upserted";
}

/** 유령 listing 정리 — `updatedAt` 기준 */
export async function purgeStaleOpenTrailListings(limit = 80): Promise<number> {
  const db = getFirestore();
  const cutoff = Timestamp.fromMillis(Date.now() - OPEN_TRAIL_LISTING_STALE_MS);
  const snap = await db
    .collection(OPEN_TRAIL_LISTINGS_COLLECTION)
    .where("updatedAt", "<", cutoff)
    .limit(limit)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}
