/** 주행 조작 묶음을 5초 무입력보다 빨리 숨기라는 요청 — `RideControlsAutoHide` 가 듣는다. */
export const RIDE_CONTROLS_HIDE_SOON_EVENT = "rtw-ride-controls-hide-soon";

/** `delayMs` 뒤에 숨긴다 — 순위 버튼으로 목록을 열면 2초(Chief 11-02). 그 사이 화면을 누르면 취소. */
export function requestRideControlsHide(delayMs: number): void {
  window.dispatchEvent(new CustomEvent(RIDE_CONTROLS_HIDE_SOON_EVENT, { detail: delayMs }));
}
