import type { LngLat } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/** 뷰포트 span 이 이 값(km) 이하이면 Activity World 코스를 라인으로 표시 */
export const VIEWPORT_SPAN_LINE_MAX_KM = 30;

export type MapViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ActivityWorldMapDot = {
  courseId: string;
  lngLat: LngLat;
  /** 라이브 펄스 강도(0–3) — 반경·opacity 에 사용 */
  pulseLevel: number;
  kind: "pulse" | "heat";
};

export function viewportSpanKm(bounds: MapViewportBounds): number {
  const centerLat = (bounds.south + bounds.north) / 2;
  const widthM = haversineMeters([bounds.west, centerLat], [bounds.east, centerLat]);
  const heightM = haversineMeters([bounds.west, bounds.south], [bounds.west, bounds.north]);
  return Math.max(widthM, heightM) / 1000;
}

export function lngLatBoundsToViewport(bounds: {
  getSouthWest(): { lng: number; lat: number };
  getNorthEast(): { lng: number; lat: number };
}): MapViewportBounds {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };
}

export function isActivityWorldLineMode(spanKm: number): boolean {
  return Number.isFinite(spanKm) && spanKm <= VIEWPORT_SPAN_LINE_MAX_KM;
}

/** 앵커가 뷰포트(약간 패딩) 안에 있을 때만 DOT 표시 */
export function isLngLatInViewport(lngLat: LngLat, viewport: MapViewportBounds | null): boolean {
  if (!viewport) return true;
  const lngPad = Math.max(0.02, (viewport.east - viewport.west) * 0.08);
  const latPad = Math.max(0.02, (viewport.north - viewport.south) * 0.08);
  return (
    lngLat[0] >= viewport.west - lngPad &&
    lngLat[0] <= viewport.east + lngPad &&
    lngLat[1] >= viewport.south - latPad &&
    lngLat[1] <= viewport.north + latPad
  );
}
