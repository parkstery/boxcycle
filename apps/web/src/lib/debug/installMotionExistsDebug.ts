/**
 * `window.__rtwMotionExists` · `__rtwStartMotionWatch` 설치 — **DEV 전용 진단**.
 *
 * 왜 옮겼나 (2026-09-26, Phase 6-③B) — 이 프로브는 `peerMotion/motionPublishFlight`
 * 안에 있었고, RTDB 핸들(`firebase/app`)을 동적 import 해서 **전송 계층이 인프라에
 * 묶이는** 마지막 고리였다. 진단은 계측 말단(`debug`)에 속한다 — 거기서는 무엇을 봐도
 * 방향을 어지럽히지 않는다. `installLiveRideExistsDebug`(Phase 5)와 같은 처방이다.
 *
 * ⚠️ **지우면 안 된다.** peer-sync e2e 가 이 전역들의 존재를 기다린다.
 * 구현은 그대로 옮겼다 — 동작을 바꾸지 않았다.
 */

declare global {
  interface Window {
    __rtwMotionExists?: (trailId: string, uid: string) => Promise<boolean>;
    __rtwMotionWatchSamples?: Array<{ at: number; exists: boolean }>;
    __rtwStartMotionWatch?: (trailId: string, uid: string) => void;
    __rtwStopMotionWatch?: () => void;
  }
}

export async function installDevMotionProbe(): Promise<void> {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (window.__rtwMotionExists) return;
  const { get, onValue, ref } = await import("firebase/database");
  const { getFirebaseDatabase } = await import("../firebase/app");
  const { sanitizeTrailId } = await import("../trail/trailId");
  window.__rtwMotionExists = async (trailId: string, uid: string) => {
    const snap = await get(
      ref(getFirebaseDatabase(), `trails/${sanitizeTrailId(trailId)}/motion/${uid}`),
    );
    return snap.exists();
  };
  window.__rtwStartMotionWatch = (trailId: string, uid: string) => {
    window.__rtwStopMotionWatch?.();
    const samples: Array<{ at: number; exists: boolean }> = [];
    window.__rtwMotionWatchSamples = samples;
    const r = ref(getFirebaseDatabase(), `trails/${sanitizeTrailId(trailId)}/motion/${uid}`);
    const unsub = onValue(r, (snap) => {
      samples.push({ at: Date.now(), exists: snap.exists() });
    });
    window.__rtwStopMotionWatch = () => {
      unsub();
    };
  };
}
