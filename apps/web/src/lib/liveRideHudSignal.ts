/**
 * HUD 「다른 라이더 없음」 근거 — 구독 중인 live ride 행(나 제외).
 * Presence 가 쓰고 MapHud 가 구독한다.
 * window + CustomEvent 로 Vite 모듈 복제와 무관하게 같은 값을 공유한다.
 */
type Listener = () => void;

const EVENT = "rtw-has-other-live";
type HudSignalWindow = Window & { __rtwHasOtherLiveRiders?: boolean };

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  return (window as HudSignalWindow).__rtwHasOtherLiveRiders === true;
}

export function publishHasOtherLiveRiders(next: boolean): void {
  if (typeof window === "undefined") return;
  if (readFlag() === next) return;
  (window as HudSignalWindow).__rtwHasOtherLiveRiders = next;
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeHasOtherLiveRiders(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const onEvent = () => listener();
  window.addEventListener(EVENT, onEvent);
  return () => window.removeEventListener(EVENT, onEvent);
}

export function getHasOtherLiveRiders(): boolean {
  return readFlag();
}
