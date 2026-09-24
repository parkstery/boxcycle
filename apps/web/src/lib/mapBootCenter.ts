import type { LngLat } from "./geo";
import { readLocalFirstRegion } from "./localFirstRegion";
import { DEFAULT_MAP_ZOOM } from "./mapGlobeView";
import { pickLastRide } from "./rideStatsAggregate";
import { loadRideSessions } from "./rideSessionsStorage";

/** MapView 레거시 기본 — 강남. 첫 사용자·기록 없음 폴백. */
export const MAP_FALLBACK_CENTER: LngLat = [127.035, 37.505];

export type MapBootCenterSource = "localFirst" | "lastRide" | "fallback";

export type MapBootCenter = {
  center: LngLat;
  zoom: number;
  source: MapBootCenterSource;
};

/**
 * 지도 **최초** 중심 — 지시09 A.
 * 우선순위: 사용자가 고른 지역(localFirst) > 마지막 유효 주행 종료점 > 강남.
 * localStorage 만 읽는다(가장 쌈). Firestore rides 조회 없음.
 */
export function resolveMapBootCenter(): MapBootCenter {
  const region = readLocalFirstRegion();
  if (region) {
    return {
      center: [region.lngLat[0], region.lngLat[1]],
      zoom: region.zoom || DEFAULT_MAP_ZOOM,
      source: "localFirst",
    };
  }

  const last = pickLastRide(loadRideSessions());
  const end = last?.sessionEndLngLat ?? last?.sessionStartLngLat ?? null;
  if (
    end &&
    Array.isArray(end) &&
    end.length >= 2 &&
    typeof end[0] === "number" &&
    typeof end[1] === "number" &&
    Number.isFinite(end[0]) &&
    Number.isFinite(end[1])
  ) {
    return {
      center: [end[0], end[1]],
      zoom: DEFAULT_MAP_ZOOM,
      source: "lastRide",
    };
  }

  return {
    center: [MAP_FALLBACK_CENTER[0], MAP_FALLBACK_CENTER[1]],
    zoom: DEFAULT_MAP_ZOOM,
    source: "fallback",
  };
}
