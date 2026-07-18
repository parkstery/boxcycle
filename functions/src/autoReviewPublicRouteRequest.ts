/**
 * 퍼블릭 경로 자동 등록 — HTTP 진입점(신뢰 경계).
 * `adminPromoteSavedRoute.ts` 패턴(onRequest v2, Bearer ID 토큰 검증, HttpsError JSON 응답,
 * region asia-northeast3)을 따르되, 인증 대상은 리뷰어가 아니라 **신청자 본인**이다.
 * 정책 SoT: document/260717-퍼블릭-경로-자동등록-정책.md
 *
 * 일·월 횟수 quota 는 `tierQuotaEnforcement.ts` 의 `publicRouteRequestsTierQuotaGuard`(onCreate 트리거)가
 * 신청 생성 시점에 이미 강제한다(위반 시 문서 삭제) — 이 CF 에서 재검사하지 않는다. 문서가 이미
 * 삭제됐으면 아래 1번 게이트의 not-found 로 자연 처리된다.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import {
  computeRouteFingerprintHex,
  resolveRouteProfile,
  type LngLat,
  type RouteProfile,
} from "./routeFingerprintCore.js";
import {
  checkBannedWords,
  checkBboxDiagonal,
  checkCoordCount,
  checkCoordDensity,
  checkExperienceTags,
  checkPrivateInfo,
  checkRouteLength,
  checkTitleSummaryStructure,
  checkUnriddenPublicationCap,
  checkUrlCount,
  parseAndValidateCoordsJson,
  polylineLengthMeters,
  routePolylineSimilaritySymmetric,
  PUBLIC_ROUTE_SIMILARITY_BLOCK,
} from "./publicRouteAutoReviewCore.js";
import { countHttpUrls } from "./publicRouteBadWords.js";

const REGION = "asia-northeast3";

const PUBLIC_ROUTE_REQUESTS_COLLECTION = "publicRouteRequests";
const ROUTE_PUBLICATIONS_COLLECTION = "routePublications";
const SAVED_ROUTES_COLLECTION = "savedRoutes";

type ApplicantTier = "registered_free" | "registered_paid" | "admin";

class AutoReviewInternalError extends Error {
  constructor(
    message: string,
    readonly status: "not-found" | "permission-denied" | "failed-precondition" | "internal",
  ) {
    super(message);
    this.name = "AutoReviewInternalError";
  }
}

async function assertBearerApplicant(req: Request): Promise<string> {
  const authHeader = req.get("Authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    throw new HttpsError("unauthenticated", "Authorization: Bearer 가 필요합니다.");
  }
  let decoded: { uid: string };
  try {
    decoded = await getAuth().verifyIdToken(tokenMatch[1]);
  } catch {
    throw new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다.");
  }
  return decoded.uid;
}

function parseRequestBody(raw: unknown): { requestId: string } {
  if (!raw || typeof raw !== "object") {
    throw new HttpsError("invalid-argument", "본문이 필요합니다.");
  }
  const wrap = raw as { data?: unknown };
  const data = wrap.data ?? raw;
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "data 필드(또는 루트 객체)가 필요합니다.");
  }
  const o = data as Record<string, unknown>;
  const requestId = o.requestId;
  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new HttpsError("invalid-argument", "requestId 는 비어 있지 않은 문자열이어야 합니다.");
  }
  return { requestId: requestId.trim() };
}

type PublicRouteRequestDoc = {
  applicantUid: string;
  savedRouteId: string;
  status: string;
  publicTitle: string;
  publicSummary: string;
  experienceTags: unknown;
  snapshotProfile: unknown;
  snapshotDistanceMeters: number;
  snapshotDurationSec: number;
  geometryCoordsJson: string;
  routeFingerprint: string | null;
  namingPolicyAcknowledged: unknown;
};

function readRequestDoc(data: FirebaseFirestore.DocumentData): PublicRouteRequestDoc {
  return {
    applicantUid: typeof data.applicantUid === "string" ? data.applicantUid : "",
    savedRouteId: typeof data.savedRouteId === "string" ? data.savedRouteId : "",
    status: typeof data.status === "string" ? data.status : "",
    publicTitle: typeof data.publicTitle === "string" ? data.publicTitle : "",
    publicSummary: typeof data.publicSummary === "string" ? data.publicSummary : "",
    experienceTags: data.experienceTags,
    snapshotProfile: data.snapshotProfile,
    snapshotDistanceMeters:
      typeof data.snapshotDistanceMeters === "number" ? data.snapshotDistanceMeters : 0,
    snapshotDurationSec: typeof data.snapshotDurationSec === "number" ? data.snapshotDurationSec : 0,
    geometryCoordsJson: typeof data.geometryCoordsJson === "string" ? data.geometryCoordsJson : "",
    routeFingerprint:
      typeof data.routeFingerprint === "string" && data.routeFingerprint.length === 64
        ? data.routeFingerprint
        : null,
    namingPolicyAcknowledged: data.namingPolicyAcknowledged,
  };
}

type RejectResult = { status: "rejected"; reason: string };
type ApproveResult = { status: "approved"; publicationId: string };

/**
 * 신청 자동 심사(G1~G12 + §2). 통과 시 publication 생성 + 신청 approved 원자 처리,
 * 탈락 시 신청 rejected + rejectionReason 기록. 이 함수는 not-found/permission-denied/failed-precondition
 * 게이트(1~2단계)를 통과한 이후, 3단계(콘텐츠+geometry+지문+중복+유사도+상한)를 전부 이 함수 안에서 처리한다.
 */
