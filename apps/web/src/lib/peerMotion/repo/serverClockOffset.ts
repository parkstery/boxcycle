/**
 * Firebase RTDB `/.info/serverTimeOffset` 캐시.
 *
 * 추정 서버시각 = Date.now() + offset. 공식 한계(네트워킹 latency)로 정확도를 보장하지 않는다.
 * 구독은 ref-count — 중복 리스너를 만들지 않는다.
 */
import { onValue, ref, type Unsubscribe } from "firebase/database";
import { getFirebaseDatabase, isFirebaseDatabaseConfigured } from "../../firebase/app";

/** 이 이상 점프하면 버퍼를 섞지 말고 불확실만 표시한다(ms). */
const SERVER_CLOCK_DISCONTINUITY_MS = 5_000;
/**
 * 큰 점프 뒤 「불확실」을 유지하는 시간(ms). 구/신 축 버퍼 정리는 점프 순간 리스너가 끝낸다.
 * 11-28: 종전에는 다음 offset 표본이 와야만 풀렸는데 `.info/serverTimeOffset` 은 재접속 때나
 * 바뀌어, 한 번 불확실해지면 내 라이더는 지금·동행은 과거로 계속 그려졌다(두 화면 간격 어긋남 유지).
 */
const SERVER_CLOCK_UNCERTAIN_HOLD_MS = 3_000;

type ServerClockState = {
  offsetMs: number | null;
  ready: boolean;
  uncertain: boolean;
  /** 이 시각(Date.now)까지 불확실. */
  uncertainUntilMs: number;
  lastJumpAbsMs: number;
};

let state: ServerClockState = {
  offsetMs: null,
  ready: false,
  uncertain: false,
  uncertainUntilMs: 0,
  lastJumpAbsMs: 0,
};

let refCount = 0;
let unsub: Unsubscribe | null = null;
/** 시험용 — Firebase 없이 offset 주입 */
let testOverride: { offsetMs: number | null; ready: boolean; uncertain: boolean } | null =
  null;

type DiscontinuityListener = (jumpAbsMs: number) => void;
const discontinuityListeners = new Set<DiscontinuityListener>();

/** 큰 offset jump — 구 buffer 와 새 축을 섞지 않도록 구독자가 버퍼를 비운다. */
export function subscribeServerClockDiscontinuity(
  listener: DiscontinuityListener,
): () => void {
  discontinuityListeners.add(listener);
  return () => {
    discontinuityListeners.delete(listener);
  };
}

function applyOffsetSample(raw: unknown, nowMs: number = Date.now()): void {
  const next = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  if (next == null) return;
  const prev = state.offsetMs;
  if (prev != null) {
    const jump = Math.abs(next - prev);
    if (jump >= SERVER_CLOCK_DISCONTINUITY_MS) {
      state.uncertain = true;
      state.uncertainUntilMs = nowMs + SERVER_CLOCK_UNCERTAIN_HOLD_MS;
      state.lastJumpAbsMs = jump;
      // 큰 불연속 — offset 갱신 + 구/신 버퍼 혼용 금지(리스너가 reset).
      state.offsetMs = next;
      state.ready = true;
      for (const fn of discontinuityListeners) {
        try {
          fn(jump);
        } catch {
          /* noop */
        }
      }
      return;
    }
    // 일상 드리프트는 연속 반영.
    if (state.uncertain && jump < SERVER_CLOCK_DISCONTINUITY_MS / 2) {
      state.uncertain = false;
    }
    state.lastJumpAbsMs = jump;
  }
  state.offsetMs = next;
  state.ready = true;
}

function startSubscription(): void {
  if (unsub || !isFirebaseDatabaseConfigured()) return;
  try {
    const db = getFirebaseDatabase();
    unsub = onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
      applyOffsetSample(snap.val());
    });
  } catch {
    // RTDB 미구성·초기화 실패 — ready 유지 안 함(공통 표시 비주장).
  }
}

function stopSubscription(): void {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

/** 동행 화면이 살아 있는 동안 한 번만 구독. 반환 release 를 unmount 에서 호출. */
export function acquireServerClockOffset(): () => void {
  refCount += 1;
  if (refCount === 1) startSubscription();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) stopSubscription();
  };
}

export function peekServerTimeOffsetMs(): number | null {
  if (testOverride) return testOverride.ready ? testOverride.offsetMs : null;
  return state.ready ? state.offsetMs : null;
}

export function isServerClockReady(): boolean {
  if (testOverride) return testOverride.ready && testOverride.offsetMs != null;
  return state.ready && state.offsetMs != null;
}

export function isServerClockUncertain(nowMs: number = Date.now()): boolean {
  if (testOverride) return testOverride.uncertain;
  if (state.uncertain && nowMs >= state.uncertainUntilMs) state.uncertain = false;
  return state.uncertain;
}

/** 단위시험 전용 — Firebase 없이 `.info/serverTimeOffset` 표본을 넣는다. */
export function __applyServerOffsetSampleForTests(raw: unknown, nowMs: number): void {
  applyOffsetSample(raw, nowMs);
}

/** 추정 서버시각. offset 미준비면 null — 호출부는 즉시/레거시 경로로 폴백. */
export function estimateServerNowMs(localNowMs: number = Date.now()): number | null {
  const off = peekServerTimeOffsetMs();
  if (off == null) return null;
  return localNowMs + off;
}

/** 하네스·단위시험 전용 */
export function __setServerTimeOffsetForTests(
  offsetMs: number | null,
  opts?: { ready?: boolean; uncertain?: boolean },
): void {
  testOverride = {
    offsetMs,
    ready: opts?.ready ?? offsetMs != null,
    uncertain: opts?.uncertain ?? false,
  };
}

export function __resetServerClockOffsetForTests(): void {
  testOverride = null;
  state = { offsetMs: null, ready: false, uncertain: false, uncertainUntilMs: 0, lastJumpAbsMs: 0 };
  if (unsub) {
    unsub();
    unsub = null;
  }
  refCount = 0;
}
