/**
 * 동행 공통 표시 시계 — self·peer·카메라가 같은 frame renderTime 을 소비한다.
 *
 * 계약: companion 에서 고정 D=600ms. solo 는 D=0.
 * HUD 속도/거리·Claim 은 이 시계를 쓰지 않는다(즉시 실제값).
 *
 * 프레임마다 `ensureFrameDisplayRenderTimeMs` 를 한 번만 전진시키고,
 * self sample 과 peer step 이 그 값을 peek 한다(별도 catch-up 시계 금지).
 */
import {
  PEER_RENDER_CLOCK_CATCHUP_RATE,
  PEER_RENDER_CLOCK_RESYNC_MS,
} from "./peerSyncPolicy";
import {
  estimateServerNowMs,
  isServerClockReady,
  isServerClockUncertain,
  peekServerTimeOffsetMs,
} from "./repo/serverClockOffset";

// re-export capture helper for ride without barrel cycles
export { peekServerTimeOffsetMs, estimateServerNowMs };

/** motion 캡처 순간 tSrv — encode 재샘플 금지용. */
export function captureEstimatedServerNowMs(localNowMs: number = Date.now()): number | null {
  return estimateServerNowMs(localNowMs);
}

/** Chief 승인 — 공통 표시 지연(ms). 송신 주기와 무관. */
export const COMMON_COMPANION_DISPLAY_DELAY_MS = 600;

type SelfDisplayClockState = {
  renderClockMs: number | null;
  lastStepLocalMs: number;
  /** 목표 지연(0 또는 600). 전환 중에도 목표는 즉시 바꾸고 시계만 catch-up. */
  targetDelayMs: number;
  companionActive: boolean;
  /** 이번 프레임에 이미 전진시킨 localNow (동일 프레임 peek 재사용). */
  frameLocalMs: number | null;
  frameRenderTimeMs: number | null;
};

let selfClock: SelfDisplayClockState = {
  renderClockMs: null,
  lastStepLocalMs: 0,
  targetDelayMs: 0,
  companionActive: false,
  frameLocalMs: null,
  frameRenderTimeMs: null,
};

/** clock jump / axis reset 시 외부(버퍼) 정리 훅 */
type AxisResetListener = () => void;
const axisResetListeners = new Set<AxisResetListener>();

export function subscribeCommonDisplayAxisReset(listener: AxisResetListener): () => void {
  axisResetListeners.add(listener);
  return () => {
    axisResetListeners.delete(listener);
  };
}

export function notifyCommonDisplayAxisReset(): void {
  for (const fn of axisResetListeners) {
    try {
      fn();
    } catch {
      /* noop */
    }
  }
}

export function resetCommonDisplayClock(): void {
  selfClock = {
    renderClockMs: null,
    lastStepLocalMs: 0,
    targetDelayMs: 0,
    companionActive: false,
    frameLocalMs: null,
    frameRenderTimeMs: null,
  };
}

export function setCompanionDisplayActive(active: boolean): void {
  selfClock.companionActive = active;
  selfClock.targetDelayMs =
    active && isServerClockReady() && !isServerClockUncertain()
      ? COMMON_COMPANION_DISPLAY_DELAY_MS
      : 0;
}

export function isCompanionDisplayActive(): boolean {
  return selfClock.companionActive;
}

export function companionDisplayDelayMs(): number {
  return selfClock.targetDelayMs;
}

/**
 * 프레임 공유 시각(추정 서버축). offset 미준비면 null.
 * peer step / self sample 이 같은 값을 써야 창 안 간격이 맞는다.
 */
export function sharedDisplayCommonNowMs(localNowMs: number = Date.now()): number | null {
  if (!isServerClockReady()) return null;
  return estimateServerNowMs(localNowMs);
}

function advanceClockTowardTarget(localNowMs: number): number {
  const commonNow = sharedDisplayCommonNowMs(localNowMs);
  const delay =
    selfClock.companionActive && commonNow != null && !isServerClockUncertain()
      ? COMMON_COMPANION_DISPLAY_DELAY_MS
      : 0;
  selfClock.targetDelayMs = delay;

  const axisNow = commonNow ?? localNowMs;
  const target = axisNow - delay;
  const dtMs =
    selfClock.lastStepLocalMs > 0
      ? Math.max(0, Math.min(1_000, localNowMs - selfClock.lastStepLocalMs))
      : 0;
  selfClock.lastStepLocalMs = localNowMs;

  if (selfClock.renderClockMs == null) {
    selfClock.renderClockMs = target;
    return target;
  }

  let clock = selfClock.renderClockMs + dtMs;
  const err = target - clock;
  if (Math.abs(err) > PEER_RENDER_CLOCK_RESYNC_MS) {
    clock = target;
  } else {
    const maxStep = Math.max(dtMs, 1) * PEER_RENDER_CLOCK_CATCHUP_RATE;
    clock += Math.max(-maxStep, Math.min(maxStep, err));
  }
  selfClock.renderClockMs = clock;
  return clock;
}

/**
 * 이 프레임의 단일 renderTime. 같은 rAF 안(±8ms) 재호출은 재사용 —
 * sampleLiveLngLat 와 registry.step 이 Date.now() 를 각각 불러도 동일 시각.
 * delay=0(solo/leave) 이어도 시계를 전진시켜 D600→0 catch-up 이 끊기지 않게 한다.
 */
export function ensureFrameDisplayRenderTimeMs(localNowMs: number = Date.now()): number {
  const FRAME_REUSE_MS = 8;
  if (
    selfClock.frameLocalMs != null &&
    selfClock.frameRenderTimeMs != null &&
    Math.abs(localNowMs - selfClock.frameLocalMs) <= FRAME_REUSE_MS
  ) {
    return selfClock.frameRenderTimeMs;
  }
  const rt = advanceClockTowardTarget(localNowMs);
  selfClock.frameLocalMs = localNowMs;
  selfClock.frameRenderTimeMs = rt;
  return rt;
}

/**
 * @deprecated prefer ensureFrameDisplayRenderTimeMs — 동일 시계.
 * self·카메라용 재생 시각. companion+clock ready 면 commonNow−D 로 catch-up.
 * solo / clock 미준비 / uncertain → 목표 지연 0(시계는 계속 전진).
 */
export function advanceSelfDisplayRenderTimeMs(localNowMs: number = Date.now()): number {
  return ensureFrameDisplayRenderTimeMs(localNowMs);
}

export function peekSelfDisplayRenderTimeMs(): number | null {
  return selfClock.frameRenderTimeMs ?? selfClock.renderClockMs;
}

export function peekFrameDisplayRenderTimeMs(): number | null {
  return selfClock.frameRenderTimeMs ?? selfClock.renderClockMs;
}

/** catch-up 중인지 — leave 직후 버퍼 보간을 유지할 때 사용. */
export function isDisplayRenderCatchingUp(localNowMs: number = Date.now()): boolean {
  const commonNow = sharedDisplayCommonNowMs(localNowMs);
  const axisNow = commonNow ?? localNowMs;
  const target = axisNow - selfClock.targetDelayMs;
  const clock = selfClock.renderClockMs;
  if (clock == null) return false;
  return Math.abs(target - clock) > 2;
}

export function getCommonDisplayDebugState(): Readonly<{
  companionActive: boolean;
  targetDelayMs: number;
  renderClockMs: number | null;
  frameRenderTimeMs: number | null;
}> {
  return {
    companionActive: selfClock.companionActive,
    targetDelayMs: selfClock.targetDelayMs,
    renderClockMs: selfClock.renderClockMs,
    frameRenderTimeMs: selfClock.frameRenderTimeMs,
  };
}
