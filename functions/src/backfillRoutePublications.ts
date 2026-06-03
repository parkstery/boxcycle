import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { isRouteReviewerUid } from "./savedRouteAdminPromoteCore.js";

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

const REGION = "asia-northeast3";

type BackfillResult = {
  scanned: number;
  created: number;
  skipped: number;
  errors: number;
};

/**
 * 레거시 UGC `courses` → `routePublications` 1회 백필.
 * POST + Bearer (config/routeReviewers). 본문 `{ dryRun?: boolean, limit?: number }`.
 */
export const backfillRoutePublicationsHttp = onRequest(
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

    const body = (req.body ?? {}) as { dryRun?: boolean; limit?: number };
    const dryRun = body.dryRun === true;
    const limit = Math.min(200, Math.max(1, typeof body.limit === "number" ? body.limit : 100));

    const db = getFirestore();
    const snap = await db
      .collection("routeCatalog")
      .where("category", "==", "public")
      .where("status", "==", "published")
      .limit(limit)
      .get();

    const result: BackfillResult = { scanned: 0, created: 0, skipped: 0, errors: 0 };

    for (const courseDoc of snap.docs) {
      result.scanned += 1;
      const data = courseDoc.data();
      const routeId = data.sourceSavedRouteId;
      if (typeof routeId !== "string" || routeId.length < 1) {
        result.skipped += 1;
        continue;
      }

      const pubId = courseDoc.id;
      const pubRef = db.collection("routePublications").doc(pubId);
      try {
        const existing = await pubRef.get();
        if (existing.exists) {
          result.skipped += 1;
          continue;
        }

        const geometryCoordsJson = data.geometryCoordsJson;
        const routeFingerprint = data.routeFingerprint;
        if (typeof geometryCoordsJson !== "string" || geometryCoordsJson.length < 10) {
          result.skipped += 1;
          continue;
        }
        if (typeof routeFingerprint !== "string" || routeFingerprint.length !== 64) {
          result.skipped += 1;
          continue;
        }

        const payload = {
          routeId,
          courseId: courseDoc.id,
          publicTitle: typeof data.title === "string" ? data.title : "Untitled",
          publicSummary:
            typeof data.description === "string" && data.description.length > 0
              ? data.description
              : null,
          status: "published",
          revision: 1,
          routeFingerprint,
          geometryCoordsJson,
          snapshotProfile:
            data.profile === "driving" || data.profile === "walking" ? data.profile : "cycling",
          snapshotDistanceMeters:
            typeof data.distanceMeters === "number" ? data.distanceMeters : 0,
          snapshotDurationSec: typeof data.durationSec === "number" ? data.durationSec : 0,
          applicantUid: typeof data.applicantUid === "string" ? data.applicantUid : "",
          sourcePublicRouteRequestId:
            typeof data.sourcePublicRouteRequestId === "string" ? data.sourcePublicRouteRequestId : "",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        if (!dryRun) {
          await pubRef.set(payload);
        }
        result.created += 1;
      } catch (e) {
        console.error("[backfillRoutePublications]", pubId, e);
        result.errors += 1;
      }
    }

    res.status(200).json({ result: { ...result, dryRun } });
  },
);
