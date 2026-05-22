import type { User } from "firebase/auth";
import type { UserTier } from "./firestoreUser";

export type { UserTier };

const REGISTERED_TIERS: readonly UserTier[] = ["registered_free", "registered_paid", "admin"];
const PUBLIC_ROUTE_TIERS: readonly UserTier[] = ["registered_free", "registered_paid", "admin"];

export function isUserTier(value: unknown): value is UserTier {
  return (
    value === "anonymous" ||
    value === "registered_free" ||
    value === "registered_paid" ||
    value === "admin"
  );
}

/** Firestore `users.tier` 없을 때 Auth 기반 추정(마이그레이션·표시용) */
export function resolveEffectiveTier(user: User | null, firestoreTier: UserTier | null): UserTier | null {
  if (!user) return null;
  if (firestoreTier) return firestoreTier;
  if (user.isAnonymous) return "anonymous";
  return null;
}

export function isGuestTier(tier: UserTier | null, user: User | null): boolean {
  const effective = resolveEffectiveTier(user, tier);
  if (effective === "anonymous") return true;
  if (isRegisteredTier(effective)) return false;
  return Boolean(user?.isAnonymous);
}

export function isRegisteredTier(tier: UserTier | null): boolean {
  return tier != null && (REGISTERED_TIERS as readonly string[]).includes(tier);
}

export function canSubmitPublicRoute(tier: UserTier | null, user: User | null): boolean {
  const effective = resolveEffectiveTier(user, tier);
  return effective != null && (PUBLIC_ROUTE_TIERS as readonly string[]).includes(effective);
}

export const GUEST_PUBLIC_ROUTE_MSG =
  "퍼블릭 경로 공개 신청은 Google 로그인 후 닉네임을 설정한 계정에서만 할 수 있습니다.";
