import type { LngLat } from "./geo";

/** MapView ↔ useDistanceAutoRoute 연결 — App.tsx 변경 없이 popup에 세션 상태를 전달 */
export type DistanceAutoRouteMapBridge = {
  sessionActive: boolean;
  targetKm: number;
  statusMessage: string | null;
  /** 사용자 checkbox — 거리·방향 자동 Route 모드 선호 */
  distanceDirectionMode: boolean;
  setDistanceDirectionMode: (enabled: boolean) => void;
  suspendPopupPick: () => void;
  /** popup armed 해제 + 목표 거리 원 제거 (checkbox 선호는 유지) */
  releasePickArm: () => void;
  disarm: () => void;
  /** armDirectionPick 이 방금 고른 Start — popup microtask 가 stale pin 으로 덮어쓰지 않게 */
  getArmedStart?: () => LngLat | null;
  clearClickDebugMarker?: () => void;
};

let latestBridge: DistanceAutoRouteMapBridge | null = null;
let clearClickDebugMarkerHandler: (() => void) | null = null;

export function registerDistanceAutoRouteMapBridge(
  bridge: DistanceAutoRouteMapBridge | null,
): void {
  latestBridge = bridge;
}

export function registerDistanceAutoRouteClickDebugMarkerClear(
  handler: (() => void) | null,
): void {
  clearClickDebugMarkerHandler = handler;
}

export function clearDistanceAutoRouteClickDebugMarker(): void {
  clearClickDebugMarkerHandler?.();
}

export function getDistanceAutoRouteMapBridge(): DistanceAutoRouteMapBridge | null {
  return latestBridge;
}
