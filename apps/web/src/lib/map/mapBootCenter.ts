import type { LngLat } from "../geo/geo";
import { readLocalFirstRegion } from "../geo/localFirstRegion";

/**
 * 위치를 공유하지 않은 사용자의 첫 지도 — 로마 콜로세움 주변.
 * 현재 위치 표시가 아니라 자유 탐색의 시작 시점이다.
 * 카메라만 0.0017° 서쪽으로 보정해 줌 15에서 랜드마크가 화면 오른쪽에 놓인다.
 */
export const MAP_FALLBACK_CENTER: LngLat = [12.4905, 41.8902];

/** 800×360에서 주변 도로가 읽히는 초기 줌. */
export const MAP_FALLBACK_ZOOM = 15;

/**
 * 첫 지도 연출 — 지구의를 잠깐 보여 준 뒤 시작 위치로 확대해 들어간다(2026-10-15 Chief).
 * 지구의는 시작 위치를 화면 가운데에 두고 시작해 확대가 곧장 내려앉는다.
 */
export const BOOT_GLOBE_ZOOM = 0.6;
/** 지구의를 보여 주는 시간 */
export const BOOT_GLOBE_PAUSE_MS = 600;
/** 지구의 → 시작 위치 확대 시간 */
export const BOOT_GLOBE_FLY_MS = 3500;

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
