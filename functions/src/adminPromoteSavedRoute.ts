import { getAuth } from "firebase-admin/auth";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import {
  isRouteReviewerUid,
  PromoteSavedRouteError,
  promoteSavedRouteWithAdminSdk,
} from "./savedRouteAdminPromoteCore.js";

const REGION = "asia-northeast3";

async function assertBearerRouteReviewer(req: Request): Promise<string> {
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
  const ok = await isRouteReviewerUid(decoded.uid);
  if (!ok) {
    throw new HttpsError(
      "permission-denied",
      "config/routeReviewers 의 uids 에 등록된 계정만 호출할 수 있습니다.",
    );
  }
  return decoded.uid;
}

function parsePromoteBody(raw: unknown): { routeId: string; rideId?: string | null } {
  if (!raw || typeof raw !== "object") {
    throw new HttpsError("invalid-argument", "본문이 필요합니다.");
  }
  const wrap = raw as { data?: unknown };
  const data = wrap.data ?? raw;
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "data 필드(또는 루트 객체)가 필요합니다.");
  }
  const o = data as Record<string, unknown>;
  const routeId = o.routeId;
  if (typeof routeId !== "string" || !routeId.trim()) {
    throw new HttpsError("invalid-argument", "routeId 는 비어 있지 않은 문자열이어야 합니다.");
  }
  if (!("rideId" in o)) {
    return { routeId: routeId.trim() };
  }
  if (o.rideId === null) {
    return { routeId: routeId.trim(), rideId: null };
  }
  if (typeof o.rideId === "string") {
    const t = o.rideId.trim();
    return { routeId: routeId.trim(), rideId: t.length ? t : null };
  }
  throw new HttpsError("invalid-argument", "rideId 는 문자열 또는 null 만 허용됩니다.");
}

function mapPromoteError(e: PromoteSavedRouteError): HttpsError {
  if (e.status === "not-found") return new HttpsError("not-found", e.message);
  if (e.status === "failed-precondition") {
    return new HttpsError("failed-precondition", e.message);
  }
  return new HttpsError("invalid-argument", e.message);
}

async function handleAdminPromoteSavedRoute(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    res.status(405).send("Method Not Allowed");
    return;
  }

  let actorUid: string;
  try {
    actorUid = await assertBearerRouteReviewer(req);
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
    const { routeId, rideId } = parsePromoteBody(rawBody);
    const result = await promoteSavedRouteWithAdminSdk({ routeId, actorUid, rideId });
    res.status(200).json({ result });
  } catch (e: unknown) {
    if (e instanceof HttpsError) {
      res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
      return;
    }
    if (e instanceof PromoteSavedRouteError) {
      const he = mapPromoteError(e);
      res.status(he.httpErrorCode.status).json({ error: he.toJSON() });
      return;
    }
    console.error(e);
    const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
    res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
  }
}

/**
 * 저장 경로(savedRoutes) 완주 격상 — Admin SDK 로 규칙을 우회한다.
 * 호출: POST, `Authorization: Bearer <ID 토큰>`, 본문 `{ data: { routeId, rideId? } }` (getMapboxDirections 와 동일 계약).
 * 권한: Firestore `config/routeReviewers` 문서의 `uids` 배열에 포함된 Firebase Auth uid.
 */
export const adminPromoteSavedRoute = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  handleAdminPromoteSavedRoute,
);
