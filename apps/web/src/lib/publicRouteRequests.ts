import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { getFirebaseFirestore } from "./firebase";
import { type LineStringGeometry, type LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";
import type { SavedRoute } from "./firestoreSavedRoutes";
import { SAVED_ROUTE_MAX_COORDS, SAVED_ROUTES_COLLECTION } from "./firestoreSavedRoutes";
import { computeRouteFingerprint } from "./routeFingerprint";
import { decodeLineStringCoordsJson } from "./lineStringCoordsJson";
import { assertPublicRouteAutoReview } from "./publicRouteAutoReview";
import { writeRoutePublicationOnApprove } from "./firestoreRoutePublications";
import {
  PUBLIC_ROUTE_NAMING_POLICY_VERSION,
} from "./publicRouteNamingPolicy";
import { getUserProfileTier } from "./firestoreUser";
import { assertTierQuotaClient } from "./tierQuota";
import { functionsHttpUrl } from "./functionsEmulatorUrl";
import { canSubmitPublicRoute, GUEST_PUBLIC_ROUTE_MSG } from "./userTier";
import {
  maybeModeratePublicRouteCopyRemote,
  validatePublicRouteTitleAndSummary,
} from "./publicRouteContentPolicy";

export const PUBLIC_ROUTE_REQUESTS_COLLECTION = "publicRouteRequests";

/** Firestore `config/routeReviewers` — Console 에서 수동 생성: `{ uids: ["관리자uid", ...] }` */
export const ROUTE_REVIEWERS_DOC_PATH = ["config", "routeReviewers"] as const;

export const EXPERIENCE_TAG_OPTIONS = [
  { id: "mountain_trail", label: "산악 트레일" },
  { id: "coastal_road", label: "해변·연안 도로" },
  { id: "water_route", label: "수상 루트" },
  { id: "urban", label: "도심" },
  { id: "countryside", label: "교외지" },
] as const;

export type ExperienceTagId = (typeof EXPERIENCE_TAG_OPTIONS)[number]["id"];

export type PublicRouteRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type PublicRouteRequest = {
  id: string;
  applicantUid: string;
  savedRouteId: string;
  savedRouteNameSnapshot: string;
  status: PublicRouteRequestStatus;
  publicTitle: string;
  publicSummary: string;
  experienceTags: ExperienceTagId[];
  snapshotProfile: RouteProfile;
  snapshotDistanceMeters: number;
  snapshotDurationSec: number;
  snapshotStartLngLat: LngLat;
  snapshotEndLngLat: LngLat;
  geometryCoordsJson: string;
  /** 동일 퍼블릭 등록 방지용 지문(없으면 geometry 로 재계산) */
  routeFingerprint: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  reviewedAtIso: string | null;
  reviewerUid: string | null;
  createdCourseId: string | null;
  /** Phase 7 — 승인 시 생성된 publication id */
  createdPublicationId: string | null;
  rejectionReason: string | null;
};

const PUBLIC_TITLE_MAX = 80;
const PUBLIC_SUMMARY_MAX = 500;
const REJECTION_REASON_MAX = 500;

const ALLOWED_TAG_SET = new Set<string>(EXPERIENCE_TAG_OPTIONS.map((o) => o.id));

function formatPublicRouteFirestoreError(err: unknown): Error {
  if (err instanceof FirebaseError) {
    if (err.code === "permission-denied") {
      return new Error(
        "퍼블릭 신청 권한이 없습니다. Google 로그인·닉네임 설정·경로 클라우드 저장 상태를 확인한 뒤 새로고침해 보세요.",
      );
    }
    if (err.code === "failed-precondition" && err.message.includes("index")) {
      return new Error("서버 인덱스 준비 중입니다. 잠시 후 다시 시도해 주세요.");
    }
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function assertPublicRouteRequestPreflight(user: User, route: SavedRoute): Promise<void> {
  const db = getFirebaseFirestore();
  const routeSnap = await getDoc(doc(db, SAVED_ROUTES_COLLECTION, route.id));
  if (!routeSnap.exists()) {
    throw new Error("클라우드에 저장된 경로를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.");
  }
  const routeData = routeSnap.data() as Record<string, unknown>;
  if (routeData.userId !== user.uid) {
    throw new Error("본인 경로만 신청할 수 있습니다.");
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const tier = userSnap.data()?.tier;
  if (tier !== "registered_free" && tier !== "registered_paid" && tier !== "admin") {
    throw new Error(GUEST_PUBLIC_ROUTE_MSG);
  }
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

function encodeGeometryJson(geometry: LineStringGeometry): string {
  return JSON.stringify(geometry.coordinates);
}

async function resolvePublicRequestFingerprint(req: PublicRouteRequest): Promise<string> {
  if (req.routeFingerprint && req.routeFingerprint.length === 64) {
    return req.routeFingerprint;
  }
  const g = decodeLineStringCoordsJson(req.geometryCoordsJson);
  if (!g) {
    throw new Error("신청 경로 geometry 를 읽을 수 없습니다.");
  }
  return computeRouteFingerprint(g, req.snapshotProfile);
}

async function assertNoDuplicatePublicCatalogRoute(
  db: ReturnType<typeof getFirebaseFirestore>,
  fingerprint: string,
  options?: {
    excludePublicRouteRequestId?: string;
    applicantUid?: string;
    /** 심사자만 타인 pending 지문 조회 가능 */
    scanAllPending?: boolean;
  },
): Promise<void> {
  const pubHit = await getDocs(
    query(
      collection(db, "routePublications"),
      where("routeFingerprint", "==", fingerprint),
      where("status", "==", "published"),
      limit(1),
    ),
  );
  if (!pubHit.empty) {
    throw new Error("이미 퍼블릭 코스로 등록된 동일한 경로입니다(이동 수단·꼭짓점 기준).");
  }

  if (options?.scanAllPending || options?.applicantUid) {
    const pendingQ =
      options.scanAllPending === true
        ? query(
            collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
            where("routeFingerprint", "==", fingerprint),
            where("status", "==", "pending"),
            limit(16),
          )
        : query(
            collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
            where("routeFingerprint", "==", fingerprint),
            where("status", "==", "pending"),
            where("applicantUid", "==", options.applicantUid!),
            limit(8),
          );
    const pendingHit = await getDocs(pendingQ);
    for (const d of pendingHit.docs) {
      if (options?.excludePublicRouteRequestId && d.id === options.excludePublicRouteRequestId) {
        continue;
      }
      throw new Error("동일한 경로로 심사 대기 중인 신청이 이미 있습니다.");
    }
  }
}

export function validateExperienceTags(tags: string[]): ExperienceTagId[] {
  const uniq = [...new Set(tags)];
  if (uniq.length < 1 || uniq.length > 3) {
    throw new Error("경로 프로필 태그는 1~3개 선택하세요.");
  }
  for (const t of uniq) {
    if (!ALLOWED_TAG_SET.has(t)) {
      throw new Error(`허용되지 않은 태그입니다: ${t}`);
    }
  }
  return uniq as ExperienceTagId[];
}

export async function isRouteReviewer(user: User | null): Promise<boolean> {
  if (!user) return false;
  try {
    const db = getFirebaseFirestore();
    const ref = doc(db, ROUTE_REVIEWERS_DOC_PATH[0], ROUTE_REVIEWERS_DOC_PATH[1]);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const uids = snap.data()?.uids;
    if (!Array.isArray(uids)) return false;
    return uids.includes(user.uid);
  } catch {
    return false;
  }
}

function fromRequestDoc(id: string, data: Record<string, unknown>): PublicRouteRequest | null {
  if (
    typeof data.applicantUid !== "string" ||
    typeof data.savedRouteId !== "string" ||
    typeof data.publicTitle !== "string" ||
    typeof data.geometryCoordsJson !== "string"
  ) {
    return null;
  }
  const status = data.status as PublicRouteRequestStatus;
  if (!["pending", "approved", "rejected", "withdrawn"].includes(status)) return null;
  const tags = Array.isArray(data.experienceTags) ? data.experienceTags.filter((t) => typeof t === "string") : [];
  return {
    id,
    applicantUid: data.applicantUid,
    savedRouteId: data.savedRouteId,
    savedRouteNameSnapshot: typeof data.savedRouteNameSnapshot === "string" ? data.savedRouteNameSnapshot : "",
    status,
    publicTitle: data.publicTitle,
    publicSummary: typeof data.publicSummary === "string" ? data.publicSummary : "",
    experienceTags: tags as ExperienceTagId[],
    snapshotProfile: (data.snapshotProfile ?? "cycling") as RouteProfile,
    snapshotDistanceMeters: Number(data.snapshotDistanceMeters ?? 0),
    snapshotDurationSec: Number(data.snapshotDurationSec ?? 0),
    snapshotStartLngLat: data.snapshotStartLngLat as LngLat,
    snapshotEndLngLat: data.snapshotEndLngLat as LngLat,
    geometryCoordsJson: data.geometryCoordsJson,
    createdAtIso: toIso(data.createdAt),
    updatedAtIso: toIso(data.updatedAt),
    reviewedAtIso: data.reviewedAt ? toIso(data.reviewedAt) : null,
    reviewerUid: typeof data.reviewerUid === "string" ? data.reviewerUid : null,
    createdCourseId: typeof data.createdCourseId === "string" ? data.createdCourseId : null,
    createdPublicationId:
      typeof data.createdPublicationId === "string"
        ? data.createdPublicationId
        : typeof data.createdCourseId === "string"
          ? data.createdCourseId
          : null,
    rejectionReason: typeof data.rejectionReason === "string" ? data.rejectionReason : null,
    routeFingerprint:
      typeof data.routeFingerprint === "string" && data.routeFingerprint.length === 64
        ? data.routeFingerprint
        : null,
  };
}

type AutoReviewCfResult =
  | { result: { status: "approved"; publicationId: string } }
  | { result: { status: "rejected"; reason: string } }
  | { error: { message?: string } };

/**
 * 자동 검수 CF 연결·서버 오류. 신청 문서는 pending 인 채 남으므로 호출부가 정리(withdraw)한다.
 * 정상 거절(rejected)과 구분하기 위한 별도 타입.
 */
class AutoReviewUnavailableError extends Error {
  constructor() {
    super("자동 검수 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    this.name = "AutoReviewUnavailableError";
  }
}

/**
 * `publicRouteRequests` 문서 생성 직후 자동 검수 CF 를 호출한다.
 * 승인 시 생성된 `publicationId` 를 반환, 정상 거절 시 사유로 throw.
 * 연결·서버 오류는 `AutoReviewUnavailableError` 로 throw — 이때 pending 문서는 호출부가 회수한다.
 */
async function callAutoReviewPublicRouteRequest(user: User, requestId: string): Promise<string> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new AutoReviewUnavailableError();
  }

  const url = functionsHttpUrl("autoReviewPublicRouteRequest");
  let res: Response;
  try {
    const idToken = await user.getIdToken();
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: { requestId } }),
    });
  } catch {
    throw new AutoReviewUnavailableError();
  }

  let json: AutoReviewCfResult;
  try {
    json = (await res.json()) as AutoReviewCfResult;
  } catch {
    throw new AutoReviewUnavailableError();
  }

  if (!res.ok || "error" in json) {
    throw new AutoReviewUnavailableError();
  }
  if (json.result.status === "rejected") {
    throw new Error(json.result.reason);
  }
  return json.result.publicationId;
}

