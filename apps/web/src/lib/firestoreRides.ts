import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import { buildRideCanonicalWriteFields, resolveRideRouteId } from "./rideDocFields";
import type { RouteRideEntry } from "./routePublicationResolve";
import type { StoredRideSession } from "./rideSessionsStorage";
import { isDiscardableRideRecord } from "./rideRecordPolicy";

const RIDES_COLLECTION = "rides";

type RideDoc = {
  userId: string;
  trailId: string | null;
  /** @deprecated read fallback only — 신규 write 없음 */
  roomId?: string | null;
  profile: "cycling" | "driving" | "walking";
  startedAt: Timestamp | null;
  endedAt: Timestamp;
  elapsedSec: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  caloriesEstimate: number;
  routeDistanceMeters: number;
  routeDurationSec: number;
  source: "web";
  status: "completed";
  createdAt: unknown;
  updatedAt: unknown;
  routeId?: string | null;
  /** @deprecated read fallback only — 신규 write 없음 */
  userRouteId?: string | null;
  publicationId?: string | null;
  routeEntry?: RouteRideEntry | null;
  routeName?: string | null;
  publicTitleSnap?: string | null;
  completionRatio?: number;
  startPlaceLabel?: string | null;
  endPlaceLabel?: string | null;
};

/**
 * 주행 기록 1건 저장. 반환값은 신규 rides 문서 ID — 호출자가 격상 함수에 넘긴다.
 */
export async function saveRideSessionToFirestore(input: {
  userId: string;
  trailId: string | null;
  routeId?: string | null;
  publicationId?: string | null;
  routeEntry?: RouteRideEntry | null;
  publicTitleSnap?: string | null;
  profile: "cycling" | "driving" | "walking";
  session: StoredRideSession;
}): Promise<string | null> {
  if (isDiscardableRideRecord(input.session.distanceMeters, input.session.elapsedSec)) {
    return null;
  }
  const db = getFirestore(getFirebaseApp());
  const endedAtDate = new Date(input.session.endedAt);
  const endedAt = Number.isNaN(endedAtDate.getTime())
    ? Timestamp.now()
    : Timestamp.fromDate(endedAtDate);

  const canonicalRouteId = input.routeId ?? input.session.userRouteId ?? null;
  const canonicalPublicationId =
    typeof input.publicationId === "string" && input.publicationId.trim().length > 0
      ? input.publicationId.trim()
      : null;

  const canonical = buildRideCanonicalWriteFields({
    trailId: input.trailId,
    routeId: canonicalRouteId,
    publicationId: canonicalPublicationId,
  });

  const docData: RideDoc = {
    userId: input.userId,
    trailId: canonical.trailId,
    profile: input.profile,
    startedAt: null,
    endedAt,
    elapsedSec: input.session.elapsedSec,
    distanceMeters: input.session.distanceMeters,
    avgSpeedKmh: input.session.avgSpeedKmh,
    caloriesEstimate: input.session.caloriesEstimate,
    routeDistanceMeters: input.session.routeDistanceMeters,
    routeDurationSec: input.session.routeDurationSec,
    source: "web",
    status: "completed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    routeId: canonical.routeId,
    publicationId: canonical.publicationId,
    routeEntry: input.routeEntry ?? null,
    routeName: input.session.routeName ?? null,
    publicTitleSnap:
      typeof input.publicTitleSnap === "string" && input.publicTitleSnap.trim().length > 0
        ? input.publicTitleSnap.trim()
        : null,
    completionRatio:
      typeof input.session.completionRatio === "number"
        ? Math.max(0, Math.min(1, input.session.completionRatio))
        : 0,
    startPlaceLabel:
      typeof input.session.startPlaceLabel === "string" && input.session.startPlaceLabel.trim().length > 0
        ? input.session.startPlaceLabel.trim()
        : null,
    endPlaceLabel:
      typeof input.session.endPlaceLabel === "string" && input.session.endPlaceLabel.trim().length > 0
        ? input.session.endPlaceLabel.trim()
        : null,
  };

  const ref = await addDoc(collection(db, RIDES_COLLECTION), docData);
  return ref.id;
}

export async function backfillRideSessionsToFirestore(input: {
  userId: string;
  trailId: string | null;
  profile: "cycling" | "driving" | "walking";
  sessions: StoredRideSession[];
}): Promise<void> {
  const ordered = [...input.sessions]
    .filter((s) => s && Number.isFinite(s.elapsedSec))
    .filter((s) => !isDiscardableRideRecord(s.distanceMeters, s.elapsedSec))
    .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
  for (const session of ordered) {
    await saveRideSessionToFirestore({
      userId: input.userId,
      trailId: input.trailId,
      profile: input.profile,
      session,
    });
  }
}

/** 통계·기간 집계용 — 동일 인덱스(`userId` + `endedAt` desc), 상한만 크게 잡음 */
export async function loadRideSessionsForStatsFromFirestore(
  userId: string,
  limitCount = 400,
): Promise<StoredRideSession[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, RIDES_COLLECTION),
    where("userId", "==", userId),
    orderBy("endedAt", "desc"),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data() as Partial<RideDoc>;
      const endedAt =
        data.endedAt instanceof Timestamp
          ? data.endedAt.toDate().toISOString()
          : new Date().toISOString();
      return {
        id: d.id,
        endedAt,
        elapsedSec: Number(data.elapsedSec ?? 0),
        distanceMeters: Number(data.distanceMeters ?? 0),
        avgSpeedKmh: Number(data.avgSpeedKmh ?? 0),
        caloriesEstimate: Number(data.caloriesEstimate ?? 0),
        routeDistanceMeters: Number(data.routeDistanceMeters ?? 0),
        routeDurationSec: Number(data.routeDurationSec ?? 0),
        userRouteId: resolveRideRouteId(data as Record<string, unknown>),
        routeName: typeof data.routeName === "string" ? data.routeName : null,
        completionRatio:
          typeof data.completionRatio === "number"
            ? Math.max(0, Math.min(1, data.completionRatio))
            : 0,
        startPlaceLabel:
          typeof data.startPlaceLabel === "string" && data.startPlaceLabel.trim().length > 0
            ? data.startPlaceLabel.trim()
            : undefined,
        endPlaceLabel:
          typeof data.endPlaceLabel === "string" && data.endPlaceLabel.trim().length > 0
            ? data.endPlaceLabel.trim()
            : undefined,
      };
    })
    .filter((s) => !isDiscardableRideRecord(s.distanceMeters, s.elapsedSec));
}

export async function loadRecentRideSessionsFromFirestore(
  userId: string,
  limitCount = 50,
): Promise<StoredRideSession[]> {
  return loadRideSessionsForStatsFromFirestore(userId, limitCount);
}
