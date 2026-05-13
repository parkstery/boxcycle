import type { Map as MapboxMap } from "mapbox-gl";
import { ROUTABLE_ROAD_LAYER_ID } from "./osrmRoadCoverage";

export const MAPILLARY_VECTOR_SOURCE_ID = "boxcycle-mapillary-coverage-vtp";
export const MAPILLARY_SEQUENCE_LAYER_ID = "boxcycle-mapillary-sequence-lines";
export const MAPILLARY_PANO_SEQUENCE_LAYER_ID = "boxcycle-mapillary-pano-sequence-lines";

export const BOXCYCLE_ROUTE_LAYER_ID = "route";

/** Mapillary API v4 public coverage MVT — `source-layer`: sequence */
export function ensureMapillaryCoverageLayer(map: MapboxMap, accessToken: string): void {
  const token = accessToken.trim();
  if (!token) return;

  if (!map.getSource(MAPILLARY_VECTOR_SOURCE_ID)) {
    map.addSource(MAPILLARY_VECTOR_SOURCE_ID, {
      type: "vector",
      tiles: [
        `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,
      ],
      minzoom: 6,
      maxzoom: 14,
    });
  }

  const beforeId = map.getLayer(BOXCYCLE_ROUTE_LAYER_ID) ? BOXCYCLE_ROUTE_LAYER_ID : undefined;

  if (!map.getLayer(MAPILLARY_SEQUENCE_LAYER_ID)) {
    map.addLayer(
      {
        id: MAPILLARY_SEQUENCE_LAYER_ID,
        type: "line",
        source: MAPILLARY_VECTOR_SOURCE_ID,
        "source-layer": "sequence",
        layout: {
          visibility: "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f97316",
          "line-opacity": 0.82,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5 / 3, 14, 10 / 3, 16, 14 / 3],
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(MAPILLARY_PANO_SEQUENCE_LAYER_ID)) {
    map.addLayer(
      {
        id: MAPILLARY_PANO_SEQUENCE_LAYER_ID,
        type: "line",
        source: MAPILLARY_VECTOR_SOURCE_ID,
        "source-layer": "sequence",
        filter: [
          "any",
          ["==", ["get", "is_pano"], true],
          ["==", ["get", "is_pano"], 1],
          ["==", ["get", "is_pano"], "true"],
        ],
        layout: {
          visibility: "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-opacity": 0.96,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 14, 4.4, 16, 6],
        },
      },
      beforeId,
    );
  }
}

/** 시안 라우터블 위, 주 경로선 바로 아래 */
export function stackMapillaryAboveRoutableBelowRoute(
  map: MapboxMap,
  routeLayerId: string = BOXCYCLE_ROUTE_LAYER_ID,
): void {
  if (!map.getLayer(MAPILLARY_SEQUENCE_LAYER_ID)) return;
  if (!routeLayerId || !map.getLayer(routeLayerId)) return;
  try {
    map.moveLayer(MAPILLARY_SEQUENCE_LAYER_ID, routeLayerId);
    if (map.getLayer(MAPILLARY_PANO_SEQUENCE_LAYER_ID)) {
      map.moveLayer(MAPILLARY_PANO_SEQUENCE_LAYER_ID, routeLayerId);
    }
  } catch {
    /* 순서 불가 */
  }
}

/** OSRM 시안 레이어를 Mapillary 아래로 (둘 다 켤 때 시안이 가리지 않도록) */
export function stackRoutableBelowMapillary(map: MapboxMap): void {
  if (!map.getLayer(ROUTABLE_ROAD_LAYER_ID) || !map.getLayer(MAPILLARY_SEQUENCE_LAYER_ID)) return;
  try {
    map.moveLayer(ROUTABLE_ROAD_LAYER_ID, MAPILLARY_SEQUENCE_LAYER_ID);
  } catch {
    /* noop */
  }
}

export function setMapillaryCoverageLayersVisibility(
  map: MapboxMap,
  visibility: { basic: boolean; pano360: boolean },
): void {
  const basicVis = visibility.basic ? "visible" : "none";
  const panoVis = visibility.pano360 ? "visible" : "none";
  if (map.getLayer(MAPILLARY_SEQUENCE_LAYER_ID)) {
    map.setLayoutProperty(MAPILLARY_SEQUENCE_LAYER_ID, "visibility", basicVis);
  }
  if (map.getLayer(MAPILLARY_PANO_SEQUENCE_LAYER_ID)) {
    map.setLayoutProperty(MAPILLARY_PANO_SEQUENCE_LAYER_ID, "visibility", panoVis);
  }
}
