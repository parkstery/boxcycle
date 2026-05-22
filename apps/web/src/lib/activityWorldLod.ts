import type { LngLat } from "./geo";
import type { LineStringGeometry } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/** zoom ≥ 이 값 + geometry ready → LINE, 그 외 → DOT (span 미사용) */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN = 13;

/** @deprecated span 기준 LOD 제거 — 하위 호환 re-export */
export const VIEWPORT_SPAN_LINE_MAX_KM = 10;

/** @deprecated {@link MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN} 와 동일 */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MAX = MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN;

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

export type ActivityWorldLodDebug = {
  label: string;
  channel: "line" | "dot";
  lineRenderable: boolean;
  mapZoom: number;
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

/** close zoom + loader가 만든 LineString 존재 */
export function canRenderActivityWorldLines(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
): boolean {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  const geometryReady = raw.pulseRoutes.length + raw.heatRoutes.length > 0;
  return z >= MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN && geometryReady;
}

/**
 * LINE 가능하면 LINE, 아니면 DOT — DOT를 먼저 끄는 `showDots:false` 구조 없음.
 * MapView 소스 존재는 sync 레이어 책임; 여기서는 전달 배열만 결정.
 */
export function resolveActivityWorldRender(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
): ActivityWorldRenderOverlay {
  const lineOk = canRenderActivityWorldLines(mapZoom, raw);
  const rawDotCount = raw.pulseDots.length + raw.heatDots.length;
  const rawLineCount = raw.pulseRoutes.length + raw.heatRoutes.length;

  if (lineOk) {
    return {
      pulseRoutes: [...raw.pulseRoutes],
      heatRoutes: [...raw.heatRoutes],
      pulseDots: [],
      heatDots: [],
    };
  }

  const pulseDots = rawDotCount > 0 ? [...raw.pulseDots] : [];
  const heatDots = rawDotCount > 0 ? [...raw.heatDots] : [];

  if (pulseDots.length + heatDots.length === 0 && rawLineCount > 0) {
    return {
      pulseRoutes: [...raw.pulseRoutes],
      heatRoutes: [...raw.heatRoutes],
      pulseDots: [],
      heatDots: [],
    };
  }

  return {
    pulseRoutes: [],
    heatRoutes: [],
    pulseDots,
    heatDots,
  };
}

export function resolveActivityWorldLodDebug(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
  render: ActivityWorldRenderOverlay,
): ActivityWorldLodDebug {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  const lineRenderable = canRenderActivityWorldLines(z, raw);
  const showingLine = render.pulseRoutes.length + render.heatRoutes.length > 0;
  const channel: "line" | "dot" = showingLine ? "line" : "dot";
  const label = lineRenderable
    ? `LINE z≥${MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN} (${z.toFixed(1)})`
    : raw.pulseDots.length + raw.heatDots.length > 0
      ? `DOT z<${MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN} (${z.toFixed(1)})`
      : `DOT fallback (${z.toFixed(1)})`;
  return { label, channel, lineRenderable, mapZoom: z };
}

/** @deprecated {@link resolveActivityWorldRender} 사용 */
export function resolveActivityWorldLineMode(_spanKm: number | null, mapZoom: number): boolean {
  return Number.isFinite(mapZoom) && mapZoom >= MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN;
}

/** @deprecated span LOD 제거 */
export function spanAllowsActivityWorldLines(_spanKm: number | null): boolean {
  return false;
}

/** @deprecated span LOD 제거 */
export function isActivityWorldLineMode(spanKm: number): boolean {
  return spanAllowsActivityWorldLines(spanKm);
}

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
