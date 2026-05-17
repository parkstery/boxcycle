import { FieldValue, getFirestore } from "firebase-admin/firestore";

/** 클라이언트 `promoteSavedRouteInFirestore` 와 동일한 필드 갱신(Admin SDK 전용). */
export class PromoteSavedRouteError extends Error {
  constructor(
    message: string,
    readonly status: "not-found" | "failed-precondition" | "invalid-argument",
  ) {
    super(message);
    this.name = "PromoteSavedRouteError";
  }
}

export async function isRouteReviewerUid(uid: string): Promise<boolean> {
  const snap = await getFirestore().doc("config/routeReviewers").get();
  if (!snap.exists) return false;
  const uids = snap.data()?.uids;
  return Array.isArray(uids) && uids.some((x: unknown) => x === uid);
}

export type PromoteSavedRouteAdminResult = {
  routeId: string;
  alreadyCompleted: boolean;
  userId: string;
};

/**
 * `savedRoutes/{routeId}` 를 완주 상태로 격상한다.
 * @param rideId `undefined` 이면 기존 문서의 `lastRideId` 유지, `null` 이면 null 로 덮어씀.
 */
export async function promoteSavedRouteWithAdminSdk(input: {
  routeId: string;
  actorUid: string;
  rideId?: string | null;
}): Promise<PromoteSavedRouteAdminResult> {
  const db = getFirestore();
  const ref = db.collection("savedRoutes").doc(input.routeId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new PromoteSavedRouteError(
      `savedRoutes/${input.routeId} 문서가 없습니다.`,
      "not-found",
    );
  }
  const d = snap.data()!;
  const userId = typeof d.userId === "string" ? d.userId : "";
  if (!userId) {
    throw new PromoteSavedRouteError("문서에 userId 가 없습니다.", "failed-precondition");
  }
  if (d.completed === 1) {
    console.info("[promoteSavedRouteAdmin] idempotent skip", {
      routeId: input.routeId,
      actorUid: input.actorUid,
    });
    return { routeId: input.routeId, alreadyCompleted: true, userId };
  }

  let lastRideId: string | null;
  if (input.rideId === undefined) {
    lastRideId = typeof d.lastRideId === "string" ? d.lastRideId : null;
  } else {
    lastRideId = input.rideId;
  }

  await ref.update({
    userId,
    completed: 1,
    completedAt: FieldValue.serverTimestamp(),
    expiresAt: null,
    lastRideId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.info("[promoteSavedRouteAdmin] promoted", {
    routeId: input.routeId,
    userId,
    actorUid: input.actorUid,
    lastRideId,
  });

  return { routeId: input.routeId, alreadyCompleted: false, userId };
}
