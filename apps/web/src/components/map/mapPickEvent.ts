import mapboxgl from "mapbox-gl";
import type { MapRoutePickCommit } from "./mapRoutePickGesture";

/**
 * `MapRoutePickCommit` 을 `mapboxgl.MapMouseEvent` 호환 객체로 변환한다.
 * `commit.point` 는 평범한 `{x, y}` 객체이므로 `mapboxgl.Point` 인스턴스로 감싼다.
 * mapbox-gl 3.23 은 `queryRenderedFeatures` 첫 인자로 `Point` 인스턴스 또는 `[number, number]`
 * 배열을 기대하며, 평범한 객체를 넘기면 내부에서 `Point.convert(geometry[0])` 호출 시 `undefined.x` 오류가 난다.
 */
export function mapMouseEventFromPickCommit(
  commit: MapRoutePickCommit,
): mapboxgl.MapMouseEvent {
  return {
    lngLat: { lng: commit.lngLat[0], lat: commit.lngLat[1] },
    point: new mapboxgl.Point(commit.point.x, commit.point.y),
  } as mapboxgl.MapMouseEvent;
}