/**
 * HUD 동행 인원 — 구독 중인 live ride 행에서 나를 제외한 수.
 * Presence 가 쓰고 MapHud 가 구독한다.
 * window + CustomEvent 로 Vite 모듈 복제와 무관하게 같은 값을 공유한다.
 *
 * 4B boolean 은 count > 0 파생. 빈 문장 분기를 깨지 않는다.
 */
type Listener = () => void;

const EVENT = "rtw-has-other-live";
type HudSignalWindow = Window & {
  __rtwOtherLiveRiderCount?: number;
  __rtwHasOtherLiveRiders?: boolean;
};

function readCount(): number {
  if (typeof window === "undefined") return 0;
  const n = (window as HudSignalWindow).__rtwOtherLiveRiderCount;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function writeCount(next: number): void {
  const w = window as HudSignalWindow;
  w.__rtwOtherLiveRiderCount = next;
  w.__rtwHasOtherLiveRiders = next > 0;
}

export function publishOtherLiveRiderCount(n: number): void {
  if (typeof window === "undefined") return;
  const next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (readCount() === next) return;
  writeCount(next);
  window.dispatchEvent(new Event(EVENT));
}

/** 4B 호환 — false 는 0명, true 는 최소 1명(이미 수가 있으면 유지). */
export function publishHasOtherLiveRiders(next: boolean): void {
  if (!next) {
    publishOtherLiveRiderCount(0);
    return;
  }
  if (readCount() === 0) publishOtherLiveRiderCount(1);
}

export function subscribeHasOtherLiveRiders(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const onEvent = () => listener();
  window.addEventListener(EVENT, onEvent);
  return () => window.removeEventListener(EVENT, onEvent);
}

export const subscribeOtherLiveRiderCount = subscribeHasOtherLiveRiders;

export function getOtherLiveRiderCount(): number {
  return readCount();
}

export function getHasOtherLiveRiders(): boolean {
  return readCount() > 0;
}
