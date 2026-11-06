import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { isGuestLifecycleBlockedError } from "./guestLifecycleGuard.js";
import { loadPublicationOwners } from "./leaderboardCore.js";
import { homeScoreScopes, type RideScoreInput } from "./leaderboardScoresCore.js";
import { continentOfCountry } from "./geoRegion/geoRegionData.js";
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
  const byRegion = parseByRegion(cr?.byRegion);
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
    ...(byRegion ? { byRegion } : {}),
  };
}

/** conquestResult.byRegion → 대륙·국가·meters 만. 배열이 아니거나 항목 형식이 틀리면 undefined(옛 주행 호환). */
function parseByRegion(raw: unknown): RideScoreInput["byRegion"] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<RideScoreInput["byRegion"]>[number][] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return undefined;
    const o = r as Record<string, unknown>;
    const meters = o.meters;
    if (typeof meters !== "number" || !Number.isFinite(meters)) return undefined;
    const code = (v: unknown): string | null | undefined =>
      v == null ? null : typeof v === "string" ? v : undefined;
    const continent = code(o.continent);
    const country = code(o.country);
    if (continent === undefined || country === undefined) return undefined;
    out.push({ continent, country, meters });
  }
  return out;
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
    const [owners, member, homeCountry] = await Promise.all([
      publicationId ? loadPublicationOwners(db, [publicationId]) : Promise.resolve(new Map<string, string>()),
      isMemberAccount(userId),
      loadHomeCountry(db, userId),
    ]);
    const input = rideScoreInputFromData(rideId, afterData, publicationId ? (owners.get(publicationId) ?? null) : null);
    if (!input) return;
    // G3-2: 거리 판은 주행 시점의 대표 국가로 대륙·국가 범위에도 더한다(회원만 — 게스트는 국가가 없다)
    if (member) input.distanceScopes = homeScoreScopes(homeCountry, continentOfCountry);

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

/** users/{uid}.homeCountry — 없으면 null. */
export async function loadHomeCountry(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<string | null> {
  const hc = (await db.doc(`users/${uid}`).get()).get("homeCountry");
  return typeof hc === "string" ? hc : null;
}

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
