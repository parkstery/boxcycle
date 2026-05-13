import type { FilterSpecification, Map as MapboxMap } from "mapbox-gl";

/** Mapbox Streets v8 — OSM 도로 클래스 하이라이트(라우팅 참고용, OSRM 그래프와 1:1 아님) */
export const ROUTABLE_ROAD_TILESET_URL = "mapbox://mapbox.mapbox-streets-v8";

export const ROUTABLE_ROAD_SOURCE_ID = "boxcycle-routable-roads-src";
export const ROUTABLE_ROAD_LAYER_ID = "boxcycle-routable-roads-overlay";

const ROUTABLE_CLASS_FILTER: FilterSpecification = [
  "in",
  ["coalesce", ["get", "class"], ""],
  [
    "literal",
    [
      "motorway",
      "trunk",
      "primary",
      "secondary",
      "tertiary",
      "street",
      "street_limited",
      "service",
      "track",
      "path",
      "cycleway",
    ],
  ],
];

/** 주 경로선(`routeLayerId`) 바로 아래에 두어 베이스맵 위·선택 경로보다 아래에 깔린다. */
export function ensureOsrmRoutableRoadOverlay(map: MapboxMap, routeLayerId: string): void {
  if (!map.getSource(ROUTABLE_ROAD_SOURCE_ID)) {
    map.addSource(ROUTABLE_ROAD_SOURCE_ID, {
      type: "vector",
      url: ROUTABLE_ROAD_TILESET_URL,
    });
  }
  if (!map.getLayer(ROUTABLE_ROAD_LAYER_ID)) {
    const beforeId = map.getLayer(routeLayerId) ? routeLayerId : undefined;
    map.addLayer(
      {
        id: ROUTABLE_ROAD_LAYER_ID,
        type: "line",
        source: ROUTABLE_ROAD_SOURCE_ID,
        "source-layer": "road",
        filter: ROUTABLE_CLASS_FILTER,
        layout: {
          visibility: "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#22d3ee",
          "line-opacity": 0.9,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.2, 13, 2.2, 16, 4],
        },
      },
      beforeId,
    );
  }
}

export function setOsrmRoutableRoadVisibility(map: MapboxMap, visible: boolean): void {
  if (!map.getLayer(ROUTABLE_ROAD_LAYER_ID)) return;
  map.setLayoutProperty(ROUTABLE_ROAD_LAYER_ID, "visibility", visible ? "visible" : "none");
}
