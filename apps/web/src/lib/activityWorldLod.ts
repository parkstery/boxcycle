import type { LngLat } from "./geo";
import type { LineStringGeometry } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/** zoom ≥ 이 값 + 해당 코스 geometry ready → 그 코스만 LINE, 그 외 DOT. span 미사용. */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN = 13;

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
  channel: "line" | "dot" | "mixed" | "empty";
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

function courseIdsWithLineGeometry(raw: ActivityWorldRawOverlay): Set<string> {
  const ids = new Set<string>();
  for (const r of raw.pulseRoutes) ids.add(r.courseId);
  for (const r of raw.heatRoutes) ids.add(r.courseId);
  return ids;
}

function lineModeForCourse(mapZoom: number, courseId: string, lineReady: Set<string>): boolean {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  return z >= MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN && lineReady.has(courseId);
}

/**
 * 코스별 LINE/DOT — 한 코스 geometry 로드가 다른 대륙 DOT 을 끄지 않음.
 * MapView는 `map.getZoom()` 으로 호출.
 */
export function resolveActivityWorldRender(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
): ActivityWorldRenderOverlay {
  const lineReady = courseIdsWithLineGeometry(raw);

  const pulseRoutes: ActivityWorldMapRoute[] = [];
  const heatRoutes: ActivityWorldMapRoute[] = [];
  const pulseDots: ActivityWorldMapDot[] = [];
  const heatDots: ActivityWorldMapDot[] = [];

  for (const r of raw.pulseRoutes) {
    if (lineModeForCourse(mapZoom, r.courseId, lineReady)) pulseRoutes.push({ ...r });
  }
  for (const r of raw.heatRoutes) {
    if (lineModeForCourse(mapZoom, r.courseId, lineReady)) heatRoutes.push({ ...r });
  }
  for (const d of raw.pulseDots) {
    if (!lineModeForCourse(mapZoom, d.courseId, lineReady)) pulseDots.push({ ...d });
  }
  for (const d of raw.heatDots) {
    if (!lineModeForCourse(mapZoom, d.courseId, lineReady)) heatDots.push({ ...d });
  }

  if (pulseRoutes.length + heatRoutes.length + pulseDots.length + heatDots.length > 0) {
    return { pulseRoutes, heatRoutes, pulseDots, heatDots };
  }

  if (raw.pulseDots.length + raw.heatDots.length > 0) {
    return {
      pulseRoutes: [],
      heatRoutes: [],
      pulseDots: [...raw.pulseDots],
      heatDots: [...raw.heatDots],
    };
  }
  if (raw.pulseRoutes.length + raw.heatRoutes.length > 0) {
    return {
      pulseRoutes: [...raw.pulseRoutes],
      heatRoutes: [...raw.heatRoutes],
      pulseDots: [],
      heatDots: [],
    };
  }

  return { pulseRoutes: [], heatRoutes: [], pulseDots: [], heatDots: [] };
}

/** 디버그: 지도에 실제로 LINE/DOT 이 섞여 있는지 */
export function canRenderActivityWorldLines(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
): boolean {
  const render = resolveActivityWorldRender(mapZoom, raw);
  return render.pulseRoutes.length + render.heatRoutes.length > 0;
}

export function resolveActivityWorldLodDebug(
  mapZoom: number,
  _raw: ActivityWorldRawOverlay,
  render: ActivityWorldRenderOverlay,
): ActivityWorldLodDebug {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  const showingLine = render.pulseRoutes.length + render.heatRoutes.length > 0;
  const showingDot = render.pulseDots.length + render.heatDots.length > 0;
  const channel: ActivityWorldLodDebug["channel"] = showingLine && showingDot
    ? "mixed"
    : showingLine
      ? "line"
      : showingDot
        ? "dot"
        : "empty";
  const label =
    channel === "mixed"
      ? `MIX z≥${MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN} (${z.toFixed(1)})`
      : channel === "line"
        ? `LINE z≥${MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN} (${z.toFixed(1)})`
        : channel === "dot"
          ? `DOT (${z.toFixed(1)})`
          : `empty (${z.toFixed(1)})`;
  return { label, channel, lineRenderable: showingLine, mapZoom: z };
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

const P0_TEST_LINE: LineStringGeometry = {
  type: "LineString",
  coordinates: [
    [0, 0],
    [1, 1],
  ],
};

function p0Dot(courseId: string): ActivityWorldMapDot {
  return {
    courseId,
    lngLat: [2, 2],
    pulseLevel: 1,
    kind: "pulse",
    traceStrength: 1,
  };
}

/**
 * P0 회귀 — 코스별 LOD·blank guard. DEV에서 1회 실행.
 * @throws invariant 위반 시
 */
export function runActivityWorldLodP0Checks(): void {
  const rawMixed: ActivityWorldRawOverlay = {
    pulseRoutes: [
      { courseId: "seoul", geometry: P0_TEST_LINE, kind: "pulse", traceStrength: 1 },
    ],
    heatRoutes: [],
    pulseDots: [p0Dot("pyongyang")],
    heatDots: [],
  };
  const mixed = resolveActivityWorldRender(14, rawMixed);
  if (mixed.pulseRoutes.length !== 1 || mixed.pulseDots.length !== 1) {
    throw new Error("P0: z14 mixed — LINE(seoul)+DOT(pyongyang) required");
  }

  const rawDotsOnly: ActivityWorldRawOverlay = {
    pulseRoutes: [],
    heatRoutes: [],
    pulseDots: [p0Dot("doha"), p0Dot("greenville")],
    heatDots: [],
  };
  const far = resolveActivityWorldRender(11, rawDotsOnly);
  if (far.pulseDots.length !== 2 || far.pulseRoutes.length !== 0) {
    throw new Error("P0: z11 — all DOT, no global LINE wipe");
  }

  const rawLinesOnly: ActivityWorldRawOverlay = {
    pulseRoutes: [
      { courseId: "x", geometry: P0_TEST_LINE, kind: "pulse", traceStrength: 1 },
    ],
    heatRoutes: [],
    pulseDots: [],
    heatDots: [],
  };
  const lineFallback = resolveActivityWorldRender(11, rawLinesOnly);
  if (lineFallback.pulseRoutes.length !== 1) {
    throw new Error("P0: blank guard — routes-only fallback at z11");
  }
}

/** 뷰포트 밖 geometry 로드 상한 등 후속용 */
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
