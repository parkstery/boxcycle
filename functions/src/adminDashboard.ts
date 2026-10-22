import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import {
  aggregateRideMetrics,
  buildAdminDashboardPayload,
  countPendingPublicRouteRequests,
  loadAuthAccounts,
  loadExcludedUids,
  loadRideRows,
} from "./rideMetricsCore.js";
import { isRouteReviewerUid } from "./savedRouteAdminPromoteCore.js";
import { REGION } from "./region.js";

type AccessDenyReason = "no_token" | "invalid_token" | "not_admin";

/** 접근 기록 — Cloud Functions 구조화 로그로만 남긴다(uid 만, 토큰·이메일·응답 내용 없음). */
function logAccess(uid: string | null, allowed: boolean, reason?: AccessDenyReason): void {
  logger.info("admin_dashboard_access", allowed ? { uid, allowed } : { uid, allowed, reason });
}

/** `Authorization: Bearer <토큰>` 에서 토큰만 꺼낸다. 형식이 아니면 null. */
export function parseBearerToken(header: string | undefined): string | null {
  const match = (header ?? "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function assertBearerRouteReviewer(req: Request): Promise<string> {
  const token = parseBearerToken(req.get("Authorization"));
  if (!token) {
    logAccess(null, false, "no_token");
    throw new HttpsError("unauthenticated", "Authorization: Bearer 가 필요합니다.");
  }
  let decoded: { uid: string };
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    logAccess(null, false, "invalid_token");
    throw new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다.");
  }
  const ok = await isRouteReviewerUid(decoded.uid);
  if (!ok) {
    logAccess(decoded.uid, false, "not_admin");
    throw new HttpsError(
      "permission-denied",
      "config/routeReviewers 의 uids 에 등록된 계정만 호출할 수 있습니다.",
    );
  }
  logAccess(decoded.uid, true);
  return decoded.uid;
}

async function handleGetAdminDashboard(req: Request, res: Response): Promise<void> {
  if (req.method !== "GET") {
    res.set("Allow", "GET");
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    await assertBearerRouteReviewer(req);

    const db = getFirestore();
    const nowMs = Date.now();
    const [accounts, ridesLoaded, excludeUids, pending] = await Promise.all([
      loadAuthAccounts(),
      loadRideRows(db),
      loadExcludedUids(db),
      countPendingPublicRouteRequests(db),
    ]);
    const agg = aggregateRideMetrics({
      accounts,
      rides: ridesLoaded.rows,
      excludeUids,
      nowMs,
      scannedRides: ridesLoaded.scanned,
    });
    res.set("Cache-Control", "no-store");
    res.status(200).json(buildAdminDashboardPayload(agg, nowMs, pending));
  } catch (e: unknown) {
    if (e instanceof HttpsError) {
      res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
      return;
    }
    console.error(e);
    const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
    res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
  }
}

/**
 * 관리자 화면용 지표(사용자 지표·최근 현황·점검 숫자) — 읽기 전용.
 * 호출: GET, `Authorization: Bearer <ID 토큰>`. 계약은 document/ops/20261023-admin-dashboard/01-plan.md.
 * 권한: Firestore `config/routeReviewers` 문서의 `uids` 에 포함된 Firebase Auth uid (adminPromoteSavedRoute 와 동일).
 */
export const getAdminDashboard = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  handleGetAdminDashboard,
);
