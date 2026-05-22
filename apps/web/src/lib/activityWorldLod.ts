import type { LngLat } from "./geo";
import type { LineStringGeometry } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/** 화면 span(km)이 이 값보다 크면 점만, 이하이면 라인(대축척) */
export const VIEWPORT_SPAN_LINE_MAX_KM = 10;

/** span ≤ 10km 구간에서도 줌이 이보다 낮으면 점만(라인이 화면에 안 읽힘) */
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

export type ActivityWorldDisplayMode = "dots-only" | "lines-only";

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

/** span ≤ {@link VIEWPORT_SPAN_LINE_MAX_KM} 일 때만 라인 채널 허용 */
export function spanAllowsActivityWorldLines(spanKm: number | null): boolean {
  if (spanKm == null || !Number.isFinite(spanKm)) return false;
  return spanKm <= VIEWPORT_SPAN_LINE_MAX_KM;
}

/** span > 10km — 줌아웃(소축척): 점만 */
export function spanForcesActivityWorldDotsOnly(spanKm: number | null): boolean {
  return spanKm != null && Number.isFinite(spanKm) && spanKm > VIEWPORT_SPAN_LINE_MAX_KM;
}

/**
 * span 기준 이진 전환 — 10km 초과: 점, 10km 이하(+줌): 라인.
 * zoom 밴드로 hybrid/lines-only 떨림을 없애고, 데이터가 있으면 한 채널은 반드시 표시.
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

  if (hasLines) {
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
    label: `DOT no-lines ${spanLabel}`,
  };
}

export type ActivityWorldRawOverlay = {
  pulseRoutes: readonly ActivityWorldMapRoute[];
  heatRoutes: readonly ActivityWorldMapRoute[];
  pulseDots: readonly ActivityWorldMapDot[];
  heatDots: readonly ActivityWorldMapDot[];
};

/** LOD 정책 → MapView 로 넘길 배열. 한쪽이 비면 반대 채널로 폴백(빈 맵 방지). */
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
    if (rawLines > 0) {
      pulseRoutes = [...raw.pulseRoutes];
      heatRoutes = [...raw.heatRoutes];
    } else if (rawDots > 0) {
      pulseDots = [...raw.pulseDots];
      heatDots = [...raw.heatDots];
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

/** @deprecated hybrid 제거 — 하위 호환 re-export */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MAX = 13;

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
