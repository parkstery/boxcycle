import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { offsetLngLatByBearingMeters, type LngLat } from "../geo/geo";
import { PRESERVED_RIDER_CUSTOM_LAYER_ID } from "../riderPrototype/config";
import { computeRideFollowFraming, viewportPxFromMap } from "../camera/rideCameraFraming";

const SOURCE = "ride-start-line";
const BACK = "ride-start-line-back";
const FRONT = "ride-start-line-front";
const signatures = new WeakMap<MapboxMap, string>();

export function frameRideStart(map: MapboxMap, target: LngLat,
  view: { offsetBearing: number | null; distanceM: number; pitch: number; bearing: number }, fallbackZoom: number) {
  const viewport = viewportPxFromMap(map);
  return computeRideFollowFraming({ riderLngLat: target, offsetBearing: view.offsetBearing,
    distanceM: view.distanceM, pitchDeg: view.pitch, viewportWidthPx: viewport.width,
    viewportHeightPx: viewport.height, fallbackZoom, screenUpBearing: view.bearing });
}

/** 카운트 전에 실제 렌더링·카메라·모델 준비를 확인한다. */
export function waitForRideStartRender(map: MapboxMap, pitch: number, preserved: boolean, current: () => boolean, ready: () => void,
  readModel: () => { hasRig: boolean; hasSpec: boolean } | null): void {
  const report = () => {
    if (!current()) return;
    const rider = readModel();
    if (!map.getSource(SOURCE) || !map.isSourceLoaded(SOURCE)
      || (preserved && (!rider?.hasRig || !rider.hasSpec)) || Math.abs(map.getPitch() - pitch) > 0.5) {
      map.once("render", report);
      map.triggerRepaint();
      return;
    }
    ready();
  };
  map.once("render", report);
  map.triggerRepaint();
}

/** 카운트다운 동안 앞바퀴 접점에 정지 출발선을 표시한다. */
export function syncRideStartLine(map: MapboxMap, rider: { lngLat: LngLat; bearingDeg: number } | null): void {
  if (!rider) {
    for (const id of [FRONT, BACK]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    signatures.delete(map);
    return;
  }
  const center = offsetLngLatByBearingMeters(rider.lngLat, rider.bearingDeg, 0.58);
  const signature = `${center[0]},${center[1]},${rider.bearingDeg}`;
  if (signatures.get(map) === signature && map.getLayer(FRONT)) return;
  const data: GeoJSON.Feature<GeoJSON.LineString> = { type: "Feature", properties: {}, geometry: {
    type: "LineString", coordinates: [
      offsetLngLatByBearingMeters(center, rider.bearingDeg - 90, 2.5),
      offsetLngLatByBearingMeters(center, rider.bearingDeg + 90, 2.5),
    ],
  } };
  const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(SOURCE, { type: "geojson", data });
  const before = map.getLayer(PRESERVED_RIDER_CUSTOM_LAYER_ID) ? PRESERVED_RIDER_CUSTOM_LAYER_ID : undefined;
  if (!map.getLayer(BACK)) map.addLayer({ id: BACK, type: "line", source: SOURCE, paint: { "line-color": "#172125", "line-width": 9 } }, before);
  if (!map.getLayer(FRONT)) map.addLayer({ id: FRONT, type: "line", source: SOURCE, paint: { "line-color": "#ffffff", "line-width": 6, "line-dasharray": [1, 1] } }, before);
  signatures.set(map, signature);
}
