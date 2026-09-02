import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
import type { ConquestRidePayload } from "./conquestTiles";
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
  /**
   * 이번 세션이 실제로 시작·종료한 경로상 지점(RIDE-CONTINUE-1 §4.1).
   * 계획된 `endLngLat` 이 아니라 **실제 종료 누적 거리 지점**이며, 「다음 주행」의 출발점이 된다.
   * 옛 문서에는 없다 — 읽기는 null 폴백(legacy backfill 하지 않음).
   */
  sessionStartLngLat?: [number, number] | null;
  sessionEndLngLat?: [number, number] | null;
  sessionStartRouteMeters?: number;
  sessionEndRouteMeters?: number;
  sessionStartProgressRatio?: number;
  sessionEndProgressRatio?: number;
  sessionStartPlaceLabel?: string | null;
  sessionEndPlaceLabel?: string | null;
  /** Conquest(정복) 페이로드 — CF `conquestOnRideCreated` 가 한도 적용 후 집계. null = 미계산 */
  conquest?: ConquestRidePayload | null;
};

/** 좌표 유효성 — Firestore 에 `[NaN, NaN]`·Null Island 추측을 남기지 않는다 */
function sanitizeAnchorLngLat(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const lng = Number(v[0]);
  const lat = Number(v[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function sanitizeAnchorMeters(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sanitizeAnchorRatio(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function trimmedOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/**
 * 실제 세션 anchor 쓰기 필드(§4.1). 좌표가 없으면 `null` 로 남기고 Ride 저장 자체는 막지 않는다.
 * meters 는 0 이상, ratio 는 0..1 clamp — end ≥ start 는 `computeRideSessionAnchors` 가 보장한다.
 */
function buildRideSessionAnchorWriteFields(session: StoredRideSession): {
  sessionStartLngLat: [number, number] | null;
  sessionEndLngLat: [number, number] | null;
  sessionStartRouteMeters: number;
  sessionEndRouteMeters: number;
  sessionStartProgressRatio: number;
  sessionEndProgressRatio: number;
  sessionStartPlaceLabel: string | null;
  sessionEndPlaceLabel: string | null;
} {
  const startMeters = sanitizeAnchorMeters(session.sessionStartRouteMeters);
  const endMeters = Math.max(startMeters, sanitizeAnchorMeters(session.sessionEndRouteMeters));
  return {
    sessionStartLngLat: sanitizeAnchorLngLat(session.sessionStartLngLat),
    sessionEndLngLat: sanitizeAnchorLngLat(session.sessionEndLngLat),
    sessionStartRouteMeters: startMeters,
    sessionEndRouteMeters: endMeters,
    sessionStartProgressRatio: sanitizeAnchorRatio(session.sessionStartProgressRatio),
    sessionEndProgressRatio: sanitizeAnchorRatio(session.sessionEndProgressRatio),
    sessionStartPlaceLabel: trimmedOrNull(session.sessionStartPlaceLabel),
    sessionEndPlaceLabel: trimmedOrNull(session.sessionEndPlaceLabel),
  };
}

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
  /** 정복 페이로드(진행 구간 타일 + pedalSec). 계산 실패·경로 없음 시 null */
  conquest?: ConquestRidePayload | null;
}): Promise<string | null> {
  if (isDiscardableRideRecord(input.session.distanceMeters, input.session.elapsedSec)) {
    return null;
  }
  const db = getFirebaseFirestore();
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
    ...buildRideSessionAnchorWriteFields(input.session),
    conquest: input.conquest ?? null,
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
  const db = getFirebaseFirestore();
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
        // 실제 세션 anchor — 옛 문서에는 없다. 없으면 `null`/0 이며 추측하지 않는다(§4.2).
        sessionStartLngLat: sanitizeAnchorLngLat(data.sessionStartLngLat),
        sessionEndLngLat: sanitizeAnchorLngLat(data.sessionEndLngLat),
        sessionStartRouteMeters: sanitizeAnchorMeters(data.sessionStartRouteMeters),
        sessionEndRouteMeters: sanitizeAnchorMeters(data.sessionEndRouteMeters),
        sessionStartProgressRatio: sanitizeAnchorRatio(data.sessionStartProgressRatio),
        sessionEndProgressRatio: sanitizeAnchorRatio(data.sessionEndProgressRatio),
        sessionStartPlaceLabel: trimmedOrNull(data.sessionStartPlaceLabel) ?? undefined,
        sessionEndPlaceLabel: trimmedOrNull(data.sessionEndPlaceLabel) ?? undefined,
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
