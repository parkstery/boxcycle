import type { Map as MapboxMap } from "mapbox-gl";
import type { CoverageOverlayMode } from "../lib/coverageOverlayMode";
import { ensureOsrmRoutableRoadOverlay, setOsrmRoutableRoadVisibility, ROUTABLE_ROAD_LAYER_ID } from "./osrmRoadCoverage";

/**
 * 주행 경로 레이어 id. 종전에는 `mapillaryCoverage.ts` 가 들고 있었으나 Mapillary 를
 * 걷어내면서(2026-09-25) 유일한 소비자인 이곳으로 옮겼다 — Mapillary 와 무관한 상수다.
 */
export const BOXCYCLE_ROUTE_LAYER_ID = "route";

/** 주행 경로(`route`)보다 아래에 두고, 베이스맵 라벨·채우기보다 위에 오도록 순서 정리 */
export function restackCoverageBelowRouteLine(map: MapboxMap, routeLayerId = BOXCYCLE_ROUTE_LAYER_ID): void {
  if (!map.getLayer(routeLayerId)) return;
  try {
    if (map.getLayer(ROUTABLE_ROAD_LAYER_ID)) {
      map.moveLayer(ROUTABLE_ROAD_LAYER_ID, routeLayerId);
    }
  } catch {
    /* noop */
  }
}

export function applyCoverageOverlayMode(
  map: MapboxMap,
  mode: CoverageOverlayMode,
  routeLayerId = BOXCYCLE_ROUTE_LAYER_ID,
): void {
  ensureOsrmRoutableRoadOverlay(map, routeLayerId);
  setOsrmRoutableRoadVisibility(map, mode === "osrm");
  restackCoverageBelowRouteLine(map, routeLayerId);
}
