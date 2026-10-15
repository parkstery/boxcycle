import type { LngLat } from "../geo/geo";
import { readLocalFirstRegion } from "../geo/localFirstRegion";

/**
 * 위치를 공유하지 않은 사용자의 첫 지도 — 로마 콜로세움 주변.
 * 현재 위치 표시가 아니라 자유 탐색의 시작 시점이다.
 */
export const MAP_FALLBACK_CENTER: LngLat = [12.4922, 41.8902];

/** 800×360에서 주변 도로가 읽히는 초기 줌. */
export const MAP_FALLBACK_ZOOM = 15;

export type MapBootCenterSource = "localFirst" | "fallback";

export type MapBootCenter = {
  center: LngLat;
  zoom: number;
  source: MapBootCenterSource;
};

/**
 * 지도 최초 중심.
 * 사용자가 고른 지역(search/geolocation)이 있으면 그 좌표·줌을 유지한다.
 * 없으면 콜로세움 주변. 마지막 주행으로 대체하지 않는다.
 */
export function resolveMapBootCenter(): MapBootCenter {
  const region = readLocalFirstRegion();
  if (region) {
    return {
      center: [region.lngLat[0], region.lngLat[1]],
      zoom: region.zoom,
      source: "localFirst",
    };
  }

  return {
    center: [MAP_FALLBACK_CENTER[0], MAP_FALLBACK_CENTER[1]],
    zoom: MAP_FALLBACK_ZOOM,
    source: "fallback",
  };
}
