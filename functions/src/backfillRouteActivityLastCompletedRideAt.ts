import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { isRouteReviewerUid } from "./savedRouteAdminPromoteCore.js";
import { backfillRouteActivityLastCompletedRideAt } from "./backfillRouteActivityLastCompletedRideAtCore.js";

const REGION = "asia-northeast3";

async function assertBearerRouteReviewer(req: Request): Promise<string> {
  const authHeader = req.get("Authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    throw new HttpsError("unauthenticated", "Authorization Bearer 가 필요합니다.");
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
      "config routeReviewers uids 에 등록된 계정만 호출할 수 있습니다.",
    );
  }
  return decoded.uid;
}

/**
 * routeActivity.lastCompletedRideAt 레거시 백필.
 * POST Bearer routeReviewers. 본문 dryRun limit publicationId optional.
 */
export const backfillRouteActivityLastCompletedRideAtHttp = onRequest(
  { region: REGION, cors: true, invoker: "public" },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      await assertBearerRouteReviewer(req);
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      throw e;
    }

    const body = (req.body ?? {}) as {
      dryRun?: boolean;
      limit?: number;
      publicationId?: string;
    };

    const result = await backfillRouteActivityLastCompletedRideAt({
      dryRun: body.dryRun === true,
      limit: body.limit,
      publicationId: body.publicationId,
    });

    res.status(200).json({ result, dryRun: body.dryRun === true });
  },
);
