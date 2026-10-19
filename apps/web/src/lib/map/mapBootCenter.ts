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
 * 위치 공유 후 줌아웃·이동·줌인 전체의 상한.
 * 지구 반대편도 이 시간 안에 끝나고, 가까운 곳은 더 짧다.
 */
export const ENTRY_LOCATION_FLIGHT_MAX_MS = 5000;

/** 화면이 달라지는 가장 짧은 이동도 순간 점프로 끊기지 않게 하는 하한. */
export const ENTRY_LOCATION_FLIGHT_MIN_MS = 280;

/** 비행 시간 비율의 기준. 이 거리(지구 반 둘레)에서 상한에 닿는다. */
const ENTRY_LOCATION_FLIGHT_HALF_EARTH_M = Math.PI * 6_371_000;

/**
 * 시작 지점과 목적지 사이의 비행 시간.
 * 거리의 제곱근으로 늘어 가까운 지역은 빨리 지나고, 상한을 넘지 않는다.
 * 출발·도착 줌이 같으면 줌아웃과 줌인이 이 시간을 반씩 나눠 쓴다.
 */
export function resolveEntryLocationFlightMs(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return ENTRY_LOCATION_FLIGHT_MIN_MS;
  }
  const span = Math.min(1, distanceMeters / ENTRY_LOCATION_FLIGHT_HALF_EARTH_M);
  return Math.round(
    ENTRY_LOCATION_FLIGHT_MIN_MS +
      Math.sqrt(span) * (ENTRY_LOCATION_FLIGHT_MAX_MS - ENTRY_LOCATION_FLIGHT_MIN_MS),
  );
}

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
