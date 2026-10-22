import { lazy, Suspense, type ReactNode } from "react";
import { MapView, type MapViewProps } from "../../components/map/MapView";
import { MapHud, type MapHudProps } from "../../components/maphud/MapHud";
import type { ActivityWorldLodDebugPanelProps } from "./ActivityWorldLodDebugPanel";

/**
 * LOD debug 패널은 주소 스위치로 켜질 때만 쓰는 화면 — 운영 기본 청크에서 빼고 동적으로 불러온다.
 */
const ActivityWorldLodDebugPanel = lazy(() =>
  import(/* webpackChunkName: "activity-world-lod-debug-panel" */ "./ActivityWorldLodDebugPanel").then((m) => ({
    default: m.ActivityWorldLodDebugPanel,
  })),
);

export type AppMapStageProps = {
  mapView: MapViewProps;
  mapHud: MapHudProps;
  lodDebug?: ActivityWorldLodDebugPanelProps | null;
  /** 좌하단 접이식 경로 패널 (setup·ready-to-start) */
  routeDock?: ReactNode;
  /** 주행 중 좌측 미니맵(SVG) — MapView 다음 · MapHud 앞 */
  minimap?: ReactNode;
  /** 지도 위·HUD 아래 날씨 비주얼(밤·비·눈…) */
  weatherOverlay?: ReactNode;
  /** MapView·MapHud 아래 추가 오버레이 */
  children?: ReactNode;
};

/** 지도 스테이지 — MapView + (선택) LOD debug + RouteDock + MapHud */
export function AppMapStage({
  mapView,
  mapHud,
  lodDebug,
  routeDock,
  minimap,
  weatherOverlay,
  children,
}: AppMapStageProps) {
  return (
    <>
      <MapView {...mapView} />
      {lodDebug ? (
        <Suspense fallback={null}>
          <ActivityWorldLodDebugPanel {...lodDebug} />
        </Suspense>
      ) : null}
      {weatherOverlay}
      {children}
      {minimap}
      {routeDock}
      <MapHud {...mapHud} />
    </>
  );
}
