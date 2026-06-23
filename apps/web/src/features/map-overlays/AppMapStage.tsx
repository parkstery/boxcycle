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
  /** MapView·MapHud 아래 추가 오버레이 (Mapillary 등) */
  children?: ReactNode;
};

/** 지도 스테이지 — MapView + (선택) LOD debug + RouteDock + MapHud */
export function AppMapStage({ mapView, mapHud, lodDebug, routeDock, children }: AppMapStageProps) {
  return (
    <>
      <MapView {...mapView} />
      {lodDebug ? <ActivityWorldLodDebugPanel {...lodDebug} /> : null}
      {children}
      {routeDock}
      <MapHud {...mapHud} />
    </>
  );
}
