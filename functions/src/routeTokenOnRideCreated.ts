import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { earnRouteTokenForCompletedRide, ensureRouteTokenOnboarding } from "./routeTokenCore.js";

/**
 * `rides` 완주 저장 시 Route Token 적립(멱등).
 */
export const routeTokenOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: "asia-northeast3" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const userId = typeof data.userId === "string" ? data.userId.trim() : "";
    if (!userId) return;

    const rideId = event.params.rideId;
    const publicationId =
      typeof data.publicationId === "string"
        ? data.publicationId
        : typeof data.courseId === "string"
          ? data.courseId
          : null;
    const distanceMeters = Number(data.distanceMeters ?? 0);
    const elapsedSec = Number(data.elapsedSec ?? 0);
    const status = typeof data.status === "string" ? data.status : "";

    const userSnap = await getFirestore().doc(`users/${userId}`).get();
    const isAnonymous = userSnap.data()?.isAnonymous === true;

    try {
      await ensureRouteTokenOnboarding(userId);
      await earnRouteTokenForCompletedRide({
        userId,
        rideId,
        courseId: publicationId,
        distanceMeters,
        elapsedSec,
        status,
        isAnonymous,
      });
    } catch (e) {
      console.error("routeTokenOnRideCreated failed", rideId, userId, e);
    }
  },
);
