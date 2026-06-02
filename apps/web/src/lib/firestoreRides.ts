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
import type { RouteRideEntry } from "./routePublicationResolve";
import type { StoredRideSession } from "./rideSessionsStorage";

const RIDES_COLLECTION = "rides";

type RideDoc = {
  userId: string;
  roomId: string | null;
  /** 레거시 — `catalogRouteId` 와 동일 값 유지 */
  courseId: string | null;
  /** 카탈로그 Route id (`courses/{id}`). 신규 쓰기 우선 */
  catalogRouteId?: string | null;
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
  /** 격상시킨 사용자 경로 ID. ad-hoc 주행이면 null. */
  userRouteId?: string | null;
  /** 통합 경로 정체성(`savedRoutes` id). `userRouteId` 와 동일 값. */
  routeId?: string | null;
  /** 퍼블릭 출판 리비전 id(마이그레이션 기간 `courseId` 와 동일할 수 있음). */
  publicationId?: string | null;
  /** `owner_library` | `public_catalog` */
  routeEntry?: RouteRideEntry | null;
  /** 격상 시점 사용자 경로 이름 스냅샷. 사용자가 이후 이름을 바꿔도 기록은 보존. */
  routeName?: string | null;
  /** 주행 시점 공개 제목 스냅샷(퍼블릭 연동 시). */
  publicTitleSnap?: string | null;
  /** 완주율(0~1). 1.0 이상은 1.0 으로 캡. */
  completionRatio?: number;
  startPlaceLabel?: string | null;
  endPlaceLabel?: string | null;
};

/**
 * 주행 기록 1건 저장. 반환값은 신규 rides 문서 ID — 호출자가 격상 함수에 넘긴다.
 * 메타(userRouteId/routeName/completionRatio)는 옵셔널이며 ad-hoc 주행에서는 모두 null/0.
 */
export async function saveRideSessionToFirestore(input: {
  userId: string;
  roomId: string | null;
  /** 카탈로그 Route id — `courseActivity` aggregate 키 (Firestore `courses` legacy) */
  catalogRouteId?: string | null;
  /** @deprecated use catalogRouteId — 동일 값 dual-write */
  courseId?: string | null;
  routeId?: string | null;
  publicationId?: string | null;
  routeEntry?: RouteRideEntry | null;
  publicTitleSnap?: string | null;
  profile: "cycling" | "driving" | "walking";
  session: StoredRideSession;
}): Promise<string> {
  const db = getFirestore(getFirebaseApp());
  const endedAtDate = new Date(input.session.endedAt);
  const endedAt = Number.isNaN(endedAtDate.getTime())
    ? Timestamp.now()
    : Timestamp.fromDate(endedAtDate);

  const catalogRouteIdRaw =
    (typeof input.catalogRouteId === "string" && input.catalogRouteId.trim()) ||
    (typeof input.courseId === "string" && input.courseId.trim()) ||
    "";
  const catalogRouteId = catalogRouteIdRaw.length > 0 ? catalogRouteIdRaw : null;

  const docData: RideDoc = {
    userId: input.userId,
    roomId: input.roomId,
    catalogRouteId,
    courseId: catalogRouteId,
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
    userRouteId: input.session.userRouteId ?? input.routeId ?? null,
    routeId: input.routeId ?? input.session.userRouteId ?? null,
    publicationId:
      typeof input.publicationId === "string" && input.publicationId.trim().length > 0
        ? input.publicationId.trim()
        : null,
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
  roomId: string | null;
  profile: "cycling" | "driving" | "walking";
  sessions: StoredRideSession[];
}): Promise<void> {
  const ordered = [...input.sessions]
    .filter((s) => s && Number.isFinite(s.elapsedSec))
    .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
  for (const session of ordered) {
    await saveRideSessionToFirestore({
      userId: input.userId,
      roomId: input.roomId,
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
  return snap.docs.map((d) => {
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
      userRouteId: typeof data.userRouteId === "string" ? data.userRouteId : null,
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
  });
}

export async function loadRecentRideSessionsFromFirestore(
  userId: string,
  limitCount = 50,
): Promise<StoredRideSession[]> {
  return loadRideSessionsForStatsFromFirestore(userId, limitCount);
}
