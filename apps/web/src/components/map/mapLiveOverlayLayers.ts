/**
 * 남들의 흔적·관전 점을 지도에 그리는 일 — Activity World(진행 중·최근 24h) ·
 * Trail 관전 점 · 전역 라이브 presence.
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A) — `MapView.tsx` 4,874줄 중
 * 이 묶음이 약 700줄이었다. 레이어를 세우고(ensure) 데이터를 갱신하는(sync) 일은
 * 컴포넌트의 생명주기와 무관한 **지도 글루**이고, 서로만 참조한다.
 * **동작은 바꾸지 않았다 — 자리만 옮겼다.**
 *
 * ⚠️ 레이어 앞뒤는 여기서 정하지 않는다. `lib/map/layerOrder` 레지스트리를 거친다
 * (`applyRtwLayerOrder`) — 낱개로 top 으로 올리면 라이더를 덮는다(구조 감사 P4).
 */
import "mapbox-gl/dist/mapbox-gl.css";
import "../../lib/map/disableMapboxTelemetry";
import { type ActivityWorldMapRoute } from "../../lib/activity/activityWorldLod";
import { applyRtwLayerOrder, moveLayerByRank } from "../../lib/map/layerOrder";
import { ACTIVITY_TRACE_RED } from "../../lib/activity/activityWorldTraceStyle";
import { shouldMoveActivityWorldLayersToTop, shouldSkipLiveOverlaysOnMap } from "../../lib/debug/mapDebugPhase";
import { noteMoveToTopMs } from "../../lib/debug/mapTickProbe";
import type { LngLat, LineStringGeometry } from "../../lib/geo/geo";
import type { GlobalLivePresenceDot } from "../../hooks/useGlobalLivePresence";
import type { TrailSpectatorDot } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";


/** 로비 관전: 다른 사용자 코스 진행률 기반(geometry 는 로컬 로드, Firestore 는 진행률만). */
const TRAIL_SPEC_ROUTES_SRC = "boxcycle-lobby-spectator-routes";
const TRAIL_SPEC_ROUTES_GLOW_LAYER = "boxcycle-lobby-spectator-routes-glow";
const TRAIL_SPEC_ROUTES_LAYER = "boxcycle-lobby-spectator-routes-line";

const TRAIL_SPEC_DOTS_SRC = "boxcycle-lobby-spectator-dots";
const TRAIL_SPEC_DOTS_GLOW_LAYER = "boxcycle-lobby-spectator-dots-glow";
const TRAIL_SPEC_DOTS_LAYER = "boxcycle-lobby-spectator-dots-circle";
const TRAIL_SPEC_DOTS_LABEL_LAYER = "boxcycle-lobby-spectator-dots-label";

/** 전역 livePresence — line·LOD·courseId 와 무관, 항상 dot */
const GLOBAL_LIVE_PRESENCE_SRC = "boxcycle-global-live-presence";
const GLOBAL_LIVE_PRESENCE_GLOW_LAYER = "boxcycle-global-live-presence-glow";
const GLOBAL_LIVE_PRESENCE_LAYER = "boxcycle-global-live-presence-dot";
const GLOBAL_LIVE_PRESENCE_LABEL_LAYER = "boxcycle-global-live-presence-label";

const EMPTY_GEOJSON_FC = { type: "FeatureCollection" as const, features: [] as never[] };

const ACTIVITY_PULSE_SRC = "boxcycle-activity-pulse-routes";
const ACTIVITY_PULSE_GLOW = "boxcycle-activity-pulse-routes-glow";
const ACTIVITY_PULSE_LINE = "boxcycle-activity-pulse-routes-line";
const ACTIVITY_HEAT_SRC = "boxcycle-activity-heat-routes";
const ACTIVITY_HEAT_GLOW = "boxcycle-activity-heat-routes-glow";
const ACTIVITY_HEAT_LINE = "boxcycle-activity-heat-routes-line";
const ACTIVITY_HEAT_DOTS_GLOW = "boxcycle-activity-heat-dots-glow";
const ACTIVITY_HEAT_DOTS_SRC = "boxcycle-activity-heat-dots";
const ACTIVITY_PULSE_DOTS_SRC = "boxcycle-activity-pulse-dots";
const ACTIVITY_PULSE_DOTS_GLOW = "boxcycle-activity-pulse-dots-glow";
export const ACTIVITY_PULSE_DOTS_LAYER = "boxcycle-activity-pulse-dots-layer";
export const ACTIVITY_HEAT_DOTS_LAYER = "boxcycle-activity-heat-dots-layer";

