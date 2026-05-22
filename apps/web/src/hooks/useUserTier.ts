import type { User } from "firebase/auth";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseApp } from "../lib/firebase";
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

export function useUserTier(user: User | null, configured: boolean) {
  const [firestoreTier, setFirestoreTier] = useState<UserTier | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("none");

  useEffect(() => {
    if (!configured || !user?.uid) {
      setFirestoreTier(null);
      setSubscriptionStatus("none");
      return;
    }
    const ref = doc(getFirestore(getFirebaseApp()), "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        const raw = data?.tier;
        setFirestoreTier(isUserTier(raw) ? raw : null);
        setSubscriptionStatus(normalizeSubscriptionStatus(data?.subscriptionStatus));
      },
      () => {
        setFirestoreTier(null);
        setSubscriptionStatus("none");
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
    };
  }, [user, firestoreTier, subscriptionStatus]);
}