async function runAutoReview(
  db: FirebaseFirestore.Firestore,
  requestId: string,
  uid: string,
  req: PublicRouteRequestDoc,
  tier: ApplicantTier,
): Promise<RejectResult | ApproveResult> {
  // 3a. 제목·소개 구조 + 금칙어 + 개인정보 + URL, 태그, 명명 정책 동의
  const structureVerdict = checkTitleSummaryStructure(req.publicTitle, req.publicSummary);
  if (!structureVerdict.ok) return { status: "rejected", reason: structureVerdict.reason };

  const urlVerdict = checkUrlCount(req.publicTitle, req.publicSummary, countHttpUrls);
  if (!urlVerdict.ok) return { status: "rejected", reason: urlVerdict.reason };

  const { verdict: bannedVerdict, matched } = checkBannedWords(req.publicTitle, req.publicSummary);
  if (!bannedVerdict.ok) {
    console.info("[autoReviewPublicRoute] banned word matched", { requestId, uid, matched });
    return { status: "rejected", reason: bannedVerdict.reason };
  }

  const privateInfoVerdict = checkPrivateInfo(req.publicTitle, req.publicSummary);
  if (!privateInfoVerdict.ok) return { status: "rejected", reason: privateInfoVerdict.reason };

  const tagsVerdict = checkExperienceTags(req.experienceTags);
  if (!tagsVerdict.ok) return { status: "rejected", reason: tagsVerdict.reason };

  if (req.namingPolicyAcknowledged !== true) {
    return { status: "rejected", reason: "공개 제목 정책에 동의한 뒤 신청할 수 있습니다." };
  }

  // 3b. geometry
  const coords = parseAndValidateCoordsJson(req.geometryCoordsJson);
  if (!coords) {
    return { status: "rejected", reason: "경로 좌표 수가 비정상입니다." };
  }
  const coordCountVerdict = checkCoordCount(coords);
  if (!coordCountVerdict.ok) return { status: "rejected", reason: coordCountVerdict.reason };

  const lengthMeters = polylineLengthMeters(coords);
  const densityVerdict = checkCoordDensity(coords, lengthMeters);
  if (!densityVerdict.ok) return { status: "rejected", reason: densityVerdict.reason };

  const lengthVerdict = checkRouteLength(lengthMeters);
  if (!lengthVerdict.ok) return { status: "rejected", reason: lengthVerdict.reason };

  const bboxVerdict = checkBboxDiagonal(coords);
  if (!bboxVerdict.ok) return { status: "rejected", reason: bboxVerdict.reason };

  // 3c. 지문
  const profile: RouteProfile = resolveRouteProfile(req.snapshotProfile);
  const computedFingerprint = computeRouteFingerprintHex(coords as LngLat[], profile);
  if (req.routeFingerprint && req.routeFingerprint !== computedFingerprint) {
    return {
      status: "rejected",
      reason: "경로 데이터가 원본 저장 경로와 일치하지 않습니다. 새로고침 후 다시 시도하세요.",
    };
  }

  const savedRouteSnap = await db.collection(SAVED_ROUTES_COLLECTION).doc(req.savedRouteId).get();
  if (!savedRouteSnap.exists) {
    return { status: "rejected", reason: "본인 저장 경로를 찾을 수 없습니다. 새로고침 후 다시 시도하세요." };
  }
  const savedRouteData = savedRouteSnap.data() ?? {};
  if (savedRouteData.userId !== uid) {
    return { status: "rejected", reason: "본인 저장 경로를 찾을 수 없습니다. 새로고침 후 다시 시도하세요." };
  }
  const savedRouteFingerprint =
    typeof savedRouteData.routeFingerprint === "string" && savedRouteData.routeFingerprint.length === 64
      ? savedRouteData.routeFingerprint
      : null;
  if (savedRouteFingerprint && savedRouteFingerprint !== computedFingerprint) {
    return {
      status: "rejected",
      reason: "경로 데이터가 원본 저장 경로와 일치하지 않습니다. 새로고침 후 다시 시도하세요.",
    };
  }

  // 3d. 중복
  const dupPublishedByFingerprint = await db
    .collection(ROUTE_PUBLICATIONS_COLLECTION)
    .where("routeFingerprint", "==", computedFingerprint)
    .where("status", "==", "published")
    .limit(1)
    .get();
  if (!dupPublishedByFingerprint.empty) {
    return {
      status: "rejected",
      reason: "이미 퍼블릭 코스로 등록된 동일한 경로입니다(이동 수단·꼭짓점 기준).",
    };
  }

  const dupPublishedByRouteId = await db
    .collection(ROUTE_PUBLICATIONS_COLLECTION)
    .where("routeId", "==", req.savedRouteId)
    .where("status", "==", "published")
    .limit(1)
    .get();
  if (!dupPublishedByRouteId.empty) {
    return { status: "rejected", reason: "이 저장 경로는 이미 퍼블릭으로 등록되어 있습니다." };
  }

  const dupPendingByFingerprint = await db
    .collection(PUBLIC_ROUTE_REQUESTS_COLLECTION)
    .where("routeFingerprint", "==", computedFingerprint)
    .where("status", "==", "pending")
    .limit(16)
    .get();
  for (const d of dupPendingByFingerprint.docs) {
    if (d.id === requestId) continue;
    return { status: "rejected", reason: "동일한 경로로 심사 대기 중인 신청이 이미 있습니다." };
  }

  // 3e. 유사도
  const publishedSnap = await db
    .collection(ROUTE_PUBLICATIONS_COLLECTION)
    .where("status", "==", "published")
    .limit(100)
    .get();
  for (const d of publishedSnap.docs) {
    const data = d.data();
    if (data.snapshotProfile !== profile) continue;
    const otherJson = data.geometryCoordsJson;
    if (typeof otherJson !== "string") continue;
    const other = parseAndValidateCoordsJson(otherJson);
    if (!other) continue;
    if (routePolylineSimilaritySymmetric(coords, other) >= PUBLIC_ROUTE_SIMILARITY_BLOCK) {
      return {
        status: "rejected",
        reason: "이미 등록된 퍼블릭 코스와 경로 형태가 너무 유사합니다(같은 이동 수단, 약 90% 이상).",
      };
    }
  }

  const pendingSnap = await db
    .collection(PUBLIC_ROUTE_REQUESTS_COLLECTION)
    .where("status", "==", "pending")
    .limit(80)
    .get();
  for (const d of pendingSnap.docs) {
    if (d.id === requestId) continue;
    const data = d.data();
    if (data.snapshotProfile !== profile) continue;
    const otherJson = data.geometryCoordsJson;
    if (typeof otherJson !== "string") continue;
    const other = parseAndValidateCoordsJson(otherJson);
    if (!other) continue;
    if (routePolylineSimilaritySymmetric(coords, other) >= PUBLIC_ROUTE_SIMILARITY_BLOCK) {
      return {
        status: "rejected",
        reason: "심사 대기 중인 다른 신청과 경로가 너무 유사합니다(같은 이동 수단, 약 90% 이상).",
      };
    }
  }

  // 3f. 미완주 출판 상한(선점 방지, 정책 §2) — admin 은 무제한
  if (tier !== "admin") {
    const myPublishedSnap = await db
      .collection(ROUTE_PUBLICATIONS_COLLECTION)
      .where("applicantUid", "==", uid)
      .where("status", "==", "published")
      .limit(60)
      .get();
    const routeIds = myPublishedSnap.docs
      .map((d) => d.data().routeId)
      .filter((v): v is string => typeof v === "string");
    let unriddenCount = 0;
    if (routeIds.length > 0) {
      const refs = routeIds.map((id) => db.collection(SAVED_ROUTES_COLLECTION).doc(id));
      const snaps = await db.getAll(...refs);
      for (const s of snaps) {
        if (!s.exists) {
          unriddenCount += 1;
          continue;
        }
        const completed = s.data()?.completed;
        if (!(completed === 1 || completed === true)) {
          unriddenCount += 1;
        }
      }
    }
    const capVerdict = checkUnriddenPublicationCap(tier, unriddenCount);
    if (!capVerdict.ok) return { status: "rejected", reason: capVerdict.reason };
  }

  // 통과 — 원자적 배치 처리
  const publicationRef = db.collection(ROUTE_PUBLICATIONS_COLLECTION).doc();
  const requestRef = db.collection(PUBLIC_ROUTE_REQUESTS_COLLECTION).doc(requestId);
  const batch = db.batch();
  batch.set(publicationRef, {
    routeId: req.savedRouteId,
    publicTitle: req.publicTitle,
    publicSummary: req.publicSummary.length > 0 ? req.publicSummary : null,
    status: "published",
    revision: 1,
    routeFingerprint: computedFingerprint,
    geometryCoordsJson: req.geometryCoordsJson,
    snapshotProfile: profile,
    snapshotDistanceMeters: req.snapshotDistanceMeters,
    snapshotDurationSec: req.snapshotDurationSec,
    applicantUid: uid,
    sourcePublicRouteRequestId: requestId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(requestRef, {
    status: "approved",
    createdPublicationId: publicationRef.id,
    autoReviewed: true,
    reviewerUid: null,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  console.info("[autoReviewPublicRoute] approved", {
    requestId,
    uid,
    publicationId: publicationRef.id,
  });
  return { status: "approved", publicationId: publicationRef.id };
}

async function rejectRequest(
  db: FirebaseFirestore.Firestore,
  requestId: string,
  uid: string,
  reason: string,
): Promise<RejectResult> {
  await db.collection(PUBLIC_ROUTE_REQUESTS_COLLECTION).doc(requestId).update({
    status: "rejected",
    rejectionReason: reason,
    autoReviewed: true,
    reviewerUid: null,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.info("[autoReviewPublicRoute] rejected", { requestId, uid, reason });
  return { status: "rejected", reason };
}

async function handleAutoReview(
  requestId: string,
  uid: string,
): Promise<RejectResult | ApproveResult> {
  const db = getFirestore();
  const requestRef = db.collection(PUBLIC_ROUTE_REQUESTS_COLLECTION).doc(requestId);
  const snap = await requestRef.get();
  if (!snap.exists) {
    throw new AutoReviewInternalError(`publicRouteRequests/${requestId} 문서가 없습니다.`, "not-found");
  }
  const data = snap.data()!;
  const req = readRequestDoc(data);
  if (req.applicantUid !== uid) {
    throw new AutoReviewInternalError("본인 신청만 처리할 수 있습니다.", "permission-denied");
  }
  if (req.status !== "pending") {
    throw new AutoReviewInternalError("심사 대기 중인 신청만 처리할 수 있습니다.", "failed-precondition");
  }

  // 2. tier 확인 — Guest 등은 자동 거절 처리
  const userSnap = await db.collection("users").doc(uid).get();
  const rawTier = userSnap.data()?.tier;
  if (rawTier !== "registered_free" && rawTier !== "registered_paid" && rawTier !== "admin") {
    return rejectRequest(
      db,
      requestId,
      uid,
      "퍼블릭 등록은 Google 로그인 후 닉네임을 설정한 계정에서만 할 수 있습니다.",
    );
  }
  const tier = rawTier as ApplicantTier;

  const outcome = await runAutoReview(db, requestId, uid, req, tier);
  if (outcome.status === "rejected") {
    return rejectRequest(db, requestId, uid, outcome.reason);
  }
  return outcome;
}

function mapInternalError(e: AutoReviewInternalError): HttpsError {
  return new HttpsError(e.status, e.message);
}

async function handleAutoReviewPublicRouteRequest(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    res.status(405).send("Method Not Allowed");
    return;
  }

  let uid: string;
  try {
    uid = await assertBearerApplicant(req);
  } catch (e: unknown) {
    if (e instanceof HttpsError) {
      res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
      return;
    }
    throw e;
  }

  let rawBody: unknown = req.body;
  if (typeof rawBody === "string") {
    try {
      rawBody = JSON.parse(rawBody) as unknown;
    } catch {
      const err = new HttpsError("invalid-argument", "JSON 본문이 올바르지 않습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
      return;
    }
  }

  try {
    const { requestId } = parseRequestBody(rawBody);
    const result = await handleAutoReview(requestId, uid);
    res.status(200).json({ result });
  } catch (e: unknown) {
    if (e instanceof HttpsError) {
      res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
      return;
    }
    if (e instanceof AutoReviewInternalError) {
      const he = mapInternalError(e);
      res.status(he.httpErrorCode.status).json({ error: he.toJSON() });
      return;
    }
    console.error(e);
    const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
    res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
  }
}

/**
 * 퍼블릭 경로 신청 자동 심사·등록 — Admin SDK 로 G1~G12 + 미완주 출판 상한(§2)을 재검증한다.
 * 호출: POST, `Authorization: Bearer <ID 토큰>`(신청자 본인), 본문 `{ data: { requestId } }`.
 * 성공: `{ result: { status: "approved", publicationId } }` 또는 `{ result: { status: "rejected", reason } }`.
 */
export const autoReviewPublicRouteRequest = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  handleAutoReviewPublicRouteRequest,
);
