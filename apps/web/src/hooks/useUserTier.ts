import type { User } from "firebase/auth";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseApp } from "../lib/firebase";
import type { UserTier } from "../lib/firestoreUser";
import {
  canSubmitPublicRoute,
  isGuestTier,
  isUserTier,
  resolveEffectiveTier,
} from "../lib/userTier";

export function useUserTier(user: User | null, configured: boolean) {
  const [firestoreTier, setFirestoreTier] = useState<UserTier | null>(null);

  useEffect(() => {
    if (!configured || !user?.uid) {
      setFirestoreTier(null);
      return;
    }
    const ref = doc(getFirestore(getFirebaseApp()), "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        const raw = snap.data()?.tier;
        setFirestoreTier(isUserTier(raw) ? raw : null);
      },
      () => setFirestoreTier(null),
    );
  }, [configured, user?.uid]);

  return useMemo(() => {
    const tier = resolveEffectiveTier(user, firestoreTier);
    return {
      firestoreTier,
      tier,
      isGuest: isGuestTier(firestoreTier, user),
      canSubmitPublicRoute: canSubmitPublicRoute(firestoreTier, user),
    };
  }, [user, firestoreTier]);
}
