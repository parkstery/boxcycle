import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { ServerUserTier } from "./userTierCore.js";

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export type SubscriptionMe = {
  tier: ServerUserTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  stripeCustomerId: string | null;
  canCheckout: boolean;
  canManagePortal: boolean;
};

type UserSubscriptionDoc = {
  tier?: string;
  nickname?: string;
  isAnonymous?: boolean;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: Timestamp | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

export function normalizeSubscriptionStatus(raw: unknown): SubscriptionStatus {
  if (raw === "active" || raw === "past_due" || raw === "canceled") return raw;
  return "none";
}

function isRegisteredForPaid(doc: UserSubscriptionDoc | undefined): boolean {
  if (!doc) return false;
  if (doc.isAnonymous === true) return false;
  const nick = typeof doc.nickname === "string" ? doc.nickname.trim() : "";
  if (nick.length > 0) return true;
  const tier = doc.tier;
  return tier === "registered_free" || tier === "registered_paid" || tier === "admin";
}

function tierForSubscription(
  doc: UserSubscriptionDoc | undefined,
  status: SubscriptionStatus,
  expiresAt: Date | null,
): ServerUserTier {
  if (doc?.tier === "admin") return "admin";
  const now = Date.now();
  const active =
    status === "active" &&
    (!expiresAt || expiresAt.getTime() > now);
  const grace =
    status === "past_due" &&
    expiresAt != null &&
    expiresAt.getTime() > now;

  if ((active || grace) && isRegisteredForPaid(doc)) {
    return "registered_paid";
  }
  if (isRegisteredForPaid(doc)) return "registered_free";
  if (doc?.isAnonymous === true || doc?.tier === "anonymous") return "anonymous";
  return "anonymous";
}

export async function loadSubscriptionMe(uid: string): Promise<SubscriptionMe> {
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const data = snap.data() as UserSubscriptionDoc | undefined;
  const subscriptionStatus = normalizeSubscriptionStatus(data?.subscriptionStatus);
  const expiresTs = data?.subscriptionExpiresAt;
  const expiresAt =
    expiresTs instanceof Timestamp ? expiresTs.toDate() : null;
  const tier = tierForSubscription(data, subscriptionStatus, expiresAt);
  const registered = isRegisteredForPaid(data);
  const hasCustomer =
    typeof data?.stripeCustomerId === "string" && data.stripeCustomerId.length > 0;

  return {
    tier,
    subscriptionStatus,
    subscriptionExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    stripeCustomerId: hasCustomer ? data!.stripeCustomerId! : null,
    canCheckout: registered && tier !== "registered_paid" && tier !== "admin",
    canManagePortal:
      registered &&
      hasCustomer &&
      (subscriptionStatus === "active" || subscriptionStatus === "past_due"),
  };
}

export async function assertUserCanSubscribe(uid: string): Promise<UserSubscriptionDoc> {
  const snap = await getFirestore().doc(`users/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "프로필이 없습니다. 닉네임 설정 후 다시 시도하세요.");
  }
  const data = snap.data() as UserSubscriptionDoc;
  if (!isRegisteredForPaid(data)) {
    throw new HttpsError(
      "failed-precondition",
      "유료 플랜은 Google 로그인·닉네임 등록 후 이용할 수 있습니다.",
    );
  }
  if (data.tier === "admin") {
    throw new HttpsError("failed-precondition", "운영 계정은 구독이 필요 없습니다.");
  }
  return data;
}

export type ApplySubscriptionInput = {
  status: SubscriptionStatus;
  expiresAt: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

/** Stripe Webhook·만료 스윕 — tier·subscription 필드 갱신(클라이언트 쓰기 금지) */
export async function applySubscriptionState(
  uid: string,
  input: ApplySubscriptionInput,
): Promise<{ tier: ServerUserTier; subscriptionStatus: SubscriptionStatus }> {
  const ref = getFirestore().doc(`users/${uid}`);
  const snap = await ref.get();
  const existing = snap.data() as UserSubscriptionDoc | undefined;
  const status = input.status;
  const expiresAt = input.expiresAt;
  const tier = tierForSubscription(existing, status, expiresAt);

  const patch: Record<string, unknown> = {
    subscriptionStatus: status,
    subscriptionExpiresAt:
      expiresAt != null ? Timestamp.fromDate(expiresAt) : null,
    tier,
    tierUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (input.stripeCustomerId !== undefined) {
    patch.stripeCustomerId = input.stripeCustomerId;
  }
  if (input.stripeSubscriptionId !== undefined) {
    patch.stripeSubscriptionId = input.stripeSubscriptionId;
  }

  await ref.set(patch, { merge: true });
  return { tier, subscriptionStatus: status };
}

/** Stripe Subscription.status → 내부 상태 */
export function mapStripeSubscriptionStatus(
  stripeStatus: string,
): SubscriptionStatus {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due") return "past_due";
  if (
    stripeStatus === "canceled" ||
    stripeStatus === "unpaid" ||
    stripeStatus === "incomplete_expired"
  ) {
    return "canceled";
  }
  return "none";
}

export async function markWebhookEventProcessed(eventId: string): Promise<boolean> {
  const ref = getFirestore().doc(`billingProcessedEvents/${eventId}`);
  const snap = await ref.get();
  if (snap.exists) return true;
  await ref.set({
    processedAt: FieldValue.serverTimestamp(),
  });
  return false;
}

/** 만료 시각 경과 + active 아님 → registered_free 강등 */
export async function sweepExpiredSubscriptions(limit = 200): Promise<number> {
  const db = getFirestore();
  const now = Timestamp.now();
  const snap = await db
    .collection("users")
    .where("tier", "==", "registered_paid")
    .where("subscriptionExpiresAt", "<=", now)
    .limit(limit)
    .get();

  let downgraded = 0;
  for (const doc of snap.docs) {
    const status = normalizeSubscriptionStatus(doc.data().subscriptionStatus);
    if (status === "active") continue;
    await applySubscriptionState(doc.id, {
      status: "canceled",
      expiresAt: null,
      stripeSubscriptionId: null,
    });
    downgraded++;
  }
  return downgraded;
}
