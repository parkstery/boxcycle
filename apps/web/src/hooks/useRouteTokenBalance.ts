import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ensureRouteTokenOnboardingClient,
  subscribeRouteTokenBalance,
} from "../lib/account/repo/firestoreRouteToken";

/**
 * `users/{uid}.routeTokenBalance` 실시간 구독 + 로그인 시 온보딩 지급 HTTP 1회.
 */
export function useRouteTokenBalance(user: User | null, configured: boolean) {
  const [balance, setBalance] = useState<number | null>(null);
  const [onboardingDoneForUid, setOnboardingDoneForUid] = useState<string | null>(null);

  const active = configured && !!user;
  const uid = active && user ? user.uid : "";

  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active) {
      setBalance(null);
      setOnboardingDoneForUid(null);
    }
  }

  const onboardingPending = Boolean(uid) && onboardingDoneForUid !== uid;

  useEffect(() => {
    if (!active || !user) return;

    let cancelled = false;
    const effectUid = user.uid;
    void ensureRouteTokenOnboardingClient(user).finally(() => {
      if (!cancelled) setOnboardingDoneForUid(effectUid);
    });

    const unsub = subscribeRouteTokenBalance(user.uid, (next) => {
      if (!cancelled) setBalance(next);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [active, user]);

  return { routeTokenBalance: balance, routeTokenLoading: onboardingPending && balance === null };
}
