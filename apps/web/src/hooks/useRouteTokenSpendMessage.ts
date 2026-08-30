import { useEffect, useState } from "react";
import { subscribeRouteTokenSpendMessage } from "../lib/routeTokenSpendBridge";

export function useRouteTokenSpendMessage(): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => subscribeRouteTokenSpendMessage(setMessage), []);
  return message;
}
