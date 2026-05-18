import type { Map as MapboxMap } from "mapbox-gl";

/** `fitBounds` 로 지구 전체가 들어오도록 할 때의 줌 상한 */
export const MAP_GLOBE_FIT_MAX_ZOOM = 2.5;

/** 맵 최소 줌 — NavigationControl·지구 보기·맵 시트 슬라이더 */
export const MAP_GLOBE_MIN_ZOOM = 0;

/** 맵 시트 슬라이더 상한(Mapbox 기본 maxZoom 근처) */
export const MAP_ZOOM_SLIDER_MAX = 22;

/** 지구 전체가 한 화면에 보이도록 카메라를 맞춘다(극지 왜곡 완화용 위도 클램프). */
export function applyMapGlobeView(map: MapboxMap): void {
  map.stop();
  map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
  map.fitBounds(
    [
      [-180, -58],
      [180, 78],
    ],
    {
      padding: 48,
      duration: 700,
      maxZoom: MAP_GLOBE_FIT_MAX_ZOOM,
      essential: true,
    },
  );
}
