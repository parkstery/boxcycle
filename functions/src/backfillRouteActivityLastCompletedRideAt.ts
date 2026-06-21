import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { isRouteReviewerUid } from "./savedRouteAdminPromoteCore.js";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const RIDES_COLLECTION = "rides";
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

function readEndedAt(raw: unknown): Timestamp | null {
  if (raw instanceof Timestamp) return raw;
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? (raw as Timestamp) : null;
  }
  return null;
}

type BackfillResult = {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
};

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
    const dryRun = body.dryRun === true;
    const limit = Math.min(200, Math.max(1, typeof body.limit === "number" ? body.limit : 50));
    const singlePublicationId = typeof body.publicationId === "string" ? body.publicationId.trim() : "";

    const db = getFirestore();
    const result: BackfillResult = { scanned: 0, updated: 0, skipped: 0, errors: 0 };

    let activityDocs: FirebaseFirestore.QueryDocumentSnapshot[];
    if (singlePublicationId) {
      const snap = await db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${singlePublicationId}`).get();
      activityDocs = snap.exists ? [snap as FirebaseFirestore.QueryDocumentSnapshot] : [];
    } else {
      const snap = await db.collection(ROUTE_ACTIVITY_COLLECTION).limit(limit).get();
      activityDocs = snap.docs;
    }

    for (const activityDoc of activityDocs) {
      result.scanned += 1;
      const data = activityDoc.data();
      if (data.lastCompletedRideAt != null) {
        result.skipped += 1;
        continue;
      }

      try {
        const rideSnap = await db
          .collection(RIDES_COLLECTION)
          .where("publicationId", "==", activityDoc.id)
          .where("status", "==", "completed")
          .orderBy("endedAt", "desc")
          .limit(1)
          .get();

        if (rideSnap.empty) {
          result.skipped += 1;
          continue;
        }

        const endedAt = readEndedAt(rideSnap.docs[0].get("endedAt"));
        if (!endedAt) {
          result.skipped += 1;
          continue;
        }

        if (!dryRun) {
          await db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${activityDoc.id}`).set(
            { lastCompletedRideAt: endedAt },
            { merge: true },
          );
        }
        result.updated += 1;
      } catch (e) {
        console.error("[backfillRouteActivityLastCompletedRideAt]", activityDoc.id, e);
        result.errors += 1;
      }
    }

    res.status(200).json({ result, dryRun });
  },
);
