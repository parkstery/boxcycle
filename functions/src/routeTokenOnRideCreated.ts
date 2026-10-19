import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { isGuestLifecycleBlockedError } from "./guestLifecycleGuard.js";
import { earnRouteTokenForCompletedRide, ensureRouteTokenOnboarding } from "./routeTokenCore.js";
import { REGION } from "./region.js";

/**
 * `rides` 완주 저장 시 Route Token 적립(멱등).
 *
 * 지연 trigger 경합(02-task-09 §2): 지급·적립 routeTokenCore transaction 이
 * guestLifecycle marker 를 같은 transaction 으로 먼저 읽어 tombstone 뒤 users 원장·
 * routeTokenLedger 재생성을 거절한다. 이 trigger 는 그 차단 종료만 구분해 기록한다.
 */
export const routeTokenOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const userId = typeof data.userId === "string" ? data.userId.trim() : "";
    if (!userId) return;

    const rideId = event.params.rideId;
    const publicationId =
      typeof data.publicationId === "string" ? data.publicationId.trim() : "";
    const distanceMeters = Number(data.distanceMeters ?? 0);
    const elapsedSec = Number(data.elapsedSec ?? 0);
    const status = typeof data.status === "string" ? data.status : "";

    const userSnap = await getFirestore().doc(`users/${userId}`).get();
    const isAnonymous = userSnap.data()?.isAnonymous === true;

    try {
      await ensureRouteTokenOnboarding(userId, isAnonymous);
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
      if (isGuestLifecycleBlockedError(e)) {
        // tombstone 뒤 지연 도착 — 재생성 금지 계약의 정상 종료. 재시도 대상이 아니다.
        console.warn(
          "routeTokenOnRideCreated skipped behind guestLifecycle tombstone",
          rideId,
          userId,
          e.guestLifecycleStatus,
        );
        return;
      }
      console.error("routeTokenOnRideCreated failed", rideId, userId, e);
    }
  },
);
