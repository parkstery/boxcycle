import type { ReactNode } from "react";
import { MapHud, type MapHudProps } from "../../components/maphud/MapHud";
import { DebugWorldLightMap } from "../../components/map/DebugWorldLightMap";
import type { MapViewportBounds } from "../../lib/activityWorldLod";

export type DebugMapStageProps = {
  accessToken?: string;
  mapStyle: string;
  mapZoom: number;
  onMapZoom: (z: number) => void;
  onMapViewport: (viewport: MapViewportBounds, spanKm: number) => void;
  mapHud: MapHudProps;
  children?: ReactNode;
};

/** WO-260528: Phase A/B/C 전용 독립 디버그 지도 스테이지 */
export function DebugMapStage({
  accessToken,
  mapStyle,
  mapZoom,
  onMapZoom,
  onMapViewport,
  mapHud,
  children,
}: DebugMapStageProps) {
  return (
    <>
      <DebugWorldLightMap
        accessToken={accessToken}
        mapStyle={mapStyle}
        mapZoom={mapZoom}
        onMapZoom={onMapZoom}
        onMapViewport={onMapViewport}
      />
      {children}
      <MapHud {...mapHud} />
    </>
  );
}

