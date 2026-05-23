/**
 * @deprecated 2026-05-19 — MENU는 `TrailHubPanel` 사용. 수동 Trail ID 입력 UI 제거.
 * `RoomSwitcher` 하위 호환 re-export만 유지.
 */
export { TrailHubPanel as TrailSwitcher, type TrailHubPanelProps as TrailSwitcherProps } from "./TrailHubPanel";

/** @deprecated `TrailHubPanel` + App `joinTrailAndCloseMenu` */
export function RoomSwitcher(): null {
  return null;
}
