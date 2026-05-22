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
  return spanAllowsActivityWorldLines(spanKm);
}

/** span 미보고(null) = 아직 LOD 미동기 — 멀리(>20km)가 아니면 라인 허용 */
export function spanAllowsActivityWorldLines(spanKm: number | null): boolean {
  if (spanKm == null || !Number.isFinite(spanKm)) return true;
  return spanKm <= VIEWPORT_SPAN_LINE_MAX_KM;
}

export function spanForcesActivityWorldDotsOnly(spanKm: number | null): boolean {
  return spanKm != null && Number.isFinite(spanKm) && spanKm > VIEWPORT_SPAN_LINE_MAX_KM;
}

/**
 * DOT = 소축척(멀리·줌아웃), LINE = 대축척(가까이·줌인).
 * showDots/showLines는 채널 on/off — {@link applyActivityWorldRenderFilter} 로 실제 전달 배열 결정.
 */
export function resolveActivityWorldDisplay(input: ActivityWorldDisplayInput): ActivityWorldDisplay {
  const zoom = Number.isFinite(input.mapZoom) ? input.mapZoom : 12;
  const span = input.spanKm;
  const hasLines = input.pulseLineCount + input.heatLineCount > 0;
  const spanLabel =
    span != null && Number.isFinite(span) ? `${span.toFixed(0)}km` : "span?";
  const linesOk = spanAllowsActivityWorldLines(span);

  if (spanForcesActivityWorldDotsOnly(span)) {
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

  if (zoom >= MAP_ZOOM_ACTIVITY_WORLD_LINE_MAX && linesOk && hasLines) {
    return {
      showDots: false,
      showLines: true,
      mode: "lines-only",
      label: `LINE z${zoom.toFixed(1)}${span != null ? ` ${spanLabel}` : ""}`,
    };
  }

  if (zoom >= MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN && linesOk && hasLines) {
    return {
      showDots: true,
      showLines: true,
      mode: "hybrid",
      label: `HYBRID z${zoom.toFixed(1)}`,
    };
  }

  return {
    showDots: true,
    showLines: false,
    mode: "dots-only",
    label: `DOT z${zoom.toFixed(1)}`,
  };
}

export type ActivityWorldRawOverlay = {
  pulseRoutes: readonly ActivityWorldMapRoute[];
  heatRoutes: readonly ActivityWorldMapRoute[];
  pulseDots: readonly ActivityWorldMapDot[];
  heatDots: readonly ActivityWorldMapDot[];
};

/** LOD 정책 → MapView 로 넘길 배열. lines-only 인데 라인 0건이면 점 폴백. */
export type ActivityWorldRenderOverlay = {
  pulseRoutes: ActivityWorldMapRoute[];
  heatRoutes: ActivityWorldMapRoute[];
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
};

export function applyActivityWorldRenderFilter(
  display: ActivityWorldDisplay,
  raw: ActivityWorldRawOverlay,
): ActivityWorldRenderOverlay {
  const pulseRoutes = display.showLines ? [...raw.pulseRoutes] : [];
  const heatRoutes = display.showLines ? [...raw.heatRoutes] : [];
  let pulseDots = display.showDots ? [...raw.pulseDots] : [];
  let heatDots = display.showDots ? [...raw.heatDots] : [];

  if (
    display.mode === "lines-only" &&
    pulseRoutes.length === 0 &&
    heatRoutes.length === 0 &&
    (raw.pulseDots.length > 0 || raw.heatDots.length > 0)
  ) {
    pulseDots = [...raw.pulseDots];
    heatDots = [...raw.heatDots];
  }

  return { pulseRoutes, heatRoutes, pulseDots, heatDots };
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
