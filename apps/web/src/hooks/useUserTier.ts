import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseFirestore } from "../lib/firebase";
import type { UserTier } from "../lib/firestoreUser";
import type { SubscriptionStatus } from "../lib/subscription";
import {
  canSubmitPublicRoute,
  isGuestTier,
  isPaidTier,
  isUserTier,
  resolveEffectiveTier,
} from "../lib/userTier";

function normalizeSubscriptionStatus(raw: unknown): SubscriptionStatus {
  if (raw === "active" || raw === "past_due" || raw === "canceled") return raw;
  return "none";
}

/** users 문서의 마일리지 숫자 필드 — 없거나 유효하지 않으면 null */
function normalizeMileageNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function useUserTier(user: User | null, configured: boolean) {
  const [firestoreTier, setFirestoreTier] = useState<UserTier | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("none");
  /** 마일리지(누적 운동 이력) — 서버 집계, users/{uid}.mileage* */
  const [mileageTotalMeters, setMileageTotalMeters] = useState<number | null>(null);
  const [mileageTotalSec, setMileageTotalSec] = useState<number | null>(null);
  const [mileageRideCount, setMileageRideCount] = useState<number | null>(null);

  useEffect(() => {
    if (!configured || !user?.uid) {
      setFirestoreTier(null);
      setSubscriptionStatus("none");
      setMileageTotalMeters(null);
      setMileageTotalSec(null);
      setMileageRideCount(null);
      return;
    }
    const ref = doc(getFirebaseFirestore(), "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        const raw = data?.tier;
        setFirestoreTier(isUserTier(raw) ? raw : null);
        setSubscriptionStatus(normalizeSubscriptionStatus(data?.subscriptionStatus));
        setMileageTotalMeters(normalizeMileageNumber(data?.mileageTotalMeters));
        setMileageTotalSec(normalizeMileageNumber(data?.mileageTotalSec));
        setMileageRideCount(normalizeMileageNumber(data?.mileageRideCount));
      },
      () => {
        setFirestoreTier(null);
        setSubscriptionStatus("none");
        setMileageTotalMeters(null);
        setMileageTotalSec(null);
        setMileageRideCount(null);
      },
    );
  }, [configured, user?.uid]);

  return useMemo(() => {
    const tier = resolveEffectiveTier(user, firestoreTier);
    return {
      firestoreTier,
      tier,
      subscriptionStatus,
      isGuest: isGuestTier(firestoreTier, user),
      isPaid: isPaidTier(tier),
      canSubmitPublicRoute: canSubmitPublicRoute(firestoreTier, user),
      mileageTotalMeters,
      mileageTotalSec,
      mileageRideCount,
    };
  }, [
    user,
    firestoreTier,
    subscriptionStatus,
    mileageTotalMeters,
    mileageTotalSec,
    mileageRideCount,
  ]);
}