const ACTIVITY_WORLD_LAYER_IDS = [
  ACTIVITY_PULSE_GLOW,
  ACTIVITY_PULSE_LINE,
  ACTIVITY_HEAT_GLOW,
  ACTIVITY_HEAT_LINE,
  ACTIVITY_PULSE_DOTS_GLOW,
  ACTIVITY_PULSE_DOTS_LAYER,
  ACTIVITY_HEAT_DOTS_GLOW,
  ACTIVITY_HEAT_DOTS_LAYER,
] as const;

/** 존재 여부 + 최상위 활동 레이어 **위에** 얹힌 id. route 가 위에 오면 시그니처가 바뀐다. */
function activityWorldLayerSignature(map: mapboxgl.Map): string {
  let ids: string[];
  try {
    ids = (map.getStyle()?.layers ?? []).map((l) => l.id);
  } catch {
    return "";
  }
  let presence = "";
  let maxIdx = -1;
  for (const id of ACTIVITY_WORLD_LAYER_IDS) {
    const i = ids.indexOf(id);
    presence += i >= 0 ? "1" : "0";
    if (i > maxIdx) maxIdx = i;
  }
  const above = maxIdx >= 0 ? ids.slice(maxIdx + 1).join(",") : "";
  return `${presence}|above:${above}`;
}

const lastActivityWorldLayerSigByMap = new WeakMap<mapboxgl.Map, string>();

type ActivityWorldDotFeature = {
  publicationId: string;
  lngLat: LngLat;
  pulseLevel: number;
  recentRideCount7d?: number;
  traceStrength: number;
};

/** Mapbox paint — feature `traceStrength` (0=숨김, 0.7=완료, 1=라이브) */
const TRACE_STRENGTH_MULT: mapboxgl.ExpressionSpecification = [
  "coalesce",
  ["get", "traceStrength"],
  0.7,
];

/** `zoom` 은 최상위 `interpolate`/`step` 에만 허용 — stop 값에서 traceStrength 곱 */
function traceLineOpacityByZoom(
  opacityAtZoom8: number,
  opacityAtZoom14: number,
): mapboxgl.ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    8,
    ["*", opacityAtZoom8, TRACE_STRENGTH_MULT],
    14,
    ["*", opacityAtZoom14, TRACE_STRENGTH_MULT],
  ];
}

/** Activity World dot·line — `route`·coverage 위로 (route effect 가 dot 뒤에 addLayer 되는 회귀 방지) */
export function moveActivityWorldLayersToTop(map: mapboxgl.Map): void {
  const sig = activityWorldLayerSignature(map);
  if (sig === lastActivityWorldLayerSigByMap.get(map)) return;
  const t0 = performance.now();
  /*
   * 여덟 개의 **상대 순서를 한 번에** 세운다. 종전에는 각자 무조건 top 으로 올라가
   * 라이더까지 덮었고(구조 감사 P4), 결과가 호출 순서에 달려 있었다.
   * 낱개 `moveLayerByRank` 로는 그룹이 정렬되지 않는다(계약 시험이 잡는다).
   */
  applyRtwLayerOrder(map, ACTIVITY_WORLD_LAYER_IDS);
  lastActivityWorldLayerSigByMap.set(map, activityWorldLayerSignature(map));
  noteMoveToTopMs(performance.now() - t0);
}

/**
 * 스타일이 바뀌면 「이미 제 자리에 있다」는 기억을 지운다 — 새 스타일에는 레이어가
 * 다시 깔리므로, 잊지 않으면 순서를 다시 세우지 않는다(MapView 의 `style.load`).
 */
export function forgetActivityWorldLayerOrder(map: mapboxgl.Map): void {
  lastActivityWorldLayerSigByMap.delete(map);
}

