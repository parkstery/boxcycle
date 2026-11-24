import type { ExpressionSpecification, FilterSpecification, Map as MapboxMap, SymbolLayerSpecification } from "mapbox-gl";
import { STANDARD_RIDE_DATA_SOURCE as SOURCE } from "../../lib/map/rideViewDistance";

const NAME: ExpressionSpecification = ["coalesce", ["get", "name_en"], ["get", "name"]];
/** Standard 는 피치 55° 를 넘으면 글자를 거의 감춘다. 그 구간에서만 보충한다. */
const atHighPitch = (...extra: unknown[]): FilterSpecification =>
  ["all", ["has", "name"], [">", ["pitch"], 55], ...extra] as FilterSpecification;
const FONT = ["DIN Pro Medium", "Arial Unicode MS Regular"];
const PAINT = { "text-color": "#273442", "text-halo-color": "#ffffff", "text-halo-width": 2 } as const;

function pointNames(id: string, sourceLayer: string, filter: FilterSpecification, textSize: number): SymbolLayerSpecification {
  return {
    id, type: "symbol", source: SOURCE, "source-layer": sourceLayer, slot: "top", minzoom: 15, filter,
    layout: { "text-field": NAME, "text-font": FONT, "text-size": textSize, "text-pitch-alignment": "viewport",
      "text-offset": [0, -0.8], "text-padding": 4 },
    paint: PAINT,
  };
}

/**
 * 주행 글자 보충 — 도로명·지명·상호·교통(역·정류장) 모두 ON (2026-11-24 Chief).
 * models-v1 의 실제 나무 위치는 가상 가로수(rideTreeLayer)가 겹쳐 심지 않으려고 함께 받는다.
 */
export function addStandardRideNames(map: MapboxMap): void {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-models-v1" });
  const layers: SymbolLayerSpecification[] = [
    {
      id: "boxcycle-standard-road-names", type: "symbol", source: SOURCE, "source-layer": "road", slot: "top", minzoom: 15,
      filter: atHighPitch(),
      layout: { "symbol-placement": "line", "text-field": NAME, "text-font": FONT, "text-size": 15,
        "text-pitch-alignment": "viewport", "text-rotation-alignment": "map", "text-padding": 3 },
      paint: PAINT,
    },
    pointNames("boxcycle-standard-poi-names", "poi_label", atHighPitch(), 14),
    pointNames("boxcycle-standard-transit-names", "transit_stop_label",
      // 지하철 출입구 번호까지 겹치지 않게 역·정류장 이름만.
      atHighPitch(["!=", ["get", "stop_type"], "entrance"]), 14),
    pointNames("boxcycle-standard-place-names", "place_label", atHighPitch(), 16),
  ];
  for (const layer of layers) if (!map.getLayer(layer.id)) map.addLayer(layer);
}
