import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { isRouteReviewerUid } from "./savedRouteAdminPromoteCore.js";
import type { ServerUserTier } from "./userTierCore.js";

export type TierQuotaAction = "save_route" | "public_route_request" | "create_event";

export type TierQuotaLimits = {
  saveRoutePerMonth: number | null;
  saveRouteMaxActive: number | null;
  publicRouteRequestPerDay: number | null;
  publicRouteRequestPerMonth: number | null;
  createEventPerMonth: number | null;
};

export type TierQuotaUsage = {
  saveRouteCreatedThisMonth: number;
  saveRouteActiveTotal: number;
  publicRouteRequestToday: number;
  publicRouteRequestThisMonth: number;
  createEventThisMonth: number;
};

const QUOTA_BY_TIER: Record<ServerUserTier, TierQuotaLimits> = {
  anonymous: {
    saveRoutePerMonth: 3,
    saveRouteMaxActive: 5,
    publicRouteRequestPerDay: 0,
    publicRouteRequestPerMonth: 0,
    createEventPerMonth: 0,
  },
  registered_free: {
    saveRoutePerMonth: 15,
    saveRouteMaxActive: 30,
    publicRouteRequestPerDay: 5,
    publicRouteRequestPerMonth: null,
    createEventPerMonth: 0,
  },
  registered_paid: {
    saveRoutePerMonth: 50,
    saveRouteMaxActive: 100,
    publicRouteRequestPerDay: 10,
    publicRouteRequestPerMonth: null,
    createEventPerMonth: 5,
  },
  admin: {
    saveRoutePerMonth: null,
    saveRouteMaxActive: null,
    publicRouteRequestPerDay: null,
    publicRouteRequestPerMonth: null,
    createEventPerMonth: null,
  },
};

/** KST 달력 월 `YYYY-MM` */
export function kstMonthKey(now = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** KST 달력 일 `YYYY-MM-DD` */
export function kstDayKey(now = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function kstMonthStartUtc(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return new Date();
  }
  return new Date(Date.UTC(y, m - 1, 1, -9, 0, 0));
}

function kstDayStartUtc(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date();
  }
  return new Date(Date.UTC(y, m - 1, d, -9, 0, 0));
}

function resolveTierFromUserDoc(data: Record<string, unknown> | undefined): ServerUserTier {
  const t = data?.tier;
  if (
    t === "anonymous" ||
    t === "registered_free" ||
    t === "registered_paid" ||
    t === "admin"
  ) {
    return t;
  }
  if (data?.isAnonymous === true) return "anonymous";
  if (typeof data?.nickname === "string" && data.nickname.trim().length > 0) {
    return "registered_free";
  }
  return "anonymous";
}

export async function resolveEffectiveTier(uid: string): Promise<ServerUserTier> {
  if (await isRouteReviewerUid(uid)) return "admin";
  const snap = await getFirestore().doc(`users/${uid}`).get();
  return resolveTierFromUserDoc(snap.data() as Record<string, unknown> | undefined);
}

export function limitsForTier(tier: ServerUserTier): TierQuotaLimits {
  return QUOTA_BY_TIER[tier];
}

function isUnlimited(limit: number | null): boolean {
  return limit == null;
}

export async function loadTierQuotaUsage(uid: string, monthKey = kstMonthKey()): Promise<TierQuotaUsage> {
  const db = getFirestore();
  const monthStart = Timestamp.fromDate(kstMonthStartUtc(monthKey));
  const dayStart = Timestamp.fromDate(kstDayStartUtc(kstDayKey()));

  const [savedMonthSnap, savedTotalSnap, publicMonthSnap, publicDaySnap] = await Promise.all([
    db
      .collection("savedRoutes")
      .where("userId", "==", uid)
      .where("createdAt", ">=", monthStart)
      .count()
      .get(),
    db.collection("savedRoutes").where("userId", "==", uid).count().get(),
    db
      .collection("publicRouteRequests")
      .where("applicantUid", "==", uid)
      .where("createdAt", ">=", monthStart)
      .count()
      .get(),
    db
      .collection("publicRouteRequests")
      .where("applicantUid", "==", uid)
      .where("createdAt", ">=", dayStart)
      .count()
      .get(),
  ]);

  return {
    saveRouteCreatedThisMonth: savedMonthSnap.data().count,
    saveRouteActiveTotal: savedTotalSnap.data().count,
    publicRouteRequestToday: publicDaySnap.data().count,
    publicRouteRequestThisMonth: publicMonthSnap.data().count,
    createEventThisMonth: 0,
  };
}