export function routeLayerInsertBefore(map: mapboxgl.Map): string | undefined {
  return (
    map.getLayer(ACTIVITY_PULSE_DOTS_LAYER)?.id ??
    map.getLayer(ACTIVITY_PULSE_DOTS_GLOW)?.id ??
    map.getLayer(ACTIVITY_PULSE_LINE)?.id ??
    map.getLayer(ACTIVITY_PULSE_GLOW)?.id ??
    undefined
  );
}

function isValidActivityDotLngLat(lngLat: LngLat): boolean {
  return (
    Array.isArray(lngLat) &&
    lngLat.length >= 2 &&
    Number.isFinite(lngLat[0]) &&
    Number.isFinite(lngLat[1]) &&
    Math.abs(lngLat[0]) <= 180 &&
    Math.abs(lngLat[1]) <= 90
  );
}

/** 운영 World dot — publication aggregate(trail당 1개). 단일 source + 단일 circle layer, 고정 red. */
function ensureWorldRedDotLayer(map: mapboxgl.Map): boolean {
  if (!map.getSource(ACTIVITY_PULSE_DOTS_SRC)) {
    try {
      map.addSource(ACTIVITY_PULSE_DOTS_SRC, { type: "geojson", data: EMPTY_GEOJSON_FC });
    } catch (e) {
      console.warn("[MapView] red dot addSource failed", {
        isStyleLoaded: map.isStyleLoaded(),
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  }
  if (!map.getLayer(ACTIVITY_PULSE_DOTS_LAYER)) {
    try {
      map.addLayer({
        id: ACTIVITY_PULSE_DOTS_LAYER,
        type: "circle",
        source: ACTIVITY_PULSE_DOTS_SRC,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 8, 12, 14],
          "circle-color": "#ff0000",
          "circle-opacity": 1,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    } catch (e) {
      console.warn("[MapView] red dot addLayer failed", {
        hasSource: Boolean(map.getSource(ACTIVITY_PULSE_DOTS_SRC)),
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
    try {
      // 3D pitch 에서 지면 circle 이 묻히지 않게 viewport 정렬 (타입 정의 누락 회피)
      map.setLayoutProperty(ACTIVITY_PULSE_DOTS_LAYER, "circle-pitch-alignment" as never, "viewport" as never);
    } catch {
      /* noop */
    }
  }
  return Boolean(map.getLayer(ACTIVITY_PULSE_DOTS_LAYER));
}

/** publication raw dot → 단일 red circle 레이어로 직접 렌더(LOD·glow·heat·DOM 마커 없음). */
export function syncWorldRedDots(
  map: mapboxgl.Map,
  pulseDots: readonly ActivityWorldDotFeature[],
): void {
  // isStyleLoaded() 는 위성+3D terrain + 최신 mapbox-gl 에서 영구 false 가능 → dot 영영 차단.
  // map.style 만 확인하고, 미준비 시는 ensure/ setData 의 try/catch 가 안전 처리한다.
  if (!map.style) return;
  const valid = pulseDots.filter((d) => isValidActivityDotLngLat(d.lngLat));
  const fc = {
    type: "FeatureCollection" as const,
    features: valid.map((d) => ({
      type: "Feature" as const,
      id: `act-pd-${d.publicationId}`,
      properties: { publicationId: d.publicationId },
      geometry: { type: "Point" as const, coordinates: d.lngLat },
    })),
  };
  if (!ensureWorldRedDotLayer(map)) return;
  const src = map.getSource(ACTIVITY_PULSE_DOTS_SRC) as mapboxgl.GeoJSONSource | undefined;
  if (!src) {
    console.warn("[MapView] red dot source missing after ensure", {
      isStyleLoaded: map.isStyleLoaded(),
    });
    return;
  }
  try {
    src.setData(fc);
    moveLayerByRank(map, ACTIVITY_PULSE_DOTS_LAYER);
  } catch (e) {
    console.warn("[MapView] red dot setData/move failed", e);
  }
}

/** 최근 24시간 heat — 완료 trail opacity 70% */
function ensureWorldHeatDotLayer(map: mapboxgl.Map): boolean {
  if (!map.getSource(ACTIVITY_HEAT_DOTS_SRC)) {
    try {
      map.addSource(ACTIVITY_HEAT_DOTS_SRC, { type: "geojson", data: EMPTY_GEOJSON_FC });
    } catch (e) {
      console.warn("[MapView] heat dot addSource failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  }
  if (!map.getLayer(ACTIVITY_HEAT_DOTS_GLOW)) {
    try {
      map.addLayer({
        id: ACTIVITY_HEAT_DOTS_GLOW,
        type: "circle",
        source: ACTIVITY_HEAT_DOTS_SRC,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["+", 5, ["*", ["coalesce", ["get", "heatWeight"], 1], 0.8]],
            12,
            ["+", 7, ["*", ["coalesce", ["get", "heatWeight"], 1], 1]],
          ],
          "circle-color": ACTIVITY_TRACE_RED,
          "circle-opacity": ["*", 0.5, TRACE_STRENGTH_MULT],
          "circle-blur": 0.45,
        },
      });
    } catch (e) {
      console.warn("[MapView] heat dot glow addLayer failed", e);
      return false;
    }
  }
  if (!map.getLayer(ACTIVITY_HEAT_DOTS_LAYER)) {
    try {
      map.addLayer({
        id: ACTIVITY_HEAT_DOTS_LAYER,
        type: "circle",
        source: ACTIVITY_HEAT_DOTS_SRC,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["+", 4, ["*", ["coalesce", ["get", "heatWeight"], 1], 0.6]],
            12,
            ["+", 6, ["*", ["coalesce", ["get", "heatWeight"], 1], 0.8]],
          ],
          "circle-color": ACTIVITY_TRACE_RED,
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": TRACE_STRENGTH_MULT,
        },
      });
    } catch (e) {
      console.warn("[MapView] heat dot addLayer failed", e);
      return false;
    }
    try {
      map.setLayoutProperty(ACTIVITY_HEAT_DOTS_LAYER, "circle-pitch-alignment" as never, "viewport" as never);
    } catch {
      /* noop */
    }
  }
  return Boolean(map.getLayer(ACTIVITY_HEAT_DOTS_LAYER));
}

export function syncWorldHeatDots(
  map: mapboxgl.Map,
  heatDots: readonly ActivityWorldDotFeature[],
): void {
  if (!map.style) return;
  const valid = heatDots.filter(
    (d) =>
      isValidActivityDotLngLat(d.lngLat) &&
      Number.isFinite(d.traceStrength) &&
      d.traceStrength > 0,
  );
  const fc = {
    type: "FeatureCollection" as const,
    features: valid.map((d) => ({
      type: "Feature" as const,
      id: `act-hd-${d.publicationId}`,
      properties: {
        publicationId: d.publicationId,
        heatWeight: d.pulseLevel > 0 ? d.pulseLevel : 1,
        traceStrength: d.traceStrength,
      },
      geometry: { type: "Point" as const, coordinates: d.lngLat },
    })),
  };
  if (!ensureWorldHeatDotLayer(map)) return;
  const src = map.getSource(ACTIVITY_HEAT_DOTS_SRC) as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;
  try {
    src.setData(fc);
    moveLayerByRank(map, ACTIVITY_HEAT_DOTS_LAYER);
  } catch (e) {
    console.warn("[MapView] heat dot setData/move failed", e);
  }
}

export function syncCourseActivityLayers(
  map: mapboxgl.Map,
  pulseRoutes: readonly ActivityWorldMapRoute[],
  heatRoutes: readonly ActivityWorldMapRoute[],
): void {
  if (!map.style) return;

  const pulseFc = {
    type: "FeatureCollection" as const,
    features: pulseRoutes.map((seg, i) => ({
      type: "Feature" as const,
      id: `act-p-${seg.publicationId}-${i}`,
      properties: { publicationId: seg.publicationId, traceStrength: seg.traceStrength },
      geometry: seg.geometry,
    })),
  };
  const heatFc = {
    type: "FeatureCollection" as const,
    features: heatRoutes.map((seg, i) => ({
      type: "Feature" as const,
      id: `act-h-${seg.publicationId}-${i}`,
      properties: { publicationId: seg.publicationId, traceStrength: seg.traceStrength },
      geometry: seg.geometry,
    })),
  };
  const beforeRoute = map.getLayer("route") ? "route" : undefined;

  try {
    if (!map.getSource(ACTIVITY_PULSE_SRC)) {
      map.addSource(ACTIVITY_PULSE_SRC, { type: "geojson", data: pulseFc });
      map.addLayer(
        {
          id: ACTIVITY_PULSE_GLOW,
          type: "line",
          source: ACTIVITY_PULSE_SRC,
          paint: {
            "line-color": ACTIVITY_TRACE_RED,
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 6, 16, 8],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 5],
            // 배경 정보다 — 설정된 경로보다 확실히 약해야 한다
            "line-opacity": traceLineOpacityByZoom(0.18, 0.26),
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
      map.addLayer(
        {
          id: ACTIVITY_PULSE_LINE,
          type: "line",
          source: ACTIVITY_PULSE_SRC,
          paint: {
            "line-color": ACTIVITY_TRACE_RED,
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.4, 12, 2.2, 16, 3],
            "line-opacity": ["*", 0.45, TRACE_STRENGTH_MULT],
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
    } else {
      (map.getSource(ACTIVITY_PULSE_SRC) as mapboxgl.GeoJSONSource).setData(pulseFc);
    }

    if (!map.getSource(ACTIVITY_HEAT_SRC)) {
      map.addSource(ACTIVITY_HEAT_SRC, { type: "geojson", data: heatFc });
      map.addLayer(
        {
          id: ACTIVITY_HEAT_GLOW,
          type: "line",
          source: ACTIVITY_HEAT_SRC,
          paint: {
            "line-color": ACTIVITY_TRACE_RED,
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 12, 5, 16, 7],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 4],
            "line-opacity": traceLineOpacityByZoom(0.1, 0.15),
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
      map.addLayer(
        {
          id: ACTIVITY_HEAT_LINE,
          type: "line",
          source: ACTIVITY_HEAT_SRC,
          paint: {
            "line-color": ACTIVITY_TRACE_RED,
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.2, 12, 1.8, 16, 2.5],
            "line-opacity": ["*", 0.28, TRACE_STRENGTH_MULT],
            "line-dasharray": [2, 1.5],
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
    } else {
      (map.getSource(ACTIVITY_HEAT_SRC) as mapboxgl.GeoJSONSource).setData(heatFc);
    }
  } catch (e) {
    console.warn("[MapView] course activity layers", e);
  }
}

function ensureTrailSpectatorRouteLayers(map: mapboxgl.Map): boolean {
  if (!map.isStyleLoaded()) return false;
  const beforeRoute = map.getLayer("route") ? "route" : undefined;
  try {
    if (!map.getSource(TRAIL_SPEC_ROUTES_SRC)) {
      map.addSource(TRAIL_SPEC_ROUTES_SRC, { type: "geojson", data: EMPTY_GEOJSON_FC });
    }
    if (!map.getLayer(TRAIL_SPEC_ROUTES_GLOW_LAYER)) {
      map.addLayer(
        {
          id: TRAIL_SPEC_ROUTES_GLOW_LAYER,
          type: "line",
          source: TRAIL_SPEC_ROUTES_SRC,
          paint: {
            "line-color": "#ffffff",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 8, 16, 12],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2.2, 14, 4.5],
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 0.72],
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
    }
    if (!map.getLayer(TRAIL_SPEC_ROUTES_LAYER)) {
      map.addLayer(
        {
          id: TRAIL_SPEC_ROUTES_LAYER,
          type: "line",
          source: TRAIL_SPEC_ROUTES_SRC,
          paint: {
            "line-color": "#dc2626",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.8, 12, 3, 16, 4.2],
            "line-opacity": 0.95,
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
    }
    return true;
  } catch (e) {
    console.warn("[MapView] ensure trail spectator route layers", e);
    return false;
  }
}

function ensureTrailSpectatorDotLayers(map: mapboxgl.Map): boolean {
  if (!map.isStyleLoaded()) return false;
  const beforeRoute = map.getLayer("route") ? "route" : undefined;
  try {
    if (!map.getSource(TRAIL_SPEC_DOTS_SRC)) {
      map.addSource(TRAIL_SPEC_DOTS_SRC, { type: "geojson", data: EMPTY_GEOJSON_FC });
    }
    if (!map.getLayer(TRAIL_SPEC_DOTS_GLOW_LAYER)) {
      map.addLayer(
        {
          id: TRAIL_SPEC_DOTS_GLOW_LAYER,
          type: "circle",
          source: TRAIL_SPEC_DOTS_SRC,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 9, 7, 14, 12],
            "circle-color": "#ffffff",
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.62, 9, 0.55, 14, 0.7],
            "circle-blur": 0.55,
          },
        },
        beforeRoute,
      );
    }
    if (!map.getLayer(TRAIL_SPEC_DOTS_LAYER)) {
      map.addLayer(
        {
          id: TRAIL_SPEC_DOTS_LAYER,
          type: "circle",
          source: TRAIL_SPEC_DOTS_SRC,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4.2, 9, 3.6, 14, 7],
            "circle-color": "#dc2626",
            "circle-stroke-width": 1.8,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.96,
            "circle-blur": 0.05,
          },
        },
        beforeRoute,
      );
    }
    if (!map.getLayer(TRAIL_SPEC_DOTS_LABEL_LAYER)) {
      map.addLayer(
        {
          id: TRAIL_SPEC_DOTS_LABEL_LAYER,
          type: "symbol",
          source: TRAIL_SPEC_DOTS_SRC,
          filter: [">", ["length", ["coalesce", ["get", "label"], ""]], 0],
          layout: {
            "text-field": ["get", "label"],
            "text-size": 11,
            "text-anchor": "bottom",
            "text-offset": [0, -1.35],
            "text-max-width": 14,
            "text-allow-overlap": true,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": "#fef2f2",
            "text-halo-color": "#7f1d1d",
            "text-halo-width": 1.2,
          },
        },
        beforeRoute,
      );
    }
    return true;
  } catch (e) {
    console.warn("[MapView] ensure trail spectator dot layers", e);
    return false;
  }
}

function syncTrailSpectatorLayers(
  map: mapboxgl.Map,
  dots: readonly TrailSpectatorDot[],
  routes: readonly LineStringGeometry[],
): void {
  if (!map.isStyleLoaded()) return;

  const routeFeatures = routes.map((geometry, i) => ({
    type: "Feature" as const,
    id: `trail-r-${i}`,
    properties: { i },
    geometry,
  }));
  const routeFc = { type: "FeatureCollection" as const, features: routeFeatures };

  const dotFeatures = dots.map((d) => ({
    type: "Feature" as const,
    id: `trail-d-${d.id}`,
    properties: { id: d.id, label: d.label?.trim() ?? "" },
    geometry: { type: "Point" as const, coordinates: d.lngLat },
  }));
  const dotFc = { type: "FeatureCollection" as const, features: dotFeatures };

  try {
    if (ensureTrailSpectatorRouteLayers(map)) {
      (map.getSource(TRAIL_SPEC_ROUTES_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(routeFc);
    }
    if (ensureTrailSpectatorDotLayers(map)) {
      (map.getSource(TRAIL_SPEC_DOTS_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(dotFc);
    }
    if (import.meta.env.DEV && (dots.length > 0 || routes.length > 0)) {
      console.debug("[MapView] trail spectator sync", {
        dots: dots.length,
        routes: routes.length,
        hasDotLayer: Boolean(map.getLayer(TRAIL_SPEC_DOTS_LAYER)),
        hasSrc: Boolean(map.getSource(TRAIL_SPEC_DOTS_SRC)),
      });
    }
  } catch (e) {
    console.warn("[MapView] trail spectator layers", e);
  }
}

const DEBUG_GLOBAL_LIVE_PRESENCE_ON_MAP =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEBUG_GLOBAL_LIVE_PRESENCE_ON_MAP === "true";

function moveGlobalLivePresenceLayersToTop(map: mapboxgl.Map): void {
  // presence 점이 라이더를 덮으면 내 위치를 잃는다. 세 개의 상대 순서를 한 번에 세운다.
  applyRtwLayerOrder(map, [
    GLOBAL_LIVE_PRESENCE_GLOW_LAYER,
    GLOBAL_LIVE_PRESENCE_LAYER,
    GLOBAL_LIVE_PRESENCE_LABEL_LAYER,
  ]);
}

function ensureGlobalLivePresenceLayers(map: mapboxgl.Map): boolean {
  if (!map.isStyleLoaded()) return false;
  const beforeRoute = map.getLayer("route") ? "route" : undefined;
  try {
    if (!map.getSource(GLOBAL_LIVE_PRESENCE_SRC)) {
      map.addSource(GLOBAL_LIVE_PRESENCE_SRC, { type: "geojson", data: EMPTY_GEOJSON_FC });
    }
    if (!map.getLayer(GLOBAL_LIVE_PRESENCE_GLOW_LAYER)) {
      map.addLayer(
        {
          id: GLOBAL_LIVE_PRESENCE_GLOW_LAYER,
          type: "circle",
          source: GLOBAL_LIVE_PRESENCE_SRC,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 6, 6, 8, 12, 14, 18, 18],
            "circle-color": "#ffffff",
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.55, 12, 0.72],
            "circle-blur": 0.5,
          },
        },
        beforeRoute,
      );
    }
    if (!map.getLayer(GLOBAL_LIVE_PRESENCE_LAYER)) {
      map.addLayer(
        {
          id: GLOBAL_LIVE_PRESENCE_LAYER,
          type: "circle",
          source: GLOBAL_LIVE_PRESENCE_SRC,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4.5, 6, 6, 12, 10, 18, 14],
            "circle-color": "#0ea5e9",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.95,
          },
        },
        beforeRoute,
      );
    }
    if (!map.getLayer(GLOBAL_LIVE_PRESENCE_LABEL_LAYER)) {
      map.addLayer(
        {
          id: GLOBAL_LIVE_PRESENCE_LABEL_LAYER,
          type: "symbol",
          source: GLOBAL_LIVE_PRESENCE_SRC,
          filter: [">", ["length", ["coalesce", ["get", "label"], ""]], 0],
          layout: {
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-anchor": "bottom",
            "text-offset": [0, -1.2],
            "text-max-width": 12,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#e0f2fe",
            "text-halo-color": "#0369a1",
            "text-halo-width": 1.1,
          },
        },
        beforeRoute,
      );
    }
    return true;
  } catch (e) {
    console.warn("[MapView] ensure global live presence layers", e);
    return false;
  }
}

/** 1순위 fallback — Activity World·Trail 관전·동행·LOD와 독립 */
function syncGlobalLivePresenceLayers(
  map: mapboxgl.Map,
  dots: readonly GlobalLivePresenceDot[],
): void {
  if (!map.isStyleLoaded()) return;

  const dotFeatures = dots.map((d) => ({
    type: "Feature" as const,
    id: `glp-${d.id}`,
    properties: { id: d.id, label: d.label?.trim() ?? "" },
    geometry: { type: "Point" as const, coordinates: d.lngLat },
  }));
  const dotFc = { type: "FeatureCollection" as const, features: dotFeatures };

  try {
    if (!ensureGlobalLivePresenceLayers(map)) return;
    (map.getSource(GLOBAL_LIVE_PRESENCE_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(dotFc);
    if (DEBUG_GLOBAL_LIVE_PRESENCE_ON_MAP) {
      moveGlobalLivePresenceLayersToTop(map);
    }
    if (import.meta.env.DEV) {
      console.debug("[MapView] global presence sync", {
        dots: dots.length,
        hasLayer: Boolean(map.getLayer(GLOBAL_LIVE_PRESENCE_LAYER)),
        hasSrc: Boolean(map.getSource(GLOBAL_LIVE_PRESENCE_SRC)),
      });
    }
  } catch (e) {
    console.warn("[MapView] global live presence layers", e);
  }
}

export function syncLiveOverlayLayersOnMap(
  map: mapboxgl.Map,
  trailDots: readonly TrailSpectatorDot[],
  trailRoutes: readonly LineStringGeometry[],
  globalDots: readonly GlobalLivePresenceDot[],
): void {
  if (shouldSkipLiveOverlaysOnMap()) return;
  syncTrailSpectatorLayers(map, trailDots, trailRoutes);
  syncGlobalLivePresenceLayers(map, globalDots);
  if (shouldMoveActivityWorldLayersToTop()) {
    moveActivityWorldLayersToTop(map);
  }
}
