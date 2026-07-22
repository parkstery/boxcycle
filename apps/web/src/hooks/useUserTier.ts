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
    // 구독 불가(미설정·비로그인)면 구독을 걸지 않는다. 값 초기화는 아래 cleanup 이 맡는다 —
    // effect 본문에서 직접 setState 하면 cascading render(react-hooks/set-state-in-effect)라,
    // 리셋을 cleanup 한 곳으로 모아 로그아웃·user 전환·미설정 진입을 모두 여기서 처리한다.
    const reset = () => {
      setFirestoreTier(null);
      setSubscriptionStatus("none");
      setMileageTotalMeters(null);
      setMileageTotalSec(null);
      setMileageRideCount(null);
    };

    if (!configured || !user?.uid) {
      return reset;
    }

    const ref = doc(getFirebaseFirestore(), "users", user.uid);
    const unsubscribe = onSnapshot(
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
      reset,
    );
    return () => {
      unsubscribe();
      reset();
    };
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