/**
 * 자동 검수 CF 에 도달하지 못해 pending 으로 남은 신청을 회수한다(best-effort).
 * 이 정리에 실패해도 사용자에게는 재시도 안내가 우선이므로 예외를 삼킨다.
 * 회수해야 같은 savedRoute 재신청 차단(§중복)에 걸리지 않고 곧바로 다시 시도할 수 있다.
 */
async function discardUnreviewedRequest(user: User, requestId: string): Promise<void> {
  try {
    await withdrawPublicRouteRequest(user, requestId);
  } catch {
    // 정리 실패는 무시 — pending 이 잠시 남더라도 다음 자동 검수·재시도로 해소된다.
  }
}

/**
 * 퍼블릭 신청을 생성하고 자동 검수 CF(`autoReviewPublicRouteRequest`)를 호출한다.
 * 반환값은 신청 id 가 아니라 승인 시 생성된 **publicationId**.
 */
export async function createPublicRouteRequest(
  user: User,
  route: SavedRoute,
  input: {
    publicTitle: string;
    publicSummary: string;
    experienceTags: ExperienceTagId[];
    namingPolicyAcknowledged: boolean;
  },
): Promise<string> {
  try {
  const tier = await getUserProfileTier(user.uid);
  if (!canSubmitPublicRoute(tier, user)) {
    throw new Error(GUEST_PUBLIC_ROUTE_MSG);
  }
  if (!input.namingPolicyAcknowledged) {
    throw new Error("공개 제목 정책에 동의한 뒤 신청할 수 있습니다.");
  }
  if (route.id.startsWith("local-")) {
    throw new Error("클라우드에 저장된 경로만 신청할 수 있습니다.");
  }
  const title = input.publicTitle.replace(/\s+/g, " ").trim();
  if (title.length < 1 || title.length > PUBLIC_TITLE_MAX) {
    throw new Error(`공개 제목은 1~${PUBLIC_TITLE_MAX}자로 입력하세요.`);
  }
  const summary = input.publicSummary.replace(/\s+/g, " ").trim();
  if (summary.length > PUBLIC_SUMMARY_MAX) {
    throw new Error(`소개는 ${PUBLIC_SUMMARY_MAX}자 이내로 입력하세요.`);
  }
  validatePublicRouteTitleAndSummary(title, summary);
  await maybeModeratePublicRouteCopyRemote(title, summary);
  const tags = validateExperienceTags(input.experienceTags as unknown as string[]);
  if (route.geometry.coordinates.length > SAVED_ROUTE_MAX_COORDS) {
    throw new Error("경로 좌표가 너무 많아 공개 신청을 할 수 없습니다.");
  }

  const db = getFirebaseFirestore();
  await assertPublicRouteRequestPreflight(user, route);
  const existing = await getDocs(
    query(
      collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
      where("applicantUid", "==", user.uid),
      where("savedRouteId", "==", route.id),
      where("status", "==", "pending"),
      limit(1),
    ),
  );
  if (!existing.empty) {
    throw new Error("이 경로에 대한 심사 중인 신청이 이미 있습니다.");
  }

  await assertPublicRouteAutoReview({
    db,
    geometry: route.geometry,
    profile: route.profile,
    applicantUid: user.uid,
  });
  const routeFingerprint = await computeRouteFingerprint(route.geometry, route.profile);
  await assertNoDuplicatePublicCatalogRoute(db, routeFingerprint, { applicantUid: user.uid });

  await assertTierQuotaClient(user, "public_route_request");

  const payload = {
    applicantUid: user.uid,
    savedRouteId: route.id,
    savedRouteNameSnapshot: route.name,
    status: "pending" as const,
    publicTitle: title,
    publicSummary: summary,
    experienceTags: tags,
    snapshotProfile: route.profile,
    snapshotDistanceMeters: route.distanceMeters,
    snapshotDurationSec: route.durationSec,
    snapshotStartLngLat: route.startLngLat,
    snapshotEndLngLat: route.endLngLat,
    geometryType: "LineString" as const,
    geometryCoordsJson: encodeGeometryJson(route.geometry),
    routeFingerprint,
    namingPolicyAcknowledged: true,
    namingPolicyVersion: PUBLIC_ROUTE_NAMING_POLICY_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION), payload);
  try {
    return await callAutoReviewPublicRouteRequest(user, ref.id);
  } catch (err) {
    // 자동 검수에 도달하지 못했으면(연결·서버 오류) pending 이 갇히지 않도록 회수해
    // 사용자가 곧바로 다시 시도할 수 있게 한다. 정상 거절(rejected)은 그대로 사유를 던진다.
    if (err instanceof AutoReviewUnavailableError) {
      await discardUnreviewedRequest(user, ref.id);
    }
    throw err;
  }
  } catch (err) {
    throw formatPublicRouteFirestoreError(err);
  }
}