function quotaMessage(
  tier: ServerUserTier,
  action: TierQuotaAction,
  usage: TierQuotaUsage,
  limits: TierQuotaLimits,
): string {
  if (action === "public_route_request" && tier === "anonymous") {
    return "공개 경로 신청은 Google 로그인·닉네임 등록 후 이용할 수 있습니다.";
  }
  if (action === "create_event") {
    return "이벤트 생성은 준비 중입니다. 유료 플랜에서 제공될 예정입니다.";
  }
  if (action === "save_route") {
    if (
      limits.saveRouteMaxActive != null &&
      usage.saveRouteActiveTotal >= limits.saveRouteMaxActive
    ) {
      return `저장된 경로가 최대 ${limits.saveRouteMaxActive}개입니다. 삭제하거나 완주 격상 후 다시 시도하세요.`;
    }
    if (
      limits.saveRoutePerMonth != null &&
      usage.saveRouteCreatedThisMonth >= limits.saveRoutePerMonth
    ) {
      const hint =
        tier === "anonymous"
          ? " Google 로그인 후 한도가 늘어납니다."
          : "";
      return `이번 달 저장 가능한 경로(${limits.saveRoutePerMonth}개)를 모두 사용했습니다.${hint}`;
    }
  }
  if (action === "public_route_request") {
    if (
      limits.publicRouteRequestPerDay != null &&
      usage.publicRouteRequestToday >= limits.publicRouteRequestPerDay
    ) {
      return `오늘 공개 신청 가능 횟수(${limits.publicRouteRequestPerDay}회)를 모두 사용했습니다.`;
    }
    if (
      limits.publicRouteRequestPerMonth != null &&
      usage.publicRouteRequestThisMonth >= limits.publicRouteRequestPerMonth
    ) {
      return `이번 달 공개 신청 가능 횟수(${limits.publicRouteRequestPerMonth}회)를 모두 사용했습니다.`;
    }
  }
  return "tier quota exceeded";
}

export type AssertTierQuotaResult = {
  allowed: true;
  tier: ServerUserTier;
  action: TierQuotaAction;
  usage: TierQuotaUsage;
  limits: TierQuotaLimits;
};

export async function assertTierQuota(
  uid: string,
  action: TierQuotaAction,
): Promise<AssertTierQuotaResult> {
  const tier = await resolveEffectiveTier(uid);
  const limits = limitsForTier(tier);
  const usage = await loadTierQuotaUsage(uid);

  if (tier === "admin") {
    return { allowed: true, tier, action, usage, limits };
  }

  if (action === "create_event") {
    const cap = limits.createEventPerMonth;
    if (cap != null && cap <= 0) {
      throw new HttpsError("failed-precondition", quotaMessage(tier, action, usage, limits));
    }
    if (cap != null && usage.createEventThisMonth >= cap) {
      throw new HttpsError("resource-exhausted", quotaMessage(tier, action, usage, limits));
    }
    return { allowed: true, tier, action, usage, limits };
  }

  if (action === "save_route") {
    if (
      !isUnlimited(limits.saveRouteMaxActive) &&
      usage.saveRouteActiveTotal >= (limits.saveRouteMaxActive as number)
    ) {
      throw new HttpsError("resource-exhausted", quotaMessage(tier, action, usage, limits));
    }
    if (
      !isUnlimited(limits.saveRoutePerMonth) &&
      usage.saveRouteCreatedThisMonth >= (limits.saveRoutePerMonth as number)
    ) {
      throw new HttpsError("resource-exhausted", quotaMessage(tier, action, usage, limits));
    }
    return { allowed: true, tier, action, usage, limits };
  }

  if (action === "public_route_request") {
    if (
      !isUnlimited(limits.publicRouteRequestPerDay) &&
      limits.publicRouteRequestPerDay === 0
    ) {
      throw new HttpsError("failed-precondition", quotaMessage(tier, action, usage, limits));
    }
    if (
      !isUnlimited(limits.publicRouteRequestPerDay) &&
      usage.publicRouteRequestToday >= (limits.publicRouteRequestPerDay as number)
    ) {
      throw new HttpsError("resource-exhausted", quotaMessage(tier, action, usage, limits));
    }
    if (
      !isUnlimited(limits.publicRouteRequestPerMonth) &&
      limits.publicRouteRequestPerMonth === 0
    ) {
      throw new HttpsError("failed-precondition", quotaMessage(tier, action, usage, limits));
    }
    if (
      !isUnlimited(limits.publicRouteRequestPerMonth) &&
      usage.publicRouteRequestThisMonth >= (limits.publicRouteRequestPerMonth as number)
    ) {
      throw new HttpsError("resource-exhausted", quotaMessage(tier, action, usage, limits));
    }
    return { allowed: true, tier, action, usage, limits };
  }

  throw new HttpsError("invalid-argument", "알 수 없는 quota action 입니다.");
}

/** onCreate 롤백 — 방금 생성된 1건 포함해 한도 초과면 문서 삭제 */
export async function rollbackSavedRouteIfOverQuota(
  routeId: string,
  userId: string,
): Promise<boolean> {
  try {
    await assertTierQuota(userId, "save_route");
    return false;
  } catch (e) {
    if (e instanceof HttpsError && e.code === "resource-exhausted") {
      await getFirestore().doc(`savedRoutes/${routeId}`).delete();
      console.warn("[tierQuota] rolled back savedRoutes", routeId, userId, e.message);
      return true;
    }
    throw e;
  }
}

export async function rollbackPublicRouteRequestIfOverQuota(
  requestId: string,
  applicantUid: string,
): Promise<boolean> {
  try {
    await assertTierQuota(applicantUid, "public_route_request");
    return false;
  } catch (e) {
    if (
      e instanceof HttpsError &&
      (e.code === "resource-exhausted" || e.code === "failed-precondition")
    ) {
      await getFirestore().doc(`publicRouteRequests/${requestId}`).delete();
      console.warn("[tierQuota] rolled back publicRouteRequests", requestId, applicantUid, e.message);
      return true;
    }
    throw e;
  }
}
