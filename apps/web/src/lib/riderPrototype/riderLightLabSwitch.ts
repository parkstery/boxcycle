/**
 * `?lightlab=1` 판정만. 프리셋·저장·패널 문구는 이 파일에 두지 않는다.
 * DEV 게이트 금지 — 배포본에서 주소로 연다.
 */
export function isRiderLightLabEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("lightlab") === "1";
  } catch {
    return false;
  }
}
