/**
 * `window.__rtwLiveRideExists` 설치 — **DEV 전용 진단** (Phase 5 D6).
 *
 * 왜 옮겼나 — 이 프로브는 `peerMotion/routePublishFlight` 안에 있었고, Trail 컬렉션
 * 경로를 동적 import 해서 **전송 계층이 Trail 저장소에 묶이는** 마지막 고리였다.
 * 진단은 계측 말단(`debug`)에 속한다 — 거기서는 무엇을 봐도 방향을 어지럽히지 않는다.
 *
 * ⚠️ **지우면 안 된다.** `e2e/peer-sync-s41r.spec.ts` 가 이 함수의 존재를 기다린다.
 */

declare global {
  interface Window {
    __rtwLiveRideExists?: (trailId: string, uid: string) => Promise<boolean>;
  }
}

export async function installDevLiveRideProbe(): Promise<void> {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (window.__rtwLiveRideExists) return;
  const { doc, getDoc } = await import("firebase/firestore");
  const { getFirebaseFirestore } = await import("../firebase/app");
  const { TRAILS_COLLECTION, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION } = await import(
    "../trail/repo/firestoreTrailPaths"
  );
  const { sanitizeTrailId } = await import("../trail/trailId");
  window.__rtwLiveRideExists = async (trailId: string, uid: string) => {
    const snap = await getDoc(
      doc(
        getFirebaseFirestore(),
        TRAILS_COLLECTION,
        sanitizeTrailId(trailId),
        TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
        uid,
      ),
    );
    return snap.exists();
  };
}
