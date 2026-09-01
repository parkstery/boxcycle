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
};

let latestBridge: DistanceAutoRouteMapBridge | null = null;

export function registerDistanceAutoRouteMapBridge(
  bridge: DistanceAutoRouteMapBridge | null,
): void {
  latestBridge = bridge;
}

export function getDistanceAutoRouteMapBridge(): DistanceAutoRouteMapBridge | null {
  return latestBridge;
}
