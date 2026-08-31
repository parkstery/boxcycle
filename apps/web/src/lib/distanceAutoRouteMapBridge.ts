/** MapView ↔ useDistanceAutoRoute 연결 — App.tsx 변경 없이 popup에 세션 상태를 전달 */
export type DistanceAutoRouteMapBridge = {
  sessionActive: boolean;
  targetKm: number;
  statusMessage: string | null;
  suspendPopupPick: () => void;
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
