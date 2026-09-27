/**
 * 지시01 권한 게이트 자가 검산용 — getCurrentPosition 호출 수 계수.
 * 클릭 전에는 0, [현재 위치] 1회에 1로 올라가야 「0」이 의미를 갖는다.
 */

declare global {
  interface Window {
    __rtwGeoCallCount?: number;
    __rtwGeoReset?: () => void;
  }
}

let installed = false;
let callCount = 0;

export function installLocalFirstGeoProbe(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!navigator.geolocation || installed) return;
  installed = true;

  const orig = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition = ((
    success?: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) => {
    callCount += 1;
    window.__rtwGeoCallCount = callCount;
    return orig(success as PositionCallback, error, options);
  }) as Geolocation["getCurrentPosition"];

  window.__rtwGeoCallCount = callCount;
  window.__rtwGeoReset = () => {
    callCount = 0;
    window.__rtwGeoCallCount = 0;
  };
}

export function readLocalFirstGeoCallCount(): number {
  return callCount;
}
