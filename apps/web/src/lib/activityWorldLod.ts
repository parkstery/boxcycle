import type { LngLat } from "./geo";
import type { LineStringGeometry } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/** 뷰포트 span이 이 값(km)을 넘으면 라인 비표시(월드·점 우선) */
export const VIEWPORT_SPAN_LINE_MAX_KM = 20;

/** 이보다 낮은 줌: 무조건 점만 */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN = 11.5;

/** 이 줌 미만: 점 + (준비된) 라인 혼합 / 이상: 라인 우선 */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MAX = 13;

export type MapViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ActivityWorldMapDot = {
  courseId: string;
  lngLat: LngLat;
  pulseLevel: number;
  kind: "pulse" | "heat";
  /** heat 전용 — `recentRideCount7d` 기반 시각 가중(크기) */
  recentRideCount7d?: number;
  /** 라인·점 색 강도 0.3..1 — 라이브 1, heat는 `updatedAt` 구간별 */
  traceStrength: number;
};

export type ActivityWorldMapRoute = {
  courseId: string;
  geometry: LineStringGeometry;
  kind: "pulse" | "heat";
  traceStrength: number;
};

export type ActivityWorldDisplayMode = "dots-only" | "lines-only" | "hybrid";

/** LOD는 표시만 결정 — loader/cache와 분리 */
export type ActivityWorldDisplay = {
  showDots: boolean;
  showLines: boolean;
  mode: ActivityWorldDisplayMode;
  label: string;
};

export type ActivityWorldDisplayInput = {
  mapZoom: number;
  spanKm: number | null;
  pulseDotCount: number;
  heatDotCount: number;
  pulseLineCount: number;
  heatLineCount: number;
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

/**
 * DOT = 기본 존재감, LINE = 준비된 경우의 추가 디테일.
 * showDots는 채널 on/off(데이터 개수와 무관) — 로딩 중에도 점 슬롯 유지.
 */
export function resolveActivityWorldDisplay(input: ActivityWorldDisplayInput): ActivityWorldDisplay {
  const zoom = Number.isFinite(input.mapZoom) ? input.mapZoom : 12;
  const span = input.spanKm;
  const hasLines = input.pulseLineCount + input.heatLineCount > 0;
  const spanLabel =
    span != null && Number.isFinite(span) ? `${span.toFixed(0)}km` : "span?";

  if (span != null && Number.isFinite(span) && span > VIEWPORT_SPAN_LINE_MAX_KM) {
    return {
      showDots: true,
      showLines: false,
      mode: "dots-only",
      label: `DOT(${spanLabel})`,
    };
  }

  if (zoom < MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN) {
    return {
      showDots: true,
      showLines: false,
      mode: "dots-only",
      label: `DOT(z${zoom.toFixed(1)})`,
    };
  }

  if (zoom < MAP_ZOOM_ACTIVITY_WORLD_LINE_MAX) {
    return {
      showDots: true,
      showLines: hasLines,
      mode: hasLines ? "hybrid" : "dots-only",
      label: hasLines ? `HYBRID z${zoom.toFixed(1)}` : `DOT z${zoom.toFixed(1)}`,
    };
  }

  if (
    hasLines &&
    span != null &&
    Number.isFinite(span) &&
    span <= VIEWPORT_SPAN_LINE_MAX_KM
  ) {
    return {
      showDots: false,
      showLines: true,
      mode: "lines-only",
      label: `LINE z${zoom.toFixed(1)}`,
    };
  }

  return {
    showDots: true,
    showLines: false,
    mode: "dots-only",
    label: `DOT↩ z${zoom.toFixed(1)}`,
  };
}

/** @deprecated 표시 정책은 `resolveActivityWorldDisplay` 사용 */
export function resolveActivityWorldLineMode(spanKm: number | null, mapZoom: number): boolean {
  const display = resolveActivityWorldDisplay({
    mapZoom,
    spanKm,
    pulseDotCount: 1,
    heatDotCount: 0,
    pulseLineCount: 1,
    heatLineCount: 0,
  });
  return display.mode === "lines-only";
}

/** 동일 courseId 중복 제거 — primary(현재 코스) 우선 */
export function mergeActivityWorldDots(
  primary: readonly ActivityWorldMapDot[],
  secondary: readonly ActivityWorldMapDot[],
): ActivityWorldMapDot[] {
  const m = new Map<string, ActivityWorldMapDot>();
  for (const d of secondary) m.set(d.courseId, d);
  for (const d of primary) m.set(d.courseId, d);
  return [...m.values()];
}

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