/**
 * 안전망 전용(콘솔). 퍼블릭 등록은 자동 심사(CF)로 처리되어 관리자 심사 UI 는 제거됐다.
 * 자동 검수 CF 장애로 pending 이 남는 예외 상황을 리뷰어가 콘솔에서 조회·처리할 때만 쓴다.
 * 관련: `isRouteReviewer` · `approvePublicRouteRequest` · `rejectPublicRouteRequest`.
 */
export async function loadPendingPublicRouteRequests(): Promise<PublicRouteRequest[]> {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc"),
    limit(50),
  );
  const snap = await getDocs(q);
  const out: PublicRouteRequest[] = [];
  snap.forEach((d) => {
    const row = fromRequestDoc(d.id, d.data() as Record<string, unknown>);
    if (row) out.push(row);
  });
  return out;
}

export async function loadMyPendingRequestRouteIds(userId: string): Promise<Set<string>> {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
    where("applicantUid", "==", userId),
    where("status", "==", "pending"),
    limit(100),
  );
  const snap = await getDocs(q);
  const ids = new Set<string>();
  snap.forEach((d) => {
    const sid = (d.data() as { savedRouteId?: string }).savedRouteId;
    if (typeof sid === "string") ids.add(sid);
  });
  return ids;
}

export async function withdrawPublicRouteRequest(user: User, requestId: string): Promise<void> {
  const db = getFirebaseFirestore();
  const ref = doc(db, PUBLIC_ROUTE_REQUESTS_COLLECTION, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("신청을 찾을 수 없습니다.");
  const data = snap.data() as { applicantUid?: string; status?: string };
  if (data.applicantUid !== user.uid) throw new Error("본인 신청만 취소할 수 있습니다.");
  if (data.status !== "pending") throw new Error("심사 중인 신청만 취소할 수 있습니다.");
  await updateDoc(ref, {
    status: "withdrawn",
    updatedAt: serverTimestamp(),
    withdrawnAt: serverTimestamp(),
  });
}

export async function approvePublicRouteRequest(
  reviewer: User,
  request: PublicRouteRequest,
): Promise<string> {
  if (!(await isRouteReviewer(reviewer))) {
    throw new Error("공개 경로 심사 권한이 없습니다. config/routeReviewers 를 확인하세요.");
  }
  if (request.status !== "pending") {
    throw new Error("심사 대기 중인 신청만 승인할 수 있습니다.");
  }
  validatePublicRouteTitleAndSummary(request.publicTitle, request.publicSummary);
  await maybeModeratePublicRouteCopyRemote(request.publicTitle, request.publicSummary);
  const db = getFirebaseFirestore();
  const geom = decodeLineStringCoordsJson(request.geometryCoordsJson);
  if (!geom) {
    throw new Error("신청에 포함된 경로 geometry 가 올바르지 않습니다.");
  }
  await assertPublicRouteAutoReview({
    db,
    geometry: geom,
    profile: request.snapshotProfile,
    excludePublicRouteRequestId: request.id,
    scanAllPendingRequests: true,
  });
  const routeFingerprint = await resolvePublicRequestFingerprint(request);
  await assertNoDuplicatePublicCatalogRoute(db, routeFingerprint, {
    excludePublicRouteRequestId: request.id,
    scanAllPending: true,
  });

  const pubRef = doc(collection(db, "routePublications"));
  const publicationId = pubRef.id;
  const reqRef = doc(db, PUBLIC_ROUTE_REQUESTS_COLLECTION, request.id);

  const batch = writeBatch(db);
  writeRoutePublicationOnApprove(batch, {
    publicationId,
    routeId: request.savedRouteId,
    publicTitle: request.publicTitle,
    publicSummary: request.publicSummary,
    routeFingerprint,
    geometryCoordsJson: request.geometryCoordsJson,
    snapshotProfile: request.snapshotProfile,
    snapshotDistanceMeters: request.snapshotDistanceMeters,
    snapshotDurationSec: request.snapshotDurationSec,
    applicantUid: request.applicantUid,
    sourcePublicRouteRequestId: request.id,
  });
  batch.update(reqRef, {
    status: "approved",
    reviewerUid: reviewer.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdPublicationId: publicationId,
  });
  await batch.commit();
  return publicationId;
}

export async function rejectPublicRouteRequest(
  reviewer: User,
  request: PublicRouteRequest,
  reason: string,
): Promise<void> {
  if (!(await isRouteReviewer(reviewer))) {
    throw new Error("공개 경로 심사 권한이 없습니다.");
  }
  if (request.status !== "pending") {
    throw new Error("심사 대기 중인 신청만 거절할 수 있습니다.");
  }
  const trimmed = reason.replace(/\s+/g, " ").trim();
  if (trimmed.length < 1 || trimmed.length > REJECTION_REASON_MAX) {
    throw new Error(`거절 사유는 1~${REJECTION_REASON_MAX}자로 입력하세요.`);
  }
  const db = getFirebaseFirestore();
  await updateDoc(doc(db, PUBLIC_ROUTE_REQUESTS_COLLECTION, request.id), {
    status: "rejected",
    reviewerUid: reviewer.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    rejectionReason: trimmed,
  });
}
