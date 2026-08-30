import { useEffect, useState } from "react";
import { subscribeRouteTokenSpendMessage } from "../lib/routeTokenSpendBridge";

const SPEND_TOAST_MS = 5_000;

export function useRouteTokenSpendToast(): string | null {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const clearHideTimer = () => {
      if (hideTimer != null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const unsub = subscribeRouteTokenSpendMessage((next) => {
      clearHideTimer();
      setMessage(next);
      if (next) {
        hideTimer = setTimeout(() => {
          setMessage(null);
          hideTimer = null;
        }, SPEND_TOAST_MS);
      }
    });
    return () => {
      clearHideTimer();
      unsub();
    };
  }, []);

  return message;
}
