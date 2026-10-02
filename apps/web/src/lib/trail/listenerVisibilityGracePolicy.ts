/**
 * Short-hide Firestore listener grace — keep warm briefly, then close.
 * Pure policy; React timer wiring lives in useVisibilityListenGrace.
 */

export const LISTENER_VISIBILITY_GRACE_MS = 10_000;

export type ListenerGraceOpenState = {
  open: boolean;
};

export type ListenerGraceSyncInput = {
  eligible: boolean;
  pageVisible: boolean;
};

export type ListenerGraceReduceResult = {
  open: boolean;
  /** start a new grace timer; cancel clears any pending; none leaves timer unchanged */
  timer: "start" | "cancel" | "none";
  timerMs?: number;
};

export function initialListenerGraceOpenState(): ListenerGraceOpenState {
  return { open: false };
}

/**
 * Visibility / eligibility transition for a single listener group.
 * - visible + eligible → open (cancel grace)
 * - short hide while open → keep open and start grace timer
 * - grace timeout → close
 * - eligibility loss → close immediately (cancel grace)
 * - never opened + hide → stay closed
 */
export function reduceListenerVisibilityGrace(
  state: ListenerGraceOpenState,
  event: { type: "sync"; input: ListenerGraceSyncInput } | { type: "grace_timeout" },
  graceMs: number = LISTENER_VISIBILITY_GRACE_MS,
): ListenerGraceReduceResult {
  if (event.type === "grace_timeout") {
    return { open: false, timer: "none" };
  }
  const { eligible, pageVisible } = event.input;
  if (!eligible) {
    return { open: false, timer: "cancel" };
  }
  if (pageVisible) {
    return { open: true, timer: "cancel" };
  }
  if (!state.open) {
    return { open: false, timer: "none" };
  }
  return { open: true, timer: "start", timerMs: graceMs };
}
