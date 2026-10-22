/** 보이는 동안 약 5분마다 Guest 활동. 시각은 서버가 기록한다. */
export const GUEST_ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;

export function shouldSendGuestActivity(
  lastPingMs: number | null,
  nowMs: number,
  visible: boolean,
  intervalMs = GUEST_ACTIVITY_INTERVAL_MS,
): boolean {
  if (!visible) return false;
  if (lastPingMs == null) return true;
  return nowMs - lastPingMs >= intervalMs;
}

export type GuestActivityPostResult = "ok" | "stop" | "retry";

async function runGuestActivityTick(
  state: { lastPingMs: number | null; stopped: boolean },
  env: { nowMs: number; visible: boolean; post: () => Promise<GuestActivityPostResult> },
): Promise<{ lastPingMs: number | null; stopped: boolean }> {
  if (state.stopped) return state;
  if (!shouldSendGuestActivity(state.lastPingMs, env.nowMs, env.visible)) return state;
  try {
    const result = await env.post();
    if (result === "stop") return { ...state, stopped: true };
    if (result === "ok") return { lastPingMs: env.nowMs, stopped: false };
    return state;
  } catch {
    return state;
  }
}

export function startGuestActivityWatch(
  post: () => Promise<GuestActivityPostResult>,
  env: {
    intervalMs?: number;
    now?: () => number;
    visible?: () => boolean;
    setIntervalFn?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
    clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
    target?: { addEventListener: (type: string, fn: () => void) => void; removeEventListener: (type: string, fn: () => void) => void };
  } = {},
): () => void {
  const intervalMs = env.intervalMs ?? GUEST_ACTIVITY_INTERVAL_MS;
  const now = env.now ?? (() => Date.now());
  const visible = env.visible ?? (() => (typeof document === "undefined" ? true : document.visibilityState === "visible"));
  const setIntervalFn = env.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = env.clearIntervalFn ?? ((id) => clearInterval(id));
  const target = env.target ?? (typeof document === "undefined" ? null : document);
  let state: { lastPingMs: number | null; stopped: boolean } = { lastPingMs: null, stopped: false };
  const tick = () => {
    void runGuestActivityTick(state, { nowMs: now(), visible: visible(), post }).then((next) => {
      state = next;
    });
  };
  tick();
  const timer = setIntervalFn(tick, intervalMs);
  const onVisible = () => tick();
  target?.addEventListener("visibilitychange", onVisible);
  return () => {
    state = { ...state, stopped: true };
    clearIntervalFn(timer);
    target?.removeEventListener("visibilitychange", onVisible);
  };
}
