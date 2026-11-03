import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { isGuestLifecycleBlockedError } from "./guestLifecycleGuard.js";
import { loadPublicationOwners } from "./leaderboardCore.js";
import type { RideScoreInput } from "./leaderboardScoresCore.js";
import { applyRideScoresInTransaction } from "./leaderboardScoresStore.js";
import { REGION } from "./region.js";
import { toMillis } from "./rideMetricsCore.js";

/**
 * 리더보드 누적 점수 — 완료 주행에 `conquestResult.tier` 가 **처음 생길 때**(conquestOnRideCreated 가 채운 직후)
 * 사용자별 점수 문서에 더한다. 계약: document/ops/20261103-global-geo-data/02-task-g3-leaderboard-scores.md.
 *
 * 한 트랜잭션 안에서 원장(leaderboardScoreApplied/{rideId})으로 멱등을 지키므로 트리거가 두 번 와도 한 번만 더한다.
 * 회원 여부(Auth)와 개척판 소유자(routePublications)는 트랜잭션 밖에서 미리 읽는다.
 */

/** rides 문서 데이터 → 점수 입력. 인정 대상이 아니면 null. (백필 CLI 도 같은 변환을 쓴다.) */
export function rideScoreInputFromData(
  rideId: string,
  data: Record<string, unknown>,
  publicationOwnerUid: string | null,
): RideScoreInput | null {
  const userId = typeof data.userId === "string" ? data.userId : "";
  if (!userId) return null;
  const cr = data.conquestResult as Record<string, unknown> | undefined;
  const tier = typeof cr?.tier === "string" ? cr.tier : null;
  if (!tier) return null;
  return {
    rideId,
    userId,
    endedAtMs: toMillis(data.endedAt),
    timeZone: typeof data.timeZone === "string" ? data.timeZone : null,
    tier,
    distanceMeters: Number(data.distanceMeters),
    newMeters: Number(cr?.newMeters),
    publicationId:
      typeof data.publicationId === "string" && data.publicationId ? data.publicationId : null,
    publicationOwnerUid,
  };
}

export const leaderboardScoresOnRideWritten = onDocumentWritten(
  { document: "rides/{rideId}", region: REGION },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after?.exists) return;
    const afterData = after.data() as Record<string, unknown>;
    const beforeData = before?.exists ? (before.data() as Record<string, unknown>) : undefined;
    const tierOf = (d: Record<string, unknown> | undefined): unknown =>
      (d?.conquestResult as Record<string, unknown> | undefined)?.tier;
    // tier 가 처음 생길 때만 — 이후의 다른 갱신은 전부 무시한다.
    if (typeof tierOf(afterData) !== "string" || typeof tierOf(beforeData) === "string") return;
    if (afterData.status !== "completed") return;

    const rideId = event.params.rideId;
    const userId = typeof afterData.userId === "string" ? afterData.userId : "";
    if (!userId) return;

    const db = getFirestore();
    const publicationId =
      typeof afterData.publicationId === "string" && afterData.publicationId ? afterData.publicationId : null;
    const [owners, member] = await Promise.all([
      publicationId ? loadPublicationOwners(db, [publicationId]) : Promise.resolve(new Map<string, string>()),
      isMemberAccount(userId),
    ]);
    const input = rideScoreInputFromData(rideId, afterData, publicationId ? (owners.get(publicationId) ?? null) : null);
    if (!input) return;

    try {
      await db.runTransaction(async (tx) => {
        await applyRideScoresInTransaction(tx, db, input, member, FieldValue.serverTimestamp());
      });
    } catch (e) {
      if (isGuestLifecycleBlockedError(e)) {
        // tombstone 뒤 지연 도착 — 재생성 금지 계약의 정상 종료. 재시도 대상이 아니다.
        console.warn("leaderboardScoresOnRideWritten skipped behind guestLifecycle tombstone", rideId, userId, e.guestLifecycleStatus);
        return;
      }
      throw e;
    }
  },
);

/** Auth 에서 익명이 아닌(provider 연결된) 계정만 회원. 없는 uid 는 회원이 아니다(leaderboardCore.loadMemberUids 와 같은 기준). */
async function isMemberAccount(uid: string): Promise<boolean> {
  try {
    const u = await getAuth().getUser(uid);
    return !(u.providerData.length === 0 || u.providerData.every((p) => p.providerId === "anonymous"));
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "auth/user-not-found") return false;
    throw e;
  }
}
