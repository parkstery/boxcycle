import type { ReactNode } from "react";
import { MapView, type MapViewProps } from "../../components/MapView";
import { MapHud, type MapHudProps } from "../../components/maphud/MapHud";
import {
  ActivityWorldLodDebugPanel,
  type ActivityWorldLodDebugPanelProps,
} from "./ActivityWorldLodDebugPanel";

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
      {lodDebug ? <ActivityWorldLodDebugPanel {...lodDebug} /> : null}
      {weatherOverlay}
      {children}
      {minimap}
      {routeDock}
      <MapHud {...mapHud} />
    </>
  );
}
