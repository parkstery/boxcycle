import type { Map as MapboxMap } from "mapbox-gl";
import type { CoverageOverlayMode } from "../lib/coverageOverlayMode";
import {
  BOXCYCLE_ROUTE_LAYER_ID,
  ensureMapillaryCoverageLayer,
  setMapillaryCoverageLayersVisibility,
  stackMapillaryAboveRoutableBelowRoute,
  stackRoutableBelowMapillary,
  MAPILLARY_PANO_SEQUENCE_LAYER_ID,
  MAPILLARY_SEQUENCE_LAYER_ID,
} from "./mapillaryCoverage";
import { ensureOsrmRoutableRoadOverlay, setOsrmRoutableRoadVisibility, ROUTABLE_ROAD_LAYER_ID } from "./osrmRoadCoverage";

/** 주행 경로(`route`)보다 아래에 두고, 베이스맵 라벨·채우기보다 위에 오도록 순서 정리 */
export function restackCoverageBelowRouteLine(map: MapboxMap, routeLayerId = BOXCYCLE_ROUTE_LAYER_ID): void {
  if (!map.getLayer(routeLayerId)) return;
  try {
    if (map.getLayer(ROUTABLE_ROAD_LAYER_ID)) {
      map.moveLayer(ROUTABLE_ROAD_LAYER_ID, routeLayerId);
    }
    if (map.getLayer(MAPILLARY_SEQUENCE_LAYER_ID)) {
      map.moveLayer(MAPILLARY_SEQUENCE_LAYER_ID, routeLayerId);
    }
    if (map.getLayer(MAPILLARY_PANO_SEQUENCE_LAYER_ID)) {
      map.moveLayer(MAPILLARY_PANO_SEQUENCE_LAYER_ID, routeLayerId);
    }
    stackRoutableBelowMapillary(map);
  } catch {
    /* noop */
  }
}

export function applyCoverageOverlayMode(
  map: MapboxMap,
  mode: CoverageOverlayMode,
  mapillaryToken: string | undefined,
  routeLayerId = BOXCYCLE_ROUTE_LAYER_ID,
): void {
  const showOsrm = mode === "osrm" || mode === "both";
  const showMly = mode === "mapillary" || mode === "both";
  const token = mapillaryToken?.trim() ?? "";

  ensureOsrmRoutableRoadOverlay(map, routeLayerId);
  setOsrmRoutableRoadVisibility(map, showOsrm);

  if (token) {
    ensureMapillaryCoverageLayer(map, token);
    setMapillaryCoverageLayersVisibility(map, { basic: showMly, pano360: showMly });
  } else {
    setMapillaryCoverageLayersVisibility(map, { basic: false, pano360: false });
  }

  if (map.getLayer(routeLayerId)) {
    restackCoverageBelowRouteLine(map, routeLayerId);
  } else {
    stackMapillaryAboveRoutableBelowRoute(map, routeLayerId);
    if (showOsrm && showMly && token) {
      stackRoutableBelowMapillary(map);
    }
  }
}
