import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ensureRouteTokenOnboardingClient,
  subscribeRouteTokenBalance,
} from "../lib/firestoreRouteToken";

/**
 * `users/{uid}.routeTokenBalance` 실시간 구독 + 로그인 시 온보딩 지급 HTTP 1회.
 */
export function useRouteTokenBalance(user: User | null, configured: boolean) {
  const [balance, setBalance] = useState<number | null>(null);
  const [onboardingPending, setOnboardingPending] = useState(false);

  useEffect(() => {
    if (!configured || !user) {
      setBalance(null);
      setOnboardingPending(false);
      return;
    }

    let cancelled = false;
    setOnboardingPending(true);
    void ensureRouteTokenOnboardingClient(user).finally(() => {
      if (!cancelled) setOnboardingPending(false);
    });

    const unsub = subscribeRouteTokenBalance(user.uid, (next) => {
      if (!cancelled) setBalance(next);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [configured, user?.uid]);

  return { routeTokenBalance: balance, routeTokenLoading: onboardingPending && balance === null };
}
