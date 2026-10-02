/* eslint-disable react-hooks/set-state-in-effect -- grace arm/disarm mirrors visibility; timeout clears */
import { useEffect, useState } from "react";
import { LISTENER_VISIBILITY_GRACE_MS } from "../lib/trail/listenerVisibilityGracePolicy";

/**
 * Keep a listener "open" intent warm for {@link LISTENER_VISIBILITY_GRACE_MS} after hide.
 * `sessionKey` change (uid/Trail/…) drops grace in the same render — caller tears down too.
 */
export function useVisibilityListenGrace(
  eligible: boolean,
  pageVisible: boolean,
  sessionKey = "",
  graceMs: number = LISTENER_VISIBILITY_GRACE_MS,
): boolean {
  const [graceArmed, setGraceArmed] = useState(false);
  const [warmSession, setWarmSession] = useState(sessionKey);

  // Trail/uid 전환은 grace 없이 즉시 끊는다 (render-phase reset).
  if (warmSession !== sessionKey) {
    setWarmSession(sessionKey);
    setGraceArmed(false);
  }

  useEffect(() => {
    if (!eligible) {
      setGraceArmed(false);
      return;
    }
    if (pageVisible) {
      setGraceArmed(true);
      return;
    }
    if (!graceArmed) return;
    const t = window.setTimeout(() => setGraceArmed(false), graceMs);
    return () => window.clearTimeout(t);
  }, [eligible, pageVisible, sessionKey, graceMs, graceArmed]);

  return Boolean(eligible && pageVisible) || Boolean(eligible && !pageVisible && graceArmed);
}

export { LISTENER_VISIBILITY_GRACE_MS };
