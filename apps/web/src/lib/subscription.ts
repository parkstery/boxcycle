import type { User } from "firebase/auth";
import type { UserTier } from "./firestoreUser";

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export type SubscriptionMe = {
  tier: UserTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  stripeCustomerId: string | null;
  canCheckout: boolean;
  canManagePortal: boolean;
};

function functionsBaseUrl(): string {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) {
    throw new Error("Firebase 프로젝트가 설정되지 않았습니다.");
  }
  return `https://${region}-${projectId}.cloudfunctions.net`;
}

function parseErrorMessage(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null && "error" in json) {
    const err = (json as { error?: { message?: string } }).error;
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  }
  return fallback;
}

async function authedJson<T>(
  user: User,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const idToken = await user.getIdToken();
  const res = await fetch(`${functionsBaseUrl()}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers ?? {}),
    },
  });
  let json: { result?: T; error?: { message?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error("서버 응답을 읽을 수 없습니다.");
  }
  if (!res.ok || json.error) {
    throw new Error(parseErrorMessage(json, "요청에 실패했습니다."));
  }
  if (json.result === undefined) {
    throw new Error("서버 응답 형식이 올바르지 않습니다.");
  }
  return json.result;
}

export async function fetchSubscriptionMe(user: User): Promise<SubscriptionMe> {
  return authedJson<SubscriptionMe>(user, "getSubscriptionMeHttp", { method: "GET" });
}

export async function startSubscriptionCheckout(
  user: User,
  urls: { successUrl: string; cancelUrl: string },
): Promise<string> {
  const { checkoutUrl } = await authedJson<{ checkoutUrl: string }>(
    user,
    "createSubscriptionCheckoutHttp",
    {
      method: "POST",
      body: JSON.stringify(urls),
    },
  );
  return checkoutUrl;
}

export async function openSubscriptionPortal(user: User, returnUrl: string): Promise<string> {
  const { portalUrl } = await authedJson<{ portalUrl: string }>(
    user,
    "createSubscriptionPortalHttp",
    {
      method: "POST",
      body: JSON.stringify({ returnUrl }),
    },
  );
  return portalUrl;
}

export function tierPlanLabel(tier: UserTier | null): string {
  switch (tier) {
    case "anonymous":
      return "Guest";
    case "registered_free":
      return "Free";
    case "registered_paid":
      return "Paid";
    case "admin":
      return "Admin";
    default:
      return "—";
  }
}

export function subscriptionStatusLabelKo(status: SubscriptionStatus): string {
  switch (status) {
    case "active":
      return "구독 중";
    case "past_due":
      return "결제 지연";
    case "canceled":
      return "해지됨";
    default:
      return "미구독";
  }
}
