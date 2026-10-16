/**
 * perflab 계측 창구. 기본 청크에는 스위치와 빈 함수만 남긴다.
 * `?perflab=1` 일 때만 계측 모듈을 불러 이 바인딩을 실제 구현으로 바꾼다.
 * 꺼진 상태의 매 프레임 비용은 함수 호출 1회(빈 함수, 또는 콜백만 실행)다.
 * 청크가 도착하기 전의 호출은 오류 없이 무시한다.
 */

import type { FrameBreakdownTick } from "./frameBreakdownProbe";
import type { RiderJitterPacerLike, RiderJitterPeerLike } from "./riderJitterProbe";
import type { RiderLod2State } from "./riderRenderCostProbe";

let enabledCache: boolean | undefined;

function currentSearch(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.location?.search ?? "";
  } catch {
    return "";
  }
}

/** 페이지 수명 동안 쿼리를 한 번만 읽는다. `perfLab.ts` 와 같은 판정. */
export function isPerfLabEnabled(): boolean {
  if (enabledCache !== undefined) return enabledCache;
  try {
    enabledCache = new URLSearchParams(currentSearch()).get("perflab") === "1";
  } catch {
    enabledCache = false;
  }
  return enabledCache;
}

function noteRiderJitterFrameOff(
  _rafTs: number,
  _selfDistM: number | null,
  _peers: readonly RiderJitterPeerLike[],
  _pacers: readonly RiderJitterPacerLike[],
): void {}

function openFrameBreakdownTickOff(): FrameBreakdownTick | null {
  return null;
}

function noteReactProfilerCommitOff(_actualDuration: number, _commitTime?: number): void {}

let installRequested = false;

/** 청크 도착 전 설치 요청을 기억했다가 도착 후 실제 설치를 부른다(DEV `__rtwRiderCost` 유지). */
function installRiderRenderCostProbeOff(): void {
  installRequested = true;
}

function measureRiderPoseOff<T>(run: () => T): T {
  return run();
}

function measureRiderRenderFrameOff<T>(
  _riderCount: number,
  run: () => T,
  _zoom?: number,
  _lod2State?: RiderLod2State,
): T {
  return run();
}

function noteRiderPerfSceneOff(_zoom: number, _riderCount: number, _lod2State: RiderLod2State): void {}

export let noteRiderJitterFrame: typeof noteRiderJitterFrameOff = noteRiderJitterFrameOff;
export let openFrameBreakdownTick: typeof openFrameBreakdownTickOff = openFrameBreakdownTickOff;
export let noteReactProfilerCommit: typeof noteReactProfilerCommitOff = noteReactProfilerCommitOff;
export let installRiderRenderCostProbe: typeof installRiderRenderCostProbeOff = installRiderRenderCostProbeOff;
export let measureRiderPose: typeof measureRiderPoseOff = measureRiderPoseOff;
export let measureRiderRenderFrame: typeof measureRiderRenderFrameOff = measureRiderRenderFrameOff;
export let noteRiderPerfScene: typeof noteRiderPerfSceneOff = noteRiderPerfSceneOff;

type PendingAttach = {
  map: object;
  detach: (() => void) | null;
  cancelled: boolean;
};

const pendingAttaches: PendingAttach[] = [];

function attachWhileLoading(map: object): () => void {
  const slot: PendingAttach = { map, detach: null, cancelled: false };
  pendingAttaches.push(slot);
  return () => {
    slot.cancelled = true;
    slot.detach?.();
    const index = pendingAttaches.indexOf(slot);
    if (index >= 0) pendingAttaches.splice(index, 1);
  };
}

export let attachMapRenderProbe: (map: object) => () => void = attachWhileLoading;

// DEV 빌드는 쿼리 없이도 불러 기존 동작(`window.__rtwRiderCost`, 벤치 페이지)을 유지한다.
// 운영 빌드에서 `import.meta.env.DEV` 는 false 상수라 이 조건은 `?perflab=1` 만 남는다.
if (isPerfLabEnabled() || import.meta.env.DEV) {
  void import(/* webpackChunkName: "perflab-runtime" */ "./perfLabRuntime")
    .then((mod) => {
      noteRiderJitterFrame = mod.noteRiderJitterFrame;
      openFrameBreakdownTick = mod.openFrameBreakdownTick;
      noteReactProfilerCommit = mod.noteReactProfilerCommit;
      installRiderRenderCostProbe = mod.installRiderRenderCostProbe;
      measureRiderPose = mod.measureRiderPose;
      measureRiderRenderFrame = mod.measureRiderRenderFrame;
      noteRiderPerfScene = mod.noteRiderPerfScene;
      if (installRequested) mod.installRiderRenderCostProbe();
      const realAttach = mod.attachMapRenderProbe;
      for (const slot of pendingAttaches) {
        if (slot.cancelled) continue;
        const restore = realAttach(slot.map);
        if (slot.cancelled) restore();
        else slot.detach = restore;
      }
      pendingAttaches.length = 0;
      attachMapRenderProbe = realAttach;
    })
    .catch(() => {
      /* 계측 청크 실패는 주행을 막지 않는다 */
    });
}
