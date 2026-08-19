import {
  beginPeerJitterCapture,
  endPeerJitterCapture,
  resetPeerJitterCaptureForTests,
  snapshotPeerJitterCapture,
} from "./peerMotion/peerJitterCapture";

export function installPeerJitterDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api = {
    begin: (conditionId?: string) => beginPeerJitterCapture(Date.now(), conditionId ?? null),
    end: endPeerJitterCapture,
    snapshot: snapshotPeerJitterCapture,
    reset: resetPeerJitterCaptureForTests,
  };
  (window as Window & { __rtwPeerJitterApi?: typeof api }).__rtwPeerJitterApi = api;
}
