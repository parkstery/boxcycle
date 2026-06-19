import type { LngLat } from "./geo";
import type { LineStringGeometry } from "./geo";
import { haversineMeters } from "./rideSyncPolicy";

/** 줌 인 시 LINE 전환 (geometry ready 코스만) */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN = 13;
/** 줌 아웃 시 LINE 유지 — 히스테리시스(떨림 완화) */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN = 12.5;

/** @deprecated {@link MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN} */
export const MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN = MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN;

export type ActivityWorldLodState = {
  /** 이전 프레임이 LINE 채널이었으면 EXIT 임계값 사용 */
  preferLine: boolean;
};

export const DEFAULT_ACTIVITY_WORLD_LOD_STATE: ActivityWorldLodState = { preferLine: false };

export type MapViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ActivityWorldMapDot = {
  publicationId: string;
  lngLat: LngLat;
  pulseLevel: number;
  kind: "pulse" | "heat";
  recentRideCount7d?: number;
  traceStrength: number;
};

export type ActivityWorldMapRoute = {
  publicationId: string;
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

export type ActivityWorldRenderResult = ActivityWorldRenderOverlay & {
  nextLodState: ActivityWorldLodState;
};

export type ActivityWorldLodDebug = {
  label: string;
  channel: "line" | "dot" | "mixed" | "empty";
  lineRenderable: boolean;
  mapZoom: number;
  preferLine: boolean;
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

function publicationIdsWithLineGeometry(raw: ActivityWorldRawOverlay): Set<string> {
  const ids = new Set<string>();
  for (const r of raw.pulseRoutes) ids.add(r.publicationId);
  for (const r of raw.heatRoutes) ids.add(r.publicationId);
  return ids;
}

function lineZoomThreshold(lodState: ActivityWorldLodState): number {
  return lodState.preferLine
    ? MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN
    : MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN;
}

function lineModeForPublication(
  mapZoom: number,
  publicationId: string,
  lineReady: Set<string>,
  lodState: ActivityWorldLodState,
): boolean {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  return z >= lineZoomThreshold(lodState) && lineReady.has(publicationId);
}

export function nextActivityWorldLodState(
  mapZoom: number,
  render: ActivityWorldRenderOverlay,
  prev: ActivityWorldLodState,
): ActivityWorldLodState {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  const hasLine = render.pulseRoutes.length + render.heatRoutes.length > 0;
  if (hasLine) return { preferLine: true };
  if (z >= MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN) return { preferLine: true };
  if (z < MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN) return { preferLine: false };
  return prev;
}

/**
 * 코스별 LINE/DOT + 줌 히스테리시스. MapView는 `map.getZoom()` 과 ref `lodState` 로 호출.
 */
export function resolveActivityWorldRender(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
  lodState: ActivityWorldLodState = DEFAULT_ACTIVITY_WORLD_LOD_STATE,
): ActivityWorldRenderResult {
  const lineReady = publicationIdsWithLineGeometry(raw);

  const pulseRoutes: ActivityWorldMapRoute[] = [];
  const heatRoutes: ActivityWorldMapRoute[] = [];
  const pulseDots: ActivityWorldMapDot[] = [];
  const heatDots: ActivityWorldMapDot[] = [];

  for (const r of raw.pulseRoutes) {
    if (lineModeForPublication(mapZoom, r.publicationId, lineReady, lodState)) pulseRoutes.push({ ...r });
  }
  for (const r of raw.heatRoutes) {
    if (lineModeForPublication(mapZoom, r.publicationId, lineReady, lodState)) heatRoutes.push({ ...r });
  }
  for (const d of raw.pulseDots) {
    if (!lineModeForPublication(mapZoom, d.publicationId, lineReady, lodState)) pulseDots.push({ ...d });
  }
  for (const d of raw.heatDots) {
    if (!lineModeForPublication(mapZoom, d.publicationId, lineReady, lodState)) heatDots.push({ ...d });
  }

  /** LINE 모드인데 해당 출판 라인이 아직 없으면 DOT 유지 — geometry 로드 지연·줌 전환 깜빡임 방지 */
  const pulseLinePublicationIds = new Set(pulseRoutes.map((r) => r.publicationId));
  for (const d of raw.pulseDots) {
    if (pulseDots.some((x) => x.publicationId === d.publicationId)) continue;
    if (!pulseLinePublicationIds.has(d.publicationId)) pulseDots.push({ ...d });
  }
  const heatLinePublicationIds = new Set(heatRoutes.map((r) => r.publicationId));
  for (const d of raw.heatDots) {
    if (heatDots.some((x) => x.publicationId === d.publicationId)) continue;
    if (!heatLinePublicationIds.has(d.publicationId)) heatDots.push({ ...d });
  }

  let overlay: ActivityWorldRenderOverlay;
  if (pulseRoutes.length + heatRoutes.length + pulseDots.length + heatDots.length > 0) {
    overlay = { pulseRoutes, heatRoutes, pulseDots, heatDots };
  } else if (raw.pulseDots.length + raw.heatDots.length > 0) {
    overlay = {
      pulseRoutes: [],
      heatRoutes: [],
      pulseDots: [...raw.pulseDots],
      heatDots: [...raw.heatDots],
    };
  } else if (raw.pulseRoutes.length + raw.heatRoutes.length > 0) {
    overlay = {
      pulseRoutes: [...raw.pulseRoutes],
      heatRoutes: [...raw.heatRoutes],
      pulseDots: [],
      heatDots: [],
    };
  } else {
    overlay = { pulseRoutes: [], heatRoutes: [], pulseDots: [], heatDots: [] };
  }

  return { ...overlay, nextLodState: nextActivityWorldLodState(mapZoom, overlay, lodState) };
}

/** 디버그: 지도에 실제로 LINE/DOT 이 섞여 있는지 */
export function canRenderActivityWorldLines(
  mapZoom: number,
  raw: ActivityWorldRawOverlay,
  lodState: ActivityWorldLodState = DEFAULT_ACTIVITY_WORLD_LOD_STATE,
): boolean {
  const render = resolveActivityWorldRender(mapZoom, raw, lodState);
  return render.pulseRoutes.length + render.heatRoutes.length > 0;
}

export function resolveActivityWorldLodDebug(
  mapZoom: number,
  _raw: ActivityWorldRawOverlay,
  render: ActivityWorldRenderResult | ActivityWorldRenderOverlay,
  lodState: ActivityWorldLodState = DEFAULT_ACTIVITY_WORLD_LOD_STATE,
): ActivityWorldLodDebug {
  const z = Number.isFinite(mapZoom) ? mapZoom : 12;
  const overlay =
    "nextLodState" in render
      ? render
      : (render as ActivityWorldRenderOverlay);
  const showingLine = overlay.pulseRoutes.length + overlay.heatRoutes.length > 0;
  const showingDot = overlay.pulseDots.length + overlay.heatDots.length > 0;
  const channel: ActivityWorldLodDebug["channel"] = showingLine && showingDot
    ? "mixed"
    : showingLine
      ? "line"
      : showingDot
        ? "dot"
        : "empty";
  const band =
    lodState.preferLine
      ? `exit≥${MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN}`
      : `enter≥${MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN}`;
  const label =
    channel === "mixed"
      ? `MIX ${band} (${z.toFixed(1)})`
      : channel === "line"
        ? `LINE ${band} (${z.toFixed(1)})`
        : channel === "dot"
          ? `DOT (${z.toFixed(1)})`
          : `empty (${z.toFixed(1)})`;
  return { label, channel, lineRenderable: showingLine, mapZoom: z, preferLine: lodState.preferLine };
}

export function mergeActivityWorldDots(
  primary: readonly ActivityWorldMapDot[],
  secondary: readonly ActivityWorldMapDot[],
): ActivityWorldMapDot[] {
  const m = new Map<string, ActivityWorldMapDot>();
  for (const d of secondary) m.set(d.publicationId, d);
  for (const d of primary) m.set(d.publicationId, d);
  return [...m.values()];
}

const P0_TEST_LINE: LineStringGeometry = {
  type: "LineString",
  coordinates: [
    [0, 0],
    [1, 1],
  ],
};

function p0Dot(publicationId: string): ActivityWorldMapDot {
  return {
    publicationId,
    lngLat: [2, 2],
    pulseLevel: 1,
    kind: "pulse",
    traceStrength: 1,
  };
}

/** P0 회귀 — 코스별 LOD·blank guard·히스테리시스. DEV에서 1회 실행. */
export function runActivityWorldLodP0Checks(): void {
  const rawMixed: ActivityWorldRawOverlay = {
    pulseRoutes: [
      { publicationId: "seoul", geometry: P0_TEST_LINE, kind: "pulse", traceStrength: 1 },
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
      { publicationId: "x", geometry: P0_TEST_LINE, kind: "pulse", traceStrength: 1 },
    ],
    heatRoutes: [],
    pulseDots: [],
    heatDots: [],
  };
  const lineFallback = resolveActivityWorldRender(11, rawLinesOnly);
  if (lineFallback.pulseRoutes.length !== 1) {
    throw new Error("P0: blank guard — routes-only fallback at z11");
  }

  const hysteresisIn = resolveActivityWorldRender(12.7, rawMixed, { preferLine: false });
  if (hysteresisIn.pulseRoutes.length !== 0) {
    throw new Error("P0: z12.7 enter — expect DOT until z≥13");
  }
  const hysteresisHold = resolveActivityWorldRender(12.7, rawMixed, { preferLine: true });
  if (hysteresisHold.pulseRoutes.length !== 1) {
    throw new Error("P0: z12.7 exit hold — LINE retained while preferLine");
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
