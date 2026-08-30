import { useEffect, useState } from "react";
import { subscribeRouteTokenEffective } from "../lib/routeTokenSpendBridge";

export function useRouteTokenEffective(): {
  balance: number | null;
  insufficient: boolean;
} {
  const [balance, setBalance] = useState<number | null>(null);
  const [insufficient, setInsufficient] = useState(false);

  useEffect(() => subscribeRouteTokenEffective((next, blocked) => {
    setBalance(next);
    setInsufficient(blocked);
  }), []);

  return { balance, insufficient };
}
