import type { LngLat } from "./geo";
import type { LineStringGeometry } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/**
 * 화면 span(km)이 이 값 **이하**일 때만 라인(대축척·Mapbox 축척 ~500m급).
 * **초과**하면 점(소축척·축척 1km~10km·줌아웃) — 도심 1km 뷰에서 점이 꺼지지 않게.
 */
export const VIEWPORT_SPAN_LINE_MAX_KM = 1;

/** span ≤ 1km 구간에서도 줌이 이보다 낮으면 점만 */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN = 11.5;

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
  recentRideCount7d?: number;
  traceStrength: number;
};

export type ActivityWorldMapRoute = {
  courseId: string;
  geometry: LineStringGeometry;
  kind: "pulse" | "heat";
  traceStrength: number;
};

export type ActivityWorldDisplayMode = "dots-only" | "lines-only";

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

/** span ≤ {@link VIEWPORT_SPAN_LINE_MAX_KM} — 가까이(선) */
export function spanAllowsActivityWorldLines(spanKm: number | null): boolean {
  if (spanKm == null || !Number.isFinite(spanKm)) return false;
  return spanKm <= VIEWPORT_SPAN_LINE_MAX_KM;
}

/** span > 1km — 멀리(점). Mapbox 축척 1km·5km·10km 구간 */
export function spanForcesActivityWorldDotsOnly(spanKm: number | null): boolean {
  return spanKm != null && Number.isFinite(spanKm) && spanKm > VIEWPORT_SPAN_LINE_MAX_KM;
}

/**
 * span > 1km → 점만 | span ≤ 1km + 줌 → 선 | 그 외 → 점.
 * (이전 10km 기준은 도심 1~9km에서 선만 켜져 점·선 모두 안 보이는 버그 유발)
 */
export function resolveActivityWorldDisplay(input: ActivityWorldDisplayInput): ActivityWorldDisplay {
  const zoom = Number.isFinite(input.mapZoom) ? input.mapZoom : 12;
  const span = input.spanKm;
  const hasLines = input.pulseLineCount + input.heatLineCount > 0;
  const spanLabel =
    span != null && Number.isFinite(span) ? `${span.toFixed(1)}km` : "span?";

  if (spanForcesActivityWorldDotsOnly(span)) {
    return {
      showDots: true,
      showLines: false,
      mode: "dots-only",
      label: `DOT span>${VIEWPORT_SPAN_LINE_MAX_KM} (${spanLabel})`,
    };
  }

  if (span == null || !Number.isFinite(span)) {
    return {
      showDots: true,
      showLines: false,
      mode: "dots-only",
      label: `DOT pending-span z${zoom.toFixed(1)}`,
    };
  }

  if (zoom < MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN) {
    return {
      showDots: true,
      showLines: false,
      mode: "dots-only",
      label: `DOT z${zoom.toFixed(1)} ${spanLabel}`,
    };
  }

  if (hasLines && spanAllowsActivityWorldLines(span)) {
    return {
      showDots: false,
      showLines: true,
      mode: "lines-only",
      label: `LINE ≤${VIEWPORT_SPAN_LINE_MAX_KM}km ${spanLabel} z${zoom.toFixed(1)}`,
    };
  }

  return {
    showDots: true,
    showLines: false,
    mode: "dots-only",
    label: `DOT ${spanLabel}`,
  };
}

export type ActivityWorldRawOverlay = {
  pulseRoutes: readonly ActivityWorldMapRoute[];
  heatRoutes: readonly ActivityWorldMapRoute[];
  pulseDots: readonly ActivityWorldMapDot[];
  heatDots: readonly ActivityWorldMapDot[];
};

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
  let pulseRoutes = display.showLines ? [...raw.pulseRoutes] : [];
  let heatRoutes = display.showLines ? [...raw.heatRoutes] : [];
  let pulseDots = display.showDots ? [...raw.pulseDots] : [];
  let heatDots = display.showDots ? [...raw.heatDots] : [];

  const renderedLines = pulseRoutes.length + heatRoutes.length;
  const renderedDots = pulseDots.length + heatDots.length;
  const rawLines = raw.pulseRoutes.length + raw.heatRoutes.length;
  const rawDots = raw.pulseDots.length + raw.heatDots.length;

  if (renderedLines === 0 && renderedDots === 0) {
    if (rawDots > 0) {
      pulseDots = [...raw.pulseDots];
      heatDots = [...raw.heatDots];
    } else if (rawLines > 0) {
      pulseRoutes = [...raw.pulseRoutes];
      heatRoutes = [...raw.heatRoutes];
    }
  } else if (renderedLines === 0 && rawDots > 0) {
    pulseDots = [...raw.pulseDots];
    heatDots = [...raw.heatDots];
  } else if (renderedDots === 0 && rawLines > 0) {
    pulseRoutes = [...raw.pulseRoutes];
    heatRoutes = [...raw.heatRoutes];
  }

  return { pulseRoutes, heatRoutes, pulseDots, heatDots };
}

/** @deprecated */
export function resolveActivityWorldLineMode(spanKm: number | null, mapZoom: number): boolean {
  return (
    resolveActivityWorldDisplay({
      mapZoom,
      spanKm,
      pulseDotCount: 1,
      heatDotCount: 0,
      pulseLineCount: 1,
      heatLineCount: 0,
    }).mode === "lines-only"
  );
}

/** @deprecated */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MAX = 13;

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
