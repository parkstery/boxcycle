/**
 * motionPublishFlight · routePublishFlight 의 공통 수명주기 — epoch·취소·세션 키·배수 대기·지연 정리.
 * 두 파일의 단일 슬롯·쓰기 실행부는 저장소가 달라 각자 갖는다. 여기는 상태를 가진 팩토리라
 * 파일마다 `createPublishFlightCore()` 로 **따로** 하나씩 만든다(상태를 공유하지 않는다).
 */
import { peerSyncChainLog } from "./peerSyncChainLog";

/** 배수 시간 초과 뒤에도 「늦은 쓰기가 실제로 끝난 시점」에 실행할 정리 */
export type DeferredCleanup = { epoch: number; sessionKey: string; run: () => Promise<void> };

export function createPublishFlightCore(deps: {
  /** DEV 계기 갱신 — 파일이 가진 `sync…FlightDebug` */
  syncDebug: () => void;
  /** 지연 정리 `run` 이 끝난 직후(로그 전) 호출 */
  onDeferredCleanupDone?: () => void;
}) {
  let currentEpoch = 0;
  let epochDiscardCount = 0;
  let deferredCleanupRunCount = 0;
  let deferredCleanupSkipCount = 0;
  const cancelledEpochs = new Set<number>();
  const settleWaiters = new Set<() => void>();
  /** epoch → 세션 키(uid|trailId). 같은 키의 새 세션이 살아 있으면 옛 정리를 하지 않는다. */
  const sessionKeyByEpoch = new Map<number, string>();
  const deferredCleanups: DeferredCleanup[] = [];

  function isEpochLive(epoch: number): boolean {
    return epoch === currentEpoch && !cancelledEpochs.has(epoch);
  }

  function isSessionLive(sessionKey: string): boolean {
    if (!sessionKey) return false;
    if (cancelledEpochs.has(currentEpoch)) return false;
    return sessionKeyByEpoch.get(currentEpoch) === sessionKey;
  }

  function emitCleanupLog(reason: string, req: DeferredCleanup): void {
    if (!import.meta.env.DEV) return;
    peerSyncChainLog(9, null, {
      ok: 1,
      deferredCleanup: 1,
      reason,
      epoch: req.epoch,
      sessionKey: req.sessionKey,
      deferredRunTotal: deferredCleanupRunCount,
      deferredSkipTotal: deferredCleanupSkipCount,
    });
  }

  async function runDeferredCleanup(req: DeferredCleanup): Promise<void> {
    if (isSessionLive(req.sessionKey)) {
      deferredCleanupSkipCount += 1;
      emitCleanupLog("skip-live-session", req);
      deps.syncDebug();
      return;
    }
    await req.run().catch(() => {});
    deferredCleanupRunCount += 1;
    deps.onDeferredCleanupDone?.();
    emitCleanupLog("run", req);
    deps.syncDebug();
  }

  return {
    isEpochLive,
    isSessionLive,

    peekEpoch(): number {
      return currentEpoch;
    },

    /** epoch 를 올리고 세션 키를 기록한다. DEV 시작 기록·계기 갱신은 부른 쪽이 이어서 한다. */
    nextEpoch(sessionKey: string): number {
      currentEpoch += 1;
      sessionKeyByEpoch.set(currentEpoch, sessionKey);
      return currentEpoch;
    },

    cancelEpoch(epoch: number): void {
      cancelledEpochs.add(epoch);
    },

    /** `idle` — 날아가는 쓰기가 없는가(부른 쪽이 판단). */
    awaitSettled(idle: boolean, timeoutMs: number): Promise<boolean> {
      if (idle) return Promise.resolve(true);
      return new Promise((resolve) => {
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          settleWaiters.delete(onSettle);
          clearTimeout(timer);
          resolve(ok);
        };
        const onSettle = () => finish(true);
        const timer = setTimeout(() => finish(false), timeoutMs);
        settleWaiters.add(onSettle);
      });
    },

    notifySettled(): void {
      for (const w of [...settleWaiters]) w();
      settleWaiters.clear();
    },

    /** `idle` 이면 바로 실행, 아니면 늦은 쓰기가 끝날 때(`drainDeferredCleanups`)까지 보류. */
    requestCleanup(req: DeferredCleanup, idle: boolean): void {
      if (idle) {
        void runDeferredCleanup(req);
        return;
      }
      deferredCleanups.push(req);
      deps.syncDebug();
    },

    drainDeferredCleanups(): void {
      if (deferredCleanups.length === 0) return;
      const pending = deferredCleanups.splice(0, deferredCleanups.length);
      for (const req of pending) void runDeferredCleanup(req);
    },

    deferredStats(): { pending: number; run: number; skip: number } {
      return {
        pending: deferredCleanups.length,
        run: deferredCleanupRunCount,
        skip: deferredCleanupSkipCount,
      };
    },

    peekEpochDiscardCount(): number {
      return epochDiscardCount;
    },

    discardEpochJob(
      reason: string,
      job: { epoch: number; trailId: string; user: { uid: string } },
    ): void {
      epochDiscardCount += 1;
      if (import.meta.env.DEV) {
        peerSyncChainLog(9, null, {
          ok: 0,
          epochDiscard: 1,
          epochDiscardTotal: epochDiscardCount,
          epoch: job.epoch,
          reason,
          uid: job.user.uid.slice(0, 6),
          trailId: job.trailId,
        });
      }
      deps.syncDebug();
    },
  };
}
