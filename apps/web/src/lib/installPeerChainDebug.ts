import {
  beginPeerChainCapture,
  endPeerChainCapture,
  peekChainGapM,
  resetPeerChainCaptureForTests,
  snapshotPeerChainCapture,
} from "./peerMotion/peerChainCapture";

export function installPeerChainDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api = {
    begin: (conditionId?: string) => beginPeerChainCapture(conditionId ?? null),
    end: endPeerChainCapture,
    snapshot: snapshotPeerChainCapture,
    reset: resetPeerChainCaptureForTests,
    peekGapM: peekChainGapM,
  };
  (window as Window & { __rtwPeerChainApi?: typeof api }).__rtwPeerChainApi = api;
}
