import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "../../lib/disableMapboxTelemetry";
import {
  lngLatBoundsToViewport,
  viewportSpanKm,
  type ActivityWorldMapRoute,
  type ActivityWorldRawOverlay,
  type MapViewportBounds,
} from "../../lib/activityWorldLod";
import { ACTIVITY_TRACE_RED } from "../../lib/activityWorldTraceStyle";
import {
  shouldMoveActivityWorldLayersToTop,
  shouldSkipLiveOverlaysOnMap,
} from "../../lib/mapDebugPhase";
import type { LngLat, LineStringGeometry } from "../../lib/geo";
import {
  getDistanceMeters,
  headingOnRouteAtPoint,
  lineStringLengthMeters,
  resolveRiderBearingDeg,
  type LineStringGeometry as RouteLineStringGeometry,
} from "../../lib/geo";
import type { RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import type { FollowMode } from "../ride/RideRoutePanel";
import type { CoverageOverlayMode } from "../../lib/coverageOverlayMode";
import { MAX_ROUTE_WAYPOINTS } from "../../lib/routeWaypoints";
import type { RouteProfile } from "../../services/mapboxDirections";
import { fetchMapboxReverseGeocodePlaceName } from "../../services/mapboxReverseGeocode";
import { ensureRiderPedalStripKeyframes } from "../../lib/riderPedalStripKeyframes";
import {
  RIDER_PEDAL_CELL_PX,
  RIDER_PEDAL_FRAME_COUNT,
  RIDER_PEDAL_SPRITE_REVISION,
} from "../../lib/riderPedalSpriteMeta";
import { estimateCrankRpmFromSpeedKmh, resolvePedalCrankRpm } from "../../lib/riderPedalMotion";
import { resolveGlbPedalPose } from "../../lib/riderGlbPedalPose";
import { stepPeerDriveAndBuildGeoJson } from "../../lib/peerRidersDrive";
import { resetPeerMotionRegistry } from "../../lib/peerMotion";
import { MAP_PEER_SPRITE_MIN_ZOOM } from "../../lib/rideSyncPolicy";
import { applyCoverageOverlayMode } from "../../services/coverageOverlaySync";
import type { GlobalLivePresenceDot } from "../../hooks/useGlobalLivePresence";
import type { TrailSpectatorDot } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";
import { getRiderPrototypeMode } from "../../lib/riderPrototype/config";
import {
  applyIso2dRiderBearing,
  createIso2dRiderMarkerRoot,
} from "../../lib/riderPrototype/iso2dMarker";
import { clearRiderGlbModels, syncRiderGlbModels } from "../../lib/riderPrototype/glbModelLayer";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "../../lib/registerPeerRiderPedalSprites";
import { MapZoomGlobeControl } from "./MapZoomGlobeControl";
import { MAP_GLOBE_MIN_ZOOM, RIDE_FOLLOW_CAMERA_ZOOM } from "../../lib/mapGlobeView";
import "./MapView.css";

const RIDER_PROTOTYPE_MODE = getRiderPrototypeMode();

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

function isMapAttachedToContainer(map: mapboxgl.Map, container: HTMLElement | null): boolean {
  if (!container) return false;
  try {
    const el = map.getContainer();
    return el.parentNode === container;
  } catch {
    return false;
  }
}

/**
 * 지도 탭 팝업 — 경로 프로필(차·자전거·보행) 아이콘.
 * Lucide (https://lucide.dev) `car-front`, `bike`, `footprints` — ISC License.
 */
const PICK_POPUP_PROFILE_ICON_SVG: Record<RouteProfile, string> = {
  driving: `<svg class="map-view__pick-profile-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>`,
  cycling: `<svg class="map-view__pick-profile-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
  walking: `<svg class="map-view__pick-profile-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`,
};

/** 사용자 경로 탐색 결과 폴리라인 (`route` 소스·레이어) */
const ROUTE_LINE_COLOR = "#ef4444";

const EMPTY_ACTIVITY_WORLD_RAW: ActivityWorldRawOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};

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
const ACTIVITY_PULSE_DOTS_LAYER = "boxcycle-activity-pulse-dots-layer";
const ACTIVITY_HEAT_DOTS_LAYER = "boxcycle-activity-heat-dots-layer";

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
function moveActivityWorldLayersToTop(map: mapboxgl.Map): void {
  for (const id of [
    ACTIVITY_PULSE_GLOW,
    ACTIVITY_PULSE_LINE,
    ACTIVITY_HEAT_GLOW,
    ACTIVITY_HEAT_LINE,
    ACTIVITY_PULSE_DOTS_GLOW,
    ACTIVITY_PULSE_DOTS_LAYER,
    ACTIVITY_HEAT_DOTS_GLOW,
    ACTIVITY_HEAT_DOTS_LAYER,
  ]) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch {
        /* style switching */
      }
    }
  }
}

function routeLayerInsertBefore(map: mapboxgl.Map): string | undefined {
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
function syncWorldRedDots(
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
    map.moveLayer(ACTIVITY_PULSE_DOTS_LAYER);
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

function syncWorldHeatDots(
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
    if (map.getLayer(ACTIVITY_HEAT_DOTS_LAYER)) {
      map.moveLayer(ACTIVITY_HEAT_DOTS_LAYER);
    }
  } catch (e) {
    console.warn("[MapView] heat dot setData/move failed", e);
  }
}

function syncCourseActivityLayers(
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
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 6, 12, 10, 16, 14],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 5],
            "line-opacity": traceLineOpacityByZoom(0.45, 0.65),
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
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 3.5, 16, 5],
            "line-opacity": ["*", 0.92, TRACE_STRENGTH_MULT],
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
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 8, 16, 11],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 4],
            "line-opacity": traceLineOpacityByZoom(0.35, 0.5),
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
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 3, 16, 4],
            "line-opacity": ["*", 0.78, TRACE_STRENGTH_MULT],
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
  for (const id of [
    GLOBAL_LIVE_PRESENCE_GLOW_LAYER,
    GLOBAL_LIVE_PRESENCE_LAYER,
    GLOBAL_LIVE_PRESENCE_LABEL_LAYER,
  ]) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch {
        /* style switching */
      }
    }
  }
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

function syncLiveOverlayLayersOnMap(
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

/** 레거시 `app.js` 와 동일한 서울 근처 기본 시야 */
const DEFAULT_CENTER: [number, number] = [127.035, 37.505];
const DEFAULT_ZOOM = 12;
const CAMERA_POSITION_TAU_SEC = 0.1;
const CAMERA_BEARING_TAU_PRIMARY_SEC = 0.2;
const CAMERA_BEARING_TAU_SECONDARY_SEC = 0.45;
const CAMERA_BEARING_MAX_DPS_PRIMARY = 280;
const CAMERA_BEARING_MAX_DPS_SECONDARY = 170;
const CAMERA_MAX_DT_MS = 50;
const CAMERA_BEARING_WINDOW_METERS = 60;
const CAMERA_BEARING_WINDOW_SAMPLES = 60;
/** 후방 추적 — 카메라 pivot 을 캐릭터 뒤로 (줌 21.5 근처에서 캐릭터가 화면에 보이도록) */
const REAR_FOLLOW_OFFSET_M_MIN = 16;
const REAR_FOLLOW_OFFSET_M_MAX = 58;

/**
 * 출발/도착/경유·라이더: 3D 피치에서도 빌보드(세움). `map` 정렬은 스프라이트가 지면에 눕는 문제가 있어 라이더도 viewport 유지.
 */
const PIN_MARKER_VIEWPORT_ALIGNMENT = {
  pitchAlignment: "viewport" as const,
  rotationAlignment: "viewport" as const,
};

/**
 * 라이더 DOM 마커만 — 앵커(bottom) 대비 픽셀 보정. Mapbox: 양수 → 오른쪽·아래, 음수 → 왼쪽·위.
 * (좌표 보간과 별개; 화면상 선·스프라이트 패딩 어긋남만 여기서 조절)
 */
const RIDER_ROUTE_MARKER_OFFSET_PX: [number, number] = [14, 18];

/** GLB 네임태그 — `viewport` 빌보드(측면 3D 시점에서도 읽힘). 위치 추적은 rAF·render 재투영으로 처리 */
const RIDER_GLB_NAMETAG_ALIGNMENT = {
  pitchAlignment: "viewport" as const,
  rotationAlignment: "viewport" as const,
};

/** GLB 모드 — 캐릭터 머리 위 네임태그(지면 앵커 + 화면 픽셀 위로) */
const RIDER_GLB_NAMETAG_OFFSET_PX: [number, number] = [0, -40];

const RIDER_GLB_NAMETAG_MARKER_OPTS = {
  anchor: "bottom" as const,
  offset: RIDER_GLB_NAMETAG_OFFSET_PX,
  ...RIDER_GLB_NAMETAG_ALIGNMENT,
  /** GLB 머리 높이(~1.1m) — terrain 표면 기준, 과도한 상승 방지 */
  altitude: 1.05,
};

function createGlbRiderNametagRoot(kind: "live" | "peer", label: string): HTMLDivElement {
  const root = document.createElement("div");
  root.className = `map-view__glb-nametag-host map-view__glb-nametag-host--${kind}`;
  const nametag = document.createElement("div");
  nametag.className =
    kind === "live"
      ? "map-view__rider-nametag map-view__rider-nametag--live"
      : "map-view__rider-nametag map-view__rider-nametag--peer";
  nametag.setAttribute("aria-hidden", "true");
  nametag.textContent = label;
  if (!label.trim()) nametag.style.display = "none";
  root.appendChild(nametag);
  return root;
}

function applyGlbNametagLabel(el: HTMLDivElement | null, label: string): void {
  if (!el) return;
  const t = label.trim();
  el.textContent = t;
  el.style.display = t ? "flex" : "none";
}

/** terrain·피치 변화 시 DOM 마커 재투영 (최초 생성 좌표에 고정되는 Mapbox 이슈 완화) */
function reprojectGlbNametagMarkers(
  liveMarker: mapboxgl.Marker | null,
  peerMarkers: ReadonlyMap<string, mapboxgl.Marker>,
): void {
  if (liveMarker) {
    const ll = liveMarker.getLngLat();
    liveMarker.setLngLat([ll.lng, ll.lat]);
  }
  for (const mk of peerMarkers.values()) {
    const ll = mk.getLngLat();
    mk.setLngLat([ll.lng, ll.lat]);
  }
}

function syncGlbLiveNametagMarker(
  map: mapboxgl.Map,
  lngLat: LngLat | null,
  label: string,
  markerRef: { current: mapboxgl.Marker | null },
  nametagElRef: { current: HTMLDivElement | null },
): void {
  if (!lngLat) {
    markerRef.current?.remove();
    markerRef.current = null;
    nametagElRef.current = null;
    return;
  }
  let mk = markerRef.current;
  if (!mk) {
    const root = createGlbRiderNametagRoot("live", label);
    nametagElRef.current = root.querySelector<HTMLDivElement>(".map-view__rider-nametag");
    mk = new mapboxgl.Marker({
      element: root,
      className: "map-view__glb-nametag-marker map-view__live-rider-marker",
      ...RIDER_GLB_NAMETAG_MARKER_OPTS,
    })
      .setLngLat(lngLat)
      .addTo(map);
    markerRef.current = mk;
  } else {
    mk.setLngLat(lngLat);
    applyGlbNametagLabel(nametagElRef.current, label);
  }
}

function syncGlbPeerNametagMarkers(
  map: mapboxgl.Map,
  features: PeerDomGJFeature[],
  markersRef: { current: Map<string, mapboxgl.Marker> },
): void {
  const markers = markersRef.current;
  const next = new Set<string>();
  for (const f of features) {
    const id = f.properties.id;
    next.add(id);
    const lngLat = f.geometry.coordinates;
    const { label } = f.properties;
    let mk = markers.get(id);
    if (!mk) {
      const root = createGlbRiderNametagRoot("peer", label);
      mk = new mapboxgl.Marker({
        element: root,
        className: "map-view__glb-nametag-marker",
        ...RIDER_GLB_NAMETAG_MARKER_OPTS,
      })
        .setLngLat(lngLat)
        .addTo(map);
      markers.set(id, mk);
    } else {
      mk.setLngLat(lngLat);
      const nametag = mk.getElement().querySelector<HTMLDivElement>(".map-view__rider-nametag");
      applyGlbNametagLabel(nametag, label);
    }
  }
  for (const id of [...markers.keys()]) {
    if (!next.has(id)) {
      markers.get(id)?.remove();
      markers.delete(id);
    }
  }
}

function pickPeerSourceFrameIndices(totalFrames: number): number[] {
  if (totalFrames < 2) return [0, 0, 0, 0, 0, 0];
  return [0, 1, 2, 3, 4, 5].map((i) => Math.min(totalFrames - 1, Math.round((i * (totalFrames - 1)) / 5)));
}

const PEER_DOM_STRIP_INDICES = pickPeerSourceFrameIndices(RIDER_PEDAL_FRAME_COUNT);

type PeerDomGJFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: LngLat };
  properties: { id: string; label: string; pframe: number; hdg: number };
};

function applyPeerDomSpriteFrame(sprite: HTMLDivElement | null, pframe: number): void {
  if (!sprite) return;
  const idx = ((Math.round(pframe) % 6) + 6) % 6;
  const stripIndex = PEER_DOM_STRIP_INDICES[idx] ?? 0;
  const cell = RIDER_PEDAL_CELL_PX;
  sprite.style.backgroundPosition = `-${stripIndex * cell}px 0`;
}

function createPeerRiderMarkerRoot(initialLabel: string): HTMLDivElement {
  if (RIDER_PROTOTYPE_MODE === "iso2d") {
    return createIso2dRiderMarkerRoot("peer", initialLabel, "map-view__peer-rider-host").root;
  }
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host map-view__peer-rider-host";
  const nametag = document.createElement("div");
  nametag.className = "map-view__rider-nametag map-view__rider-nametag--peer";
  nametag.setAttribute("aria-hidden", "true");
  nametag.textContent = initialLabel;
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  sprite.style.backgroundImage = `url("${base}rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}")`;
  sprite.style.animationPlayState = "paused";
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(nametag);
  root.appendChild(flip);
  return root;
}

function syncPeerDomMarkers(
  map: mapboxgl.Map,
  features: PeerDomGJFeature[],
  markersRef: { current: Map<string, mapboxgl.Marker> },
): void {
  if (RIDER_PROTOTYPE_MODE === "glb") {
    syncGlbPeerNametagMarkers(map, features, markersRef);
    return;
  }
  const markers = markersRef.current;
  const next = new Set<string>();
  for (const f of features) {
    const id = f.properties.id;
    next.add(id);
    const lngLat = f.geometry.coordinates;
    const { label, pframe, hdg } = f.properties;
    let mk = markers.get(id);
    if (!mk) {
      const root = createPeerRiderMarkerRoot(label);
      mk = new mapboxgl.Marker({
        element: root,
        className: "map-view__peer-rider-marker",
        anchor: "bottom",
        offset: RIDER_ROUTE_MARKER_OFFSET_PX,
        ...PIN_MARKER_VIEWPORT_ALIGNMENT,
      })
        .setLngLat(lngLat)
        .addTo(map);
      markers.set(id, mk);
    } else {
      mk.setLngLat(lngLat);
    }
    const root = mk.getElement();
    const nametag = root.querySelector<HTMLDivElement>(".map-view__rider-nametag--peer");
    const flip = root.querySelector<HTMLDivElement>(
      RIDER_PROTOTYPE_MODE === "iso2d" ? ".map-view__proto-iso-flip" : ".cycling-sim-marker-flip",
    );
    if (RIDER_PROTOTYPE_MODE === "iso2d") {
      const img = root.querySelector<HTMLImageElement>(".map-view__proto-iso-sprite");
      if (nametag) nametag.textContent = label;
      if (flip && img) applyIso2dRiderBearing(flip, img, "peer", hdg);
    } else {
      const sprite = root.querySelector<HTMLDivElement>(".cycling-sim-marker-pedal-sprite");
      if (nametag) nametag.textContent = label;
      applyPeerDomSpriteFrame(sprite, pframe);
      if (flip) {
        flip.style.transform = hdg > 90 && hdg < 270 ? "scaleX(-1)" : "scaleX(1)";
      }
    }
  }
  for (const id of [...markers.keys()]) {
    if (!next.has(id)) {
      markers.get(id)?.remove();
      markers.delete(id);
    }
  }
}

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => callback();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}


/** 같은 코스를 주행 중인 다른 사용자 — `MapView` 에서는 Mapbox `Marker`(DOM)로 표시 */
export type MapPeerMarker = {
  id: string;
  label?: string | null;
  /** geometry 위 주행 거리(m) — 우선 */
  distMeters?: number | null;
  /** Firestore lastSeenAt ms — peer 외삽 기준 */
  sampleAtMs?: number | null;
  /** distMeters 없을 때 폴백 */
  progressRatio?: number;
  /** progress·dist 모두 없을 때 폴백 */
  lngLat?: LngLat;
  /** m/s — 송신 측 속도 */
  speedMps?: number | null;
  ridePhase?: "live" | "paused" | "completed" | null;
};

/** 가상 주행 세션과 연동해 페달 루프 주기·재생 여부를 맞춘다 */
export type LiveRiderMotion = {
  sessionStatus: "running" | "paused";
  speedKmh: number;
  /** BLE 크랭크 RPM 등 — 유효·임계 이상이면 속도 추정보다 우선 */
  crankRpmFromSensor?: number | null;
};

/** rAF tick — 본인 라이더 마커 방향·페달 (동행과 동일 프레임) */
function syncLiveSelfRiderVisual(
  pos: LngLat,
  motion: LiveRiderMotion | null | undefined,
  routeGeometry: LineStringGeometry | null,
  prevLiveForBearingRef: { current: LngLat | null },
  flipRef: { current: HTMLDivElement | null },
  imgRef: { current: HTMLImageElement | null },
  spriteRef: { current: HTMLDivElement | null },
  prefersReducedMotion: boolean,
): void {
  const prev = prevLiveForBearingRef.current;
  const b = resolveRiderBearingDeg(routeGeometry, pos, prev);
  prevLiveForBearingRef.current = pos;

  if (RIDER_PROTOTYPE_MODE === "iso2d") {
    const flip = flipRef.current;
    const img = imgRef.current;
    if (flip && img) applyIso2dRiderBearing(flip, img, "self", b);
    return;
  }
  if (RIDER_PROTOTYPE_MODE === "glb") return;

  const flip = flipRef.current;
  const sprite = spriteRef.current;
  if (!flip || !sprite) return;

  flip.style.transform = b > 90 && b < 270 ? "scaleX(-1)" : "scaleX(1)";

  const speedNow = motion?.speedKmh ?? 0;
  const pedalingRunning = motion != null && motion.sessionStatus === "running" && speedNow > 0.35;
  const rpm = motion
    ? resolvePedalCrankRpm({
        speedKmh: motion.speedKmh,
        crankRpmFromSensor: motion.crankRpmFromSensor,
      })
    : estimateCrankRpmFromSpeedKmh(0);
  let pedalLoopSec = 60 / rpm;
  pedalLoopSec = Math.min(5.5, Math.max(0.22, pedalLoopSec));
  sprite.style.animationDuration = `${pedalLoopSec}s`;
  const allowPedalAnim = !prefersReducedMotion && pedalingRunning;
  sprite.style.animationPlayState = allowPedalAnim ? "running" : "paused";
}

export type MapViewProps = {
  accessToken: string | undefined;
  /** 부모 `useRouteElevationProfile` 과 동일(도로형 보정 포함) — 차트·코칭과 통일 */
  routeElevationProfile: RouteElevationProfileState;
  routeGeometry: LineStringGeometry | null;
  /** Directions 총거리 — 동행 progressRatio 표시를 publish·본인 위치와 통일 */
  routeDistanceMeters?: number;
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  /** 출발·도착 사이 경유(순서대로 최대 3) */
  routeWaypoints: LngLat[];
  liveLngLat: LngLat | null;
  /** rAF 샘플 — React throttle 없이 맵 마커 위치 (가상 주행 세션) */
  sampleLiveLngLat?: () => LngLat | null;
  /** 내 위치 마커 페달 애니메이션(주행/일시정지·가상 속도). 없으면 스프라이트만 정지 표시 */
  liveRiderMotion?: LiveRiderMotion | null;
  /** 주행 중 내 머리 위 표시(닉네임·guest1 등). 없으면 태그 숨김 */
  liveRiderNametag?: string | null;
  /** 입문 코스 동행 등: 다른 라이더 위치 */
  peerMarkers?: MapPeerMarker[];
  mapStyle: string;
  mapZoom: number;
  followMode: FollowMode;
  enable3D: boolean;
  onMapZoom: (zoom: number) => void;
  /** `waypoint`일 때만 `waypointSlot`(0=WP1 … 2=WP3) 전달 */
  onSelectPoint: (
    type: "start" | "end" | "waypoint",
    lngLat: LngLat,
    waypointSlot?: 0 | 1 | 2,
  ) => void;
  /** Directions 프로필. 지도 팝업에서 호출 시 부모가 프로필 반영 후 즉시 경로 계산까지 수행할 수 있음. */
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  /** 지도 지점 선택 팝업에서 출발·도착·경유·계산 경로 전체 초기화 */
  onClearRoute?: () => void;
  /** OSRM(Mapbox Streets)·Mapillary 촬영 시퀀스 커버리지 */
  coverageOverlayMode: CoverageOverlayMode;
  /** Mapillary 타일·거리뷰용 클라이언트 토큰(없으면 Mapillary 모드 비활성) */
  mapillaryClientToken?: string | null;
  /** 메뉴 지명 검색 등 — `requestId`가 바뀔 때마다 한 번 카메라 이동 (`bbox` 있으면 도시 단위 fitBounds) */
  externalCameraJump?: {
    lngLat: LngLat;
    zoom?: number;
    requestId: number;
    bbox?: [number, number, number, number] | null;
  } | null;
  /** 메뉴 장소 검색으로 이동한 위치 — 기본 핀과 구분되는 마커 */
  placeSearchMarkerLngLat?: LngLat | null;
  /** Trail: 같은 Trail 에서 코스 주행 중인 다른 사용자 (빨간 dot + 노선) */
  trailSpectatorDots?: TrailSpectatorDot[] | null;
  trailSpectatorRoutes?: LineStringGeometry[] | null;
  /** 전역 livePresence dot — line·courseId·trail 조건과 무관 */
  globalPresenceDots?: GlobalLivePresenceDot[] | null;
  /** Activity World loader 출력 — MapView 가 map zoom 으로 LINE/DOT 적용 */
  activityWorldRaw?: ActivityWorldRawOverlay | null;
  /** Activity World 점 탭 시 팝업 문구 (없으면 기본 pick 팝업) */
  getActivityWorldPinLabel?: ((publicationId: string, kind: "pulse" | "heat") => string | null) | null;
  /** 맵 이동·줌 완료 시 뷰포트(span km 포함) */
  onMapViewport?: (viewport: MapViewportBounds, spanKm: number) => void;
  /**
   * LOD(점↔선) 전용 — 제스처 중에도 스로틀되어 span·zoom 반영.
   * `onMapZoom`/`onMapViewport` 는 `zoomend`·`moveend` 만 써서 HUD 떨림을 막고, LOD 는 여기로 분리.
   */
  onMapLodViewport?: (spanKm: number, zoom: number) => void;
  /** 주행 시작 시 후방·줌 21.5 즉시 적용 — `requestId` 증가마다 1회 */
  rideFollowCameraNonce?: number;
};

export function MapView({
  accessToken,
  routeElevationProfile,
  routeGeometry,
  routeDistanceMeters = 0,
  startLngLat,
  endLngLat,
  routeWaypoints,
  liveLngLat,
  sampleLiveLngLat,
  liveRiderMotion,
  liveRiderNametag,
  peerMarkers: _peerMarkers,
  mapStyle,
  mapZoom,
  followMode,
  enable3D,
  onMapZoom,
  onSelectPoint,
  routeProfile,
  onRouteProfile,
  onClearRoute,
  coverageOverlayMode,
  mapillaryClientToken,
  externalCameraJump = null,
  placeSearchMarkerLngLat = null,
  trailSpectatorDots = null,
  trailSpectatorRoutes = null,
  globalPresenceDots = null,
  activityWorldRaw = null,
  getActivityWorldPinLabel = null,
  onMapViewport,
  onMapLodViewport,
  rideFollowCameraNonce = 0,
}: MapViewProps) {
  const trailSpectatorDataRef = useRef<{ dots: TrailSpectatorDot[]; routes: LineStringGeometry[] }>({
    dots: [],
    routes: [],
  });
  trailSpectatorDataRef.current = {
    dots: trailSpectatorDots ?? [],
    routes: trailSpectatorRoutes ?? [],
  };
  const globalPresenceDataRef = useRef<GlobalLivePresenceDot[]>([]);
  globalPresenceDataRef.current = globalPresenceDots ?? [];
  const activityWorldRawRef = useRef<ActivityWorldRawOverlay>(EMPTY_ACTIVITY_WORLD_RAW);
  activityWorldRawRef.current = activityWorldRaw ?? EMPTY_ACTIVITY_WORLD_RAW;
  const syncActivityWorldLayersOnMapRef = useRef<(map: mapboxgl.Map) => void>(() => {});
  syncActivityWorldLayersOnMapRef.current = (map) => {
    if (!map.style) return;
    const raw = activityWorldRawRef.current;
    syncCourseActivityLayers(map, raw.pulseRoutes, raw.heatRoutes);
    syncWorldHeatDots(map, raw.heatDots);
    syncWorldRedDots(map, raw.pulseDots);
    moveActivityWorldLayersToTop(map);
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  /** props `mapZoom` → `map.zoomTo` 적용을 한 프레임으로 묶어 연속 onChange·리렌더 떨림 완화 */
  const mapZoomApplyRafRef = useRef<number | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const placeSearchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const liveMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const liveMarkerPedalSpriteRef = useRef<HTMLDivElement | null>(null);
  const liveMarkerImgRef = useRef<HTMLImageElement | null>(null);
  const liveMarkerFlipRef = useRef<HTMLDivElement | null>(null);
  const liveMarkerNametagRef = useRef<HTMLDivElement | null>(null);
  const prevLiveForBearingRef = useRef<LngLat | null>(null);
  const liveCrankPhaseRevRef = useRef(0);
  const peerRidersRafRef = useRef<number | null>(null);
  const peerDomMarkersRef = useRef(new Map<string, mapboxgl.Marker>());
  const glbLiveNametagMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const glbLiveNametagElRef = useRef<HTMLDivElement | null>(null);
  const liveRiderNametagRef = useRef(liveRiderNametag);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const routeGeometryRef = useRef<LineStringGeometry | null>(null);
  const routeDistanceMetersRef = useRef(routeDistanceMeters);
  const liveLngLatRef = useRef<LngLat | null>(null);
  const sampleLiveLngLatRef = useRef(sampleLiveLngLat);
  const liveRiderMotionRef = useRef(liveRiderMotion);
  const followModeRef = useRef(followMode);
  const mapZoomRef = useRef(mapZoom);
  const prefersReducedMotionRef = useRef(false);
  const enable3DRef = useRef(enable3D);
  const initialMapStyleRef = useRef(mapStyle);
  const currentStyleRef = useRef(mapStyle);
  const onSelectPointRef = useRef(onSelectPoint);
  const routeWaypointsRef = useRef(routeWaypoints);
  const startLngLatRef = useRef(startLngLat);
  const endLngLatRef = useRef(endLngLat);
  const routeProfileRef = useRef(routeProfile);
  const onRouteProfileRef = useRef(onRouteProfile);
  const onClearRouteRef = useRef(onClearRoute);
  const onMapZoomRef = useRef(onMapZoom);
  const onMapViewportRef = useRef(onMapViewport);
  const onMapLodViewportRef = useRef(onMapLodViewport);
  const getActivityWorldPinLabelRef = useRef(getActivityWorldPinLabel);
  const prevLiveRef = useRef<LngLat | null>(null);
  /** 지명 검색 flyTo 직후 `liveLngLat` 추적 jumpTo 가 카메라를 되돌리는 것을 막는다 */
  const suppressCameraFollowUntilRef = useRef(0);
  const cameraSmoothRef = useRef<{
    center: LngLat | null;
    bearingPrimary: number | null;
    bearing: number | null;
    pitch: number | null;
    zoom: number | null;
    lastTs: number | null;
  }>({
    center: null,
    bearingPrimary: null,
    bearing: null,
    pitch: null,
    zoom: null,
    lastTs: null,
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const BUILDING_LAYER_ID = "boxcycle-3d-buildings";
  const TERRAIN_SOURCE_ID = "boxcycle-dem";

  useEffect(() => {
    liveRiderNametagRef.current = liveRiderNametag;
  }, [liveRiderNametag]);

  useEffect(() => {
    routeGeometryRef.current = routeGeometry;
  }, [routeGeometry]);

  useEffect(() => {
    routeDistanceMetersRef.current = routeDistanceMeters;
  }, [routeDistanceMeters]);

  useEffect(() => {
    liveLngLatRef.current = liveLngLat;
  }, [liveLngLat]);

  useEffect(() => {
    sampleLiveLngLatRef.current = sampleLiveLngLat;
  }, [sampleLiveLngLat]);

  useEffect(() => {
    liveRiderMotionRef.current = liveRiderMotion;
  }, [liveRiderMotion]);

  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    enable3DRef.current = enable3D;
  }, [enable3D]);

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    routeWaypointsRef.current = routeWaypoints;
  }, [routeWaypoints]);

  useEffect(() => {
    startLngLatRef.current = startLngLat;
  }, [startLngLat]);

  useEffect(() => {
    endLngLatRef.current = endLngLat;
  }, [endLngLat]);

  useEffect(() => {
    routeProfileRef.current = routeProfile;
  }, [routeProfile]);

  useEffect(() => {
    onRouteProfileRef.current = onRouteProfile;
  }, [onRouteProfile]);

  useEffect(() => {
    onClearRouteRef.current = onClearRoute;
  }, [onClearRoute]);

  const coverageOverlayModeRef = useRef(coverageOverlayMode);
  const mapillaryClientTokenRef = useRef(mapillaryClientToken);
  coverageOverlayModeRef.current = coverageOverlayMode;
  mapillaryClientTokenRef.current = mapillaryClientToken;

  useEffect(() => {
    onMapZoomRef.current = onMapZoom;
  }, [onMapZoom]);

  useEffect(() => {
    onMapViewportRef.current = onMapViewport;
  }, [onMapViewport]);
  useEffect(() => {
    onMapLodViewportRef.current = onMapLodViewport;
  }, [onMapLodViewport]);

  useEffect(() => {
    getActivityWorldPinLabelRef.current = getActivityWorldPinLabel;
  }, [getActivityWorldPinLabel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    resetCameraSmoothing(cameraSmoothRef.current, map);
  }, [followMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !accessToken?.trim()) {
      return;
    }

    /** StrictMode: remove() 된 map 인스턴스가 mapRef 에 남으면 dot layer 가 죽은 채로 early-return 됨 */
    const staleMap = mapRef.current;
    if (staleMap) {
      if (isMapAttachedToContainer(staleMap, el)) {
        return;
      }
      try {
        staleMap.remove();
      } catch {
        /* noop */
      }
      mapRef.current = null;
      setMapLoaded(false);
    }

    mapboxgl.accessToken = accessToken.trim();
    resetPeerMotionRegistry();
    const map = new mapboxgl.Map({
      container: el,
      style: initialMapStyleRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MAP_GLOBE_MIN_ZOOM,
    });
    map.addControl(new MapZoomGlobeControl(), "top-right");
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true, showZoom: false }),
      "top-right",
    );
    /** 축척: Mapbox 기본 우하단(bottom-right) */
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    mapRef.current = map;

    const reportMapViewport = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const viewport = lngLatBoundsToViewport(bounds);
      onMapViewportRef.current?.(viewport, viewportSpanKm(viewport));
    };

    const reportMapZoomToApp = () => {
      if (
        !shouldSyncMapZoomToApp(
          liveRiderMotionRef.current?.sessionStatus,
          followModeRef.current,
        )
      ) {
        return;
      }
      onMapZoomRef.current?.(Number(map.getZoom().toFixed(1)));
    };

    const reportMapLodViewport = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const viewport = lngLatBoundsToViewport(bounds);
      onMapLodViewportRef.current?.(viewportSpanKm(viewport), Number(map.getZoom().toFixed(1)));
    };

    let lodRaf = 0;
    let lodLastEmit = 0;
    const LOD_VIEWPORT_THROTTLE_MS = 100;
    const scheduleLodViewportReport = () => {
      if (lodRaf) return;
      lodRaf = requestAnimationFrame(() => {
        lodRaf = 0;
        const now = performance.now();
        if (now - lodLastEmit < LOD_VIEWPORT_THROTTLE_MS) {
          scheduleLodViewportReport();
          return;
        }
        lodLastEmit = now;
        if (onMapLodViewportRef.current) reportMapLodViewport();
        syncActivityWorldLayersOnMapRef.current(map);
      });
    };

    map.on("load", () => {
      setMapLoaded(true);
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
      reportMapViewport();
      reportMapLodViewport();
      syncActivityWorldLayersOnMapRef.current(map);
    });

    map.on("moveend", reportMapViewport);
    map.on("zoomend", reportMapViewport);
    map.on("zoomend", reportMapZoomToApp);
    map.on("idle", reportMapViewport);
    map.on("move", scheduleLodViewportReport);
    map.on("zoom", scheduleLodViewportReport);

    map.on("style.load", () => {
      const latestRoute = routeGeometryRef.current;
      if (latestRoute?.coordinates?.length) {
        const routeFeature = {
          type: "Feature" as const,
          properties: {} as Record<string, never>,
          geometry: latestRoute,
        };
        if (!map.getSource("route")) {
          map.addSource("route", { type: "geojson", data: routeFeature });
          map.addLayer(
            {
              id: "route",
              type: "line",
              source: "route",
              paint: { "line-color": ROUTE_LINE_COLOR, "line-width": 4 },
            },
            routeLayerInsertBefore(map),
          );
        }
      }
      if (shouldMoveActivityWorldLayersToTop()) {
        moveActivityWorldLayersToTop(map);
      }
      apply3DState(map, enable3DRef.current, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
      try {
        applyCoverageOverlayMode(
          map,
          coverageOverlayModeRef.current,
          mapillaryClientTokenRef.current ?? undefined,
        );
      } catch (e) {
        console.warn("[MapView] coverage overlay", e);
      }
      /** 스타일 리로드 시 기존 동행 DOM 마커 제거 후 시뮬 타깃만 재병합(동행은 GeoJSON이 아닌 Marker 로 표시) */
      glbLiveNametagMarkerRef.current?.remove();
      glbLiveNametagMarkerRef.current = null;
      glbLiveNametagElRef.current = null;
      for (const m of peerDomMarkersRef.current.values()) {
        try {
          m.remove();
        } catch {
          /* noop */
        }
      }
      peerDomMarkersRef.current.clear();
      try {
        syncLiveOverlayLayersOnMap(
          map,
          trailSpectatorDataRef.current.dots,
          trailSpectatorDataRef.current.routes,
          globalPresenceDataRef.current,
        );
        syncActivityWorldLayersOnMapRef.current(map);
      } catch {
        /* noop */
      }
    });

    map.on("click", (event) => {
      const pinLabel = getActivityWorldPinLabelRef.current;
      if (
        pinLabel &&
        tryOpenActivityWorldPinPopup(map, event, pinLabel, popupRef, pickPickPopupAnchor)
      ) {
        return;
      }

      const picked: LngLat = [event.lngLat.lng, event.lngLat.lat];
      popupRef.current?.remove();
      const ac = new AbortController();
      const closePopup = () => {
        ac.abort();
        popupRef.current?.remove();
        popupRef.current = null;
      };
      const anchor = pickPickPopupAnchor(map, event);
      const popup = new mapboxgl.Popup({
        closeOnClick: true,
        className: "map-view__pick-popup",
        maxWidth: "min(20rem, calc(100vw - 1.5rem))",
        anchor,
        offset: 18,
      })
        .setLngLat(picked)
        .setDOMContent(
          buildPickPopup({
            lngLat: picked,
            getWaypointCount: () => routeWaypointsRef.current.length,
            accessToken: accessToken.trim(),
            signal: ac.signal,
            onSelectPoint: (type, lngLat, slot) => onSelectPointRef.current(type, lngLat, slot),
            routeProfile: routeProfileRef.current,
            onRouteProfile: (p) => onRouteProfileRef.current(p),
            onClearRoute:
              typeof onClearRouteRef.current === "function"
                ? () => {
                    onClearRouteRef.current?.();
                  }
                : undefined,
            initialHasStart: Boolean(startLngLatRef.current),
            initialHasEnd: Boolean(endLngLatRef.current),
            closePopup,
          }),
        )
        .addTo(map);
      popup.on("close", () => {
        ac.abort();
        if (popupRef.current === popup) popupRef.current = null;
      });
      popupRef.current = popup;
    });

    /** `zoom` 은 제스처·네비 버튼 애니메이션 중 매 프레임 발생 → React 재동기화가 `zoomTo` 와 맞물려 떨림 유발. 완료 시점만 반영 */
    map.on("zoomend", () => {
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    });

    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);

    return () => {
      map.off("moveend", reportMapViewport);
      map.off("zoomend", reportMapViewport);
      map.off("idle", reportMapViewport);
      map.off("move", scheduleLodViewportReport);
      map.off("zoom", scheduleLodViewportReport);
      if (lodRaf) cancelAnimationFrame(lodRaf);
      window.removeEventListener("resize", onResize);
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      placeSearchMarkerRef.current?.remove();
      for (const wm of waypointMarkersRef.current) wm.remove();
      waypointMarkersRef.current = [];
      liveMarkerRef.current?.remove();
      glbLiveNametagMarkerRef.current?.remove();
      popupRef.current?.remove();
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      placeSearchMarkerRef.current = null;
      waypointMarkersRef.current = [];
      liveMarkerRef.current = null;
      glbLiveNametagMarkerRef.current = null;
      glbLiveNametagElRef.current = null;
      liveMarkerFlipRef.current = null;
      liveMarkerPedalSpriteRef.current = null;
      liveMarkerNametagRef.current = null;
      popupRef.current = null;
      if (peerRidersRafRef.current != null) {
        cancelAnimationFrame(peerRidersRafRef.current);
        peerRidersRafRef.current = null;
      }
      for (const m of peerDomMarkersRef.current.values()) {
        try {
          m.remove();
        } catch {
          /* noop */
        }
      }
      peerDomMarkersRef.current.clear();
      if (mapRef.current === map) {
        try {
          map.remove();
        } catch {
          /* noop */
        }
        mapRef.current = null;
      }
      setMapLoaded(false);
    };
  }, [accessToken]);

  /** 경로 레이어 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!routeGeometry?.coordinates?.length) {
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");
      if (map.isStyleLoaded()) {
        try {
          applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
        } catch {
          /* noop */
        }
      }
      return;
    }

    const routeFeature = {
      type: "Feature" as const,
      properties: {} as Record<string, never>,
      geometry: routeGeometry,
    };

    if (map.getSource("route")) {
      (map.getSource("route") as mapboxgl.GeoJSONSource).setData(routeFeature);
      if (map.getLayer("route")) {
        map.setPaintProperty("route", "line-color", ROUTE_LINE_COLOR);
      }
    } else {
      map.addSource("route", { type: "geojson", data: routeFeature });
      map.addLayer(
        {
          id: "route",
          type: "line",
          source: "route",
          paint: {
            "line-color": ROUTE_LINE_COLOR,
            "line-width": 4,
          },
        },
        routeLayerInsertBefore(map),
      );
    }

    if (shouldMoveActivityWorldLayersToTop()) {
      moveActivityWorldLayersToTop(map);
    }

    const session = liveRiderMotionRef.current?.sessionStatus;
    if (session === "running" || session === "paused") {
      if (map.isStyleLoaded()) {
        try {
          applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
        } catch {
          /* noop */
        }
      }
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    routeGeometry.coordinates.forEach((p) => bounds.extend(p as [number, number]));

    map.stop();
    /** 경로 프레이밍 직후 `liveLngLat` 추적 jumpTo 가 카메라를 덮어쓰지 않도록 (입문·퍼블릭 불러오기 등) */
    suppressCameraFollowUntilRef.current = performance.now() + (prefersReducedMotion ? 120 : 1700);

    const syncZoomFromMap = () => {
      if (
        !shouldSyncMapZoomToApp(
          liveRiderMotionRef.current?.sessionStatus,
          followModeRef.current,
        )
      ) {
        return;
      }
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    };
    const onMoveEnd = () => {
      map.off("moveend", onMoveEnd);
      syncZoomFromMap();
    };
    map.once("moveend", onMoveEnd);
    map.fitBounds(bounds, {
      padding: { top: 52, bottom: 120, left: 44, right: 44 },
      maxZoom: 16,
      duration: prefersReducedMotion ? 0 : 1100,
      essential: true,
    });

    if (map.isStyleLoaded()) {
      try {
        applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
      } catch {
        /* noop */
      }
    }

    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [routeGeometry, mapLoaded, prefersReducedMotion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;
    try {
      applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
    } catch {
      /* noop */
    }
  }, [mapLoaded, coverageOverlayMode, mapillaryClientToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (currentStyleRef.current === mapStyle) return;
    currentStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle, mapLoaded]);

  /** 출발/도착 마커 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (startLngLat) {
      if (!startMarkerRef.current) {
        startMarkerRef.current = new mapboxgl.Marker({
          element: createRouteEndpointPinEl("start"),
          anchor: "bottom",
          className: "map-view__pin-marker map-view__pin-marker--start map-view__route-pin-marker",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(startLngLat)
          .addTo(map);
      } else {
        startMarkerRef.current.setLngLat(startLngLat);
      }
    } else {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
    }

    if (endLngLat) {
      if (!endMarkerRef.current) {
        endMarkerRef.current = new mapboxgl.Marker({
          element: createRouteEndpointPinEl("end"),
          anchor: "bottom",
          className: "map-view__pin-marker map-view__pin-marker--end map-view__route-pin-marker",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(endLngLat)
          .addTo(map);
      } else {
        endMarkerRef.current.setLngLat(endLngLat);
      }
    } else {
      endMarkerRef.current?.remove();
      endMarkerRef.current = null;
    }
  }, [startLngLat, endLngLat, mapLoaded]);

  /** 메뉴 장소 검색 결과 위치 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (placeSearchMarkerLngLat) {
      if (!placeSearchMarkerRef.current) {
        placeSearchMarkerRef.current = new mapboxgl.Marker({
          color: "#0ea5e9",
          className: "map-view__pin-marker map-view__pin-marker--place-search",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(placeSearchMarkerLngLat)
          .addTo(map);
      } else {
        placeSearchMarkerRef.current.setLngLat(placeSearchMarkerLngLat);
      }
    } else {
      placeSearchMarkerRef.current?.remove();
      placeSearchMarkerRef.current = null;
    }
  }, [placeSearchMarkerLngLat, mapLoaded]);

  /** 경과지 마커(순번 1…3) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const markers = waypointMarkersRef.current;
    while (markers.length > routeWaypoints.length) {
      markers.pop()?.remove();
    }
    while (markers.length < routeWaypoints.length) {
      const idx = markers.length;
      const order = idx + 1;
      const el = createWaypointMarkerEl(order);
      const m = new mapboxgl.Marker({
        element: el,
        className: "map-view__pin-marker map-view__waypoint-marker-host",
        ...PIN_MARKER_VIEWPORT_ALIGNMENT,
      })
        .setLngLat(routeWaypoints[idx]!)
        .addTo(map);
      markers.push(m);
    }
    for (let i = 0; i < routeWaypoints.length; i++) {
      markers[i]?.setLngLat(routeWaypoints[i]!);
    }
  }, [routeWaypoints, mapLoaded]);

  /** 라이브 위치 마커 생성·제거 — 위치 갱신은 rAF(sampleLiveLngLat) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (liveLngLat) {
      if (RIDER_PROTOTYPE_MODE !== "glb" && !liveMarkerRef.current) {
        if (RIDER_PROTOTYPE_MODE === "iso2d") {
          const { root, nametag, flip, img } = createIso2dRiderMarkerRoot(
            "self",
            "",
            "map-view__live-rider-host",
          );
          liveMarkerFlipRef.current = flip;
          liveMarkerImgRef.current = img;
          liveMarkerNametagRef.current = nametag;
          liveMarkerPedalSpriteRef.current = null;
          prevLiveForBearingRef.current = null;
          liveMarkerRef.current = new mapboxgl.Marker({
            element: root,
            className: "map-view__live-rider-marker",
            anchor: "bottom",
            offset: RIDER_ROUTE_MARKER_OFFSET_PX,
            ...PIN_MARKER_VIEWPORT_ALIGNMENT,
          })
            .setLngLat(liveLngLat)
            .addTo(map);
        } else {
          const { root, nametag, flip, sprite } = createLiveRiderMarkerRoot();
          liveMarkerFlipRef.current = flip;
          liveMarkerPedalSpriteRef.current = sprite;
          liveMarkerImgRef.current = null;
          liveMarkerNametagRef.current = nametag;
          prevLiveForBearingRef.current = null;
          liveMarkerRef.current = new mapboxgl.Marker({
            element: root,
            className: "map-view__live-rider-marker",
            anchor: "bottom",
            offset: RIDER_ROUTE_MARKER_OFFSET_PX,
            ...PIN_MARKER_VIEWPORT_ALIGNMENT,
          })
            .setLngLat(liveLngLat)
            .addTo(map);
        }
      }
    } else {
      liveMarkerRef.current?.remove();
      glbLiveNametagMarkerRef.current?.remove();
      liveMarkerRef.current = null;
      glbLiveNametagMarkerRef.current = null;
      glbLiveNametagElRef.current = null;
      liveMarkerFlipRef.current = null;
      liveMarkerPedalSpriteRef.current = null;
      liveMarkerImgRef.current = null;
      liveMarkerNametagRef.current = null;
      prevLiveForBearingRef.current = null;
      if (RIDER_PROTOTYPE_MODE === "glb") {
        clearRiderGlbModels(map);
      }
    }

    if (RIDER_PROTOTYPE_MODE !== "glb") {
      const tagEl = liveMarkerNametagRef.current;
      if (tagEl) {
        const t = liveRiderNametag?.trim();
        tagEl.textContent = t ?? "";
        tagEl.style.display = t ? "flex" : "none";
      }
      const host = liveMarkerRef.current?.getElement();
      if (host) {
        host.title = liveRiderNametag?.trim() || "내 위치";
      }
    }
  }, [liveLngLat, liveRiderNametag, mapLoaded]);

  /** 본인·동행 라이더: rAF 로 위치·방향·페달 갱신 (동행 motion 은 PeerMotionRegistry) */
  useEffect(() => {
    if (!mapLoaded) return;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const map = mapRef.current;
      // isStyleLoaded() 는 위성+3D terrain 에서 영구 false 가능 → 동행 스프라이트 영영 차단.
      if (!map?.style) {
        peerRidersRafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      const sampleFn = sampleLiveLngLatRef.current;
      const sampled = sampleFn?.() ?? liveLngLatRef.current;
      const prevForBearing = prevLiveForBearingRef.current;
      if (sampled) {
        liveLngLatRef.current = sampled;
        if (liveMarkerRef.current && RIDER_PROTOTYPE_MODE !== "glb") {
          liveMarkerRef.current.setLngLat(sampled);
        }
        syncLiveSelfRiderVisual(
          sampled,
          liveRiderMotionRef.current,
          routeGeometryRef.current,
          prevLiveForBearingRef,
          liveMarkerFlipRef,
          liveMarkerImgRef,
          liveMarkerPedalSpriteRef,
          prefersReducedMotionRef.current,
        );
        tickRideCameraFollow(map, sampled, {
          followMode: followModeRef.current,
          enable3D: enable3DRef.current,
          mapZoom: mapZoomRef.current,
          sessionStatus: liveRiderMotionRef.current?.sessionStatus,
          routeGeometry: routeGeometryRef.current,
          prevLiveRef: prevLiveRef,
          smooth: cameraSmoothRef.current,
          suppressUntilMs: suppressCameraFollowUntilRef.current,
          nowMs: now,
        });
      }

      const showPeerSprites = mapZoomRef.current > MAP_PEER_SPRITE_MIN_ZOOM;
      const fc = showPeerSprites
        ? stepPeerDriveAndBuildGeoJson(
            null,
            dt,
            getBearing,
            routeGeometryRef.current,
            Date.now(),
          )
        : EMPTY_GEOJSON_FC;
      syncPeerDomMarkers(map, fc.features as PeerDomGJFeature[], peerDomMarkersRef);
      if (RIDER_PROTOTYPE_MODE === "glb") {
        const specs: {
          id: string;
          lngLat: LngLat;
          bearingDeg: number;
          pedalPose?: ReturnType<typeof resolveGlbPedalPose>;
        }[] = [];
        const live = liveLngLatRef.current;
        if (live) {
          const bearingDeg = resolveRiderBearingDeg(
            routeGeometryRef.current,
            live,
            prevForBearing,
          );
          const motion = liveRiderMotionRef.current;
          const speedNow = motion?.speedKmh ?? 0;
          const pedalingRunning =
            motion != null && motion.sessionStatus === "running" && speedNow > 0.35;
          if (pedalingRunning && !prefersReducedMotionRef.current) {
            const rpm = resolvePedalCrankRpm({
              speedKmh: motion.speedKmh,
              crankRpmFromSensor: motion.crankRpmFromSensor,
            });
            liveCrankPhaseRevRef.current += (rpm / 60) * dt;
          }
          specs.push({
            id: "live-self",
            lngLat: live,
            bearingDeg,
            pedalPose: resolveGlbPedalPose(liveCrankPhaseRevRef.current),
          });
        }
        for (const f of fc.features as PeerDomGJFeature[]) {
          const phaseRev =
            f.properties.pframe > 0
              ? f.properties.pframe / PEER_RIDER_PEDAL_FRAME_COUNT
              : 0;
          specs.push({
            id: f.properties.id,
            lngLat: f.geometry.coordinates,
            bearingDeg: f.properties.hdg,
            pedalPose: resolveGlbPedalPose(phaseRev),
          });
        }
        syncRiderGlbModels(map, specs);
        const liveLabel = liveRiderNametagRef.current?.trim() ?? "";
        syncGlbLiveNametagMarker(
          map,
          live,
          liveLabel,
          glbLiveNametagMarkerRef,
          glbLiveNametagElRef,
        );
      }
      peerRidersRafRef.current = requestAnimationFrame(tick);
    };
    peerRidersRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (peerRidersRafRef.current != null) {
        cancelAnimationFrame(peerRidersRafRef.current);
      }
      peerRidersRafRef.current = null;
    };
  }, [mapLoaded]);

  /** GLB 네임태그 — 3D terrain·카메라 이동 시 DOM 마커 재투영 */
  useEffect(() => {
    if (!mapLoaded || RIDER_PROTOTYPE_MODE !== "glb") return;
    const map = mapRef.current;
    if (!map) return;
    const onRender = () => {
      reprojectGlbNametagMarkers(glbLiveNametagMarkerRef.current, peerDomMarkersRef.current);
    };
    map.on("render", onRender);
    return () => {
      map.off("render", onRender);
    };
  }, [mapLoaded]);

  /** UI·시트에서 바꾼 `mapZoom` props → Mapbox. (자동 fitBounds 직후 suppress 로는 막지 않음) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (Math.abs(map.getZoom() - mapZoom) < 0.05) return;

    const applyPropZoom = () => {
      const m = mapRef.current;
      if (!m || Math.abs(m.getZoom() - mapZoom) < 0.05) return;
      cameraSmoothRef.current.zoom = mapZoom;
      suppressCameraFollowUntilRef.current = performance.now() + 600;
      if (mapZoomApplyRafRef.current != null) cancelAnimationFrame(mapZoomApplyRafRef.current);
      mapZoomApplyRafRef.current = requestAnimationFrame(() => {
        mapZoomApplyRafRef.current = null;
        const live = mapRef.current;
        if (!live || Math.abs(live.getZoom() - mapZoom) < 0.05) return;
        live.zoomTo(mapZoom, { duration: 0 });
      });
    };

    if (map.isStyleLoaded()) {
      applyPropZoom();
    } else {
      map.once("style.load", applyPropZoom);
    }

    return () => {
      map.off("style.load", applyPropZoom);
      if (mapZoomApplyRafRef.current != null) {
        cancelAnimationFrame(mapZoomApplyRafRef.current);
        mapZoomApplyRafRef.current = null;
      }
    };
  }, [mapZoom, mapLoaded]);

  /** 주행 시작 — fitBounds·zoomend 동기화와 무관하게 후방·줌 21.5 즉시 스냅 */
  useEffect(() => {
    if (!rideFollowCameraNonce || !mapLoaded) return;
    const map = mapRef.current;
    if (!map) return;

    const target = liveLngLatRef.current ?? startLngLatRef.current;
    if (!target) return;

    mapZoomRef.current = RIDE_FOLLOW_CAMERA_ZOOM;
    suppressCameraFollowUntilRef.current = 0;
    cameraSmoothRef.current.zoom = RIDE_FOLLOW_CAMERA_ZOOM;

    const headingFromRoute = getAverageHeadingAheadFromPoint(
      routeGeometryRef.current,
      target,
      CAMERA_BEARING_WINDOW_METERS,
      CAMERA_BEARING_WINDOW_SAMPLES,
    );
    const baseHeading = headingFromRoute ?? map.getBearing();
    const nextCamera = getCameraForFollowMode({
      mode: "rear30",
      baseHeading,
      currentPitch: map.getPitch(),
      enable3D: enable3DRef.current,
    });
    const center = offsetLngLatByBearingMeters(
      target,
      nextCamera.bearing + 180,
      rearFollowOffsetMeters(RIDE_FOLLOW_CAMERA_ZOOM),
    );

    const applySnap = () => {
      const live = mapRef.current;
      if (!live) return;
      live.stop();
      live.jumpTo({
        center,
        zoom: RIDE_FOLLOW_CAMERA_ZOOM,
        bearing: nextCamera.bearing,
        pitch: nextCamera.pitch,
      });
      const smooth = cameraSmoothRef.current;
      smooth.center = center;
      smooth.bearing = nextCamera.bearing;
      smooth.bearingPrimary = nextCamera.bearing;
      smooth.pitch = nextCamera.pitch;
      smooth.zoom = RIDE_FOLLOW_CAMERA_ZOOM;
      smooth.lastTs = null;
    };

    if (map.isStyleLoaded()) {
      applySnap();
    } else {
      map.once("style.load", applySnap);
    }

    return () => {
      map.off("style.load", applySnap);
    };
  }, [rideFollowCameraNonce, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const syncOverlays = () => {
      if (!map.isStyleLoaded()) return;
      syncLiveOverlayLayersOnMap(
        map,
        trailSpectatorDots ?? [],
        trailSpectatorRoutes ?? [],
        globalPresenceDots ?? [],
      );
    };

    syncOverlays();
    map.on("style.load", syncOverlays);
    return () => {
      map.off("style.load", syncOverlays);
    };
  }, [mapLoaded, trailSpectatorDots, trailSpectatorRoutes, globalPresenceDots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const syncActivity = () => syncActivityWorldLayersOnMapRef.current(map);

    syncActivity();
    if (!map.isStyleLoaded()) {
      map.once("style.load", syncActivity);
      map.once("idle", syncActivity);
    }
    return () => {
      map.off("style.load", syncActivity);
      map.off("idle", syncActivity);
    };
  }, [
    mapLoaded,
    activityWorldRaw,
    activityWorldRaw?.pulseDots.length ?? 0,
    activityWorldRaw?.heatDots.length ?? 0,
    activityWorldRaw?.pulseRoutes.length ?? 0,
    activityWorldRaw?.heatRoutes.length ?? 0,
  ]);

  /** style.reload 후 dot layer 유실 시 주기적 재동기화 */
  useEffect(() => {
    const hasDots =
      (activityWorldRaw?.pulseDots.length ?? 0) > 0 ||
      (activityWorldRaw?.heatDots.length ?? 0) > 0;
    if (!mapLoaded || !hasDots) return;
    const map = mapRef.current;
    if (!map) return;

    const run = () => syncActivityWorldLayersOnMapRef.current(map);
    run();
    const onStyle = () => run();
    const onIdle = () => run();
    map.on("style.load", onStyle);
    map.on("idle", onIdle);
    const intervalId = window.setInterval(run, 2500);

    return () => {
      window.clearInterval(intervalId);
      map.off("style.load", onStyle);
      map.off("idle", onIdle);
    };
  }, [mapLoaded, activityWorldRaw]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !externalCameraJump) return;
    const { lngLat, zoom: zoomHint, bbox } = externalCameraJump;
    map.stop();

    const syncZoomFromMap = () => {
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    };

    const useBbox =
      bbox != null &&
      bbox.length === 4 &&
      Number.isFinite(bbox[0]) &&
      Number.isFinite(bbox[1]) &&
      Number.isFinite(bbox[2]) &&
      Number.isFinite(bbox[3]) &&
      bbox[2] > bbox[0] &&
      bbox[3] > bbox[1];

    suppressCameraFollowUntilRef.current = performance.now() + (prefersReducedMotion ? 120 : 1700);

    if (useBbox) {
      const onEnd = () => {
        map.off("moveend", onEnd);
        syncZoomFromMap();
      };
      map.once("moveend", onEnd);
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        {
          padding: { top: 52, bottom: 120, left: 44, right: 44 },
          maxZoom: 16,
          duration: prefersReducedMotion ? 0 : 1100,
          essential: true,
        },
      );
      return () => {
        map.off("moveend", onEnd);
      };
    }

    const cur = map.getCenter();
    const from: LngLat = [cur.lng, cur.lat];
    const dM = getDistanceMeters(from, lngLat);
    let chosenZoom = zoomHint ?? 12;
    if (zoomHint == null) {
      if (dM > 1_200_000) chosenZoom = 5;
      else if (dM > 400_000) chosenZoom = 6;
      else if (dM > 120_000) chosenZoom = 9;
      else if (dM > 35_000) chosenZoom = 11;
      else if (dM > 8_000) chosenZoom = 13;
      else if (dM > 2_500) chosenZoom = 14;
      else chosenZoom = Math.max(map.getZoom(), 15);
    }
    const onEndFly = () => {
      map.off("moveend", onEndFly);
      syncZoomFromMap();
    };
    map.once("moveend", onEndFly);
    map.flyTo({
      center: lngLat,
      zoom: chosenZoom,
      duration: prefersReducedMotion ? 0 : 1100,
      essential: true,
    });
    return () => {
      map.off("moveend", onEndFly);
    };
  }, [externalCameraJump, mapLoaded, prefersReducedMotion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    apply3DState(map, enable3D, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
  }, [enable3D, mapLoaded]);

  if (!accessToken?.trim()) {
    return (
      <div className="map-view map-view--placeholder">
        <p>
          Mapbox 토큰이 없습니다. <code>apps/web/.env</code> 에{" "}
          <code>VITE_MAPBOX_ACCESS_TOKEN</code> 를 설정하고 개발 서버를 다시 시작하세요.
        </p>
      </div>
    );
  }

  const progressRatio = getProgressRatioOnRoute(routeGeometry, liveLngLat);
  const hasRoute = Boolean(routeGeometry && routeGeometry.coordinates.length > 1);
  /** 부모 `routeElevationProfile` — 예전 로컬 state 이름(`elevation`)과 혼동 방지용 별칭 */
  const elevation = routeElevationProfile;
  const isLoadingElevation = hasRoute && elevation.loading;
  const isElevationError = hasRoute && elevation.error !== null;
  const isElevationReady =
    hasRoute && !elevation.loading && elevation.error === null && elevation.values.length > 1;
  const routeLenMForChart =
    routeGeometry && routeGeometry.coordinates.length > 1 ? lineStringLengthMeters(routeGeometry) : 0;
  const elevationUi = isElevationReady
    ? buildElevationUi(elevation.values, progressRatio, routeLenMForChart)
    : null;
  return (
    <div className="map-view-shell">
      <div ref={containerRef} className="map-view" role="presentation" />
      {isLoadingElevation ? (
        <div className="elevation-overlay">
          <div className="elevation-overlay__empty">고도 계산 중…</div>
        </div>
      ) : null}
      {isElevationError ? (
        <div className="elevation-overlay">
          <div className="elevation-overlay__empty">고도 데이터를 불러오지 못했습니다.</div>
        </div>
      ) : null}
      {elevationUi ? (
        <div className="elevation-overlay">
          <div className="elevation-overlay__meta">
            <span>시점 {elevationUi.startMeters.toFixed(0)}m</span>
            <span>종점 {elevationUi.endMeters.toFixed(0)}m</span>
          </div>
          <svg
            className="elevation-overlay__svg"
            viewBox="0 0 420 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="elevation profile"
          >
            <polyline
              points={elevationUi.polylinePoints}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {elevationUi.marker ? (
              <circle
                cx={elevationUi.marker.x}
                cy={elevationUi.marker.y}
                r="4.2"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.4"
              />
            ) : null}
          </svg>
        </div>
      ) : null}
    </div>
  );
}

function pickPickPopupAnchor(
  map: mapboxgl.Map,
  e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent,
): "top" | "bottom" | "left" | "right" {
  const canvas = map.getCanvas();
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const { x, y } = e.point;
  const m = Math.min(80, w * 0.14, h * 0.13);
  if (y < m) return "top";
  if (y > h - m) return "bottom";
  if (x < m) return "left";
  if (x > w - m) return "right";
  return "bottom";
}

function createLiveRiderMarkerRoot(): {
  root: HTMLDivElement;
  nametag: HTMLDivElement;
  flip: HTMLDivElement;
  sprite: HTMLDivElement;
} {
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host map-view__live-rider-host";
  const nametag = document.createElement("div");
  nametag.className = "map-view__rider-nametag map-view__rider-nametag--live";
  nametag.setAttribute("aria-hidden", "true");
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  sprite.style.backgroundImage = `url("${base}rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}")`;
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(nametag);
  root.appendChild(flip);
  root.title = "내 위치";
  return { root, nametag, flip, sprite };
}

/** Mapbox 기본 핀 형태 — 흰 원 없이 핀 머리에 큰 흰색 S/E */
function createRouteEndpointPinEl(kind: "start" | "end"): HTMLDivElement {
  const color = kind === "start" ? "#16a34a" : "#dc2626";
  const letter = kind === "start" ? "S" : "E";
  const root = document.createElement("div");
  root.className = `map-view__route-pin map-view__route-pin--${kind}`;
  root.title = kind === "start" ? "출발 (Start)" : "도착 (End)";
  root.setAttribute("aria-label", root.title);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("display", "block");
  svg.setAttribute("height", "41");
  svg.setAttribute("width", "27");
  svg.setAttribute("viewBox", "0 0 27 41");
  svg.setAttribute("aria-hidden", "true");

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("fill-rule", "nonzero");

  const pinPath =
    "M27,13.5 C27,19.074644 20.250001,27.000002 14.75,34.500002 C14.016665,35.500004 12.983335,35.500004 12.25,34.500002 C6.7499993,27.000002 0,19.222448 0,13.5 C0,6.0441559 6.0441559,0 13.5,0 C20.955844,0 27,6.0441559 27,13.5 Z";

  const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shadow.setAttribute("fill", "rgba(0,0,0,0.25)");
  shadow.setAttribute("d", pinPath);
  shadow.setAttribute("transform", "translate(3,3)");

  const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
  fill.setAttribute("fill", color);
  fill.setAttribute("d", pinPath);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", "13.5");
  text.setAttribute("y", "14.5");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("fill", "#ffffff");
  text.setAttribute("font-size", "13");
  text.setAttribute("font-weight", "800");
  text.setAttribute("font-family", "system-ui, -apple-system, Segoe UI, sans-serif");
  text.setAttribute("paint-order", "stroke fill");
  text.setAttribute("stroke", "rgba(0,0,0,0.35)");
  text.setAttribute("stroke-width", "0.6");
  text.textContent = letter;

  g.append(shadow, fill, text);
  svg.append(g);
  root.append(svg);
  return root;
}

function createWaypointMarkerEl(order: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "map-view__waypoint-marker";
  el.textContent = String(order);
  el.title = `경과지 ${order}`;
  return el;
}

function isWaypointSlotEnabled(currentCount: number, slot: 0 | 1 | 2): boolean {
  if (slot < currentCount) return true;
  if (slot === currentCount && currentCount < MAX_ROUTE_WAYPOINTS) return true;
  return false;
}

function waypointSlotTitle(slot: 0 | 1 | 2, count: number): string {
  if (isWaypointSlotEnabled(count, slot)) {
    return slot < count
      ? `Move waypoint ${slot + 1} here`
      : `Add waypoint ${slot + 1} here`;
  }
  if (slot > count) {
    return `Set WP${count + 1} before WP${slot + 1}`;
  }
  return "No more waypoints";
}

async function fetchPointElevationMeters(lngLat: LngLat, signal: AbortSignal): Promise<number | null> {
  const [lng, lat] = lngLat;
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as { elevation?: number[] };
  const v = data.elevation?.[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildActivityWorldPopupElement(text: string, kind: "pulse" | "heat"): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `map-view__activity-popup map-view__activity-popup--${kind}`;
  const lines = text.split("\n").filter((line) => line.length > 0);
  const title = document.createElement("div");
  title.className = "map-view__activity-popup-title";
  title.textContent = lines[0] ?? "Activity";
  wrap.appendChild(title);
  if (lines.length > 1) {
    const body = document.createElement("div");
    body.className = "map-view__activity-popup-body";
    body.textContent = lines.slice(1).join(" · ");
    wrap.appendChild(body);
  }
  return wrap;
}

function tryOpenActivityWorldPinPopup(
  map: mapboxgl.Map,
  event: mapboxgl.MapMouseEvent,
  getLabel: (publicationId: string, kind: "pulse" | "heat") => string | null,
  popupRef: { current: mapboxgl.Popup | null },
  pickAnchor: (map: mapboxgl.Map, event: mapboxgl.MapMouseEvent) => mapboxgl.Anchor,
): boolean {
  const layers = [ACTIVITY_PULSE_DOTS_LAYER, ACTIVITY_HEAT_DOTS_LAYER].filter((id) =>
    map.getLayer(id),
  );
  if (!layers.length) return false;
  const features = map.queryRenderedFeatures(event.point, { layers });
  if (!features.length) return false;
  const hit = features[0];
  const publicationId = hit.properties?.publicationId;
  if (typeof publicationId !== "string" || !publicationId.trim()) return false;
  const kind: "pulse" | "heat" = hit.layer?.id === ACTIVITY_HEAT_DOTS_LAYER ? "heat" : "pulse";
  const label = getLabel(publicationId.trim(), kind);
  if (!label) return false;

  popupRef.current?.remove();
  const popup = new mapboxgl.Popup({
    closeOnClick: true,
    className: "map-view__activity-popup-wrap",
    maxWidth: "min(16rem, calc(100vw - 1.5rem))",
    anchor: pickAnchor(map, event),
    offset: 12,
  })
    .setLngLat(event.lngLat)
    .setDOMContent(buildActivityWorldPopupElement(label, kind))
    .addTo(map);
  popup.on("close", () => {
    if (popupRef.current === popup) popupRef.current = null;
  });
  popupRef.current = popup;
  return true;
}

function buildPickPopup(deps: {
  lngLat: LngLat;
  getWaypointCount: () => number;
  accessToken: string;
  signal: AbortSignal;
  onSelectPoint: (
    type: "start" | "end" | "waypoint",
    lngLat: LngLat,
    waypointSlot?: 0 | 1 | 2,
  ) => void;
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  onClearRoute?: (() => void) | undefined;
  initialHasStart: boolean;
  initialHasEnd: boolean;
  closePopup: () => void;
}): HTMLDivElement {
  const {
    lngLat,
    getWaypointCount,
    accessToken,
    signal,
    onSelectPoint,
    routeProfile,
    onRouteProfile,
    onClearRoute,
    initialHasStart,
    initialHasEnd,
    closePopup,
  } = deps;
  const [lng, lat] = lngLat;

  const wrap = document.createElement("div");
  wrap.className = "map-view__pick";

  /** 팝업이 열린 뒤 출발/도착 클릭으로 갱신되는 끝점 보유 상태(리렌더 전에도 동작). */
  const pins = { start: initialHasStart, end: initialHasEnd };

  const addressEl = document.createElement("div");
  addressEl.className = "map-view__pick-address";
  addressEl.textContent = "주소를 불러오는 중…";

  const metaEl = document.createElement("div");
  metaEl.className = "map-view__pick-meta";
  metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 …`;

  const pinRow = document.createElement("div");
  pinRow.className = "map-view__pick-actions map-view__pick-actions--pin-row";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "map-view__pick-btn map-view__pick-btn--start";
  startBtn.textContent = "Start";
  startBtn.title = "Set as start";
  startBtn.setAttribute("aria-label", "Set start");
  startBtn.onclick = () => {
    onSelectPoint("start", lngLat);
    pins.start = true;
    if (!pins.end) closePopup();
    else syncProfileUi();
  };

  const wpSlots: (0 | 1 | 2)[] = [0, 1, 2];
  const initialCount = getWaypointCount();
  const wpButtons: HTMLButtonElement[] = [];
  for (const slot of wpSlots) {
    const wpBtn = document.createElement("button");
    wpBtn.type = "button";
    wpBtn.className = "map-view__pick-btn map-view__pick-btn--wp";
    wpBtn.textContent = `WP${slot + 1}`;
    const enabled = isWaypointSlotEnabled(initialCount, slot);
    wpBtn.disabled = !enabled;
    wpBtn.title = waypointSlotTitle(slot, initialCount);
    wpBtn.setAttribute("aria-label", `Waypoint ${slot + 1} (WP${slot + 1})`);
    wpBtn.onclick = () => {
      const count = getWaypointCount();
      if (!isWaypointSlotEnabled(count, slot)) return;
      onSelectPoint("waypoint", lngLat, slot);
      closePopup();
    };
    wpButtons.push(wpBtn);
  }

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "map-view__pick-btn map-view__pick-btn--end";
  endBtn.textContent = "End";
  endBtn.title = "Set as end";
  endBtn.setAttribute("aria-label", "Set end");
  endBtn.onclick = () => {
    onSelectPoint("end", lngLat);
    pins.end = true;
    if (!pins.start) closePopup();
    else syncProfileUi();
  };

  pinRow.append(startBtn, wpButtons[0]!, wpButtons[1]!, wpButtons[2]!, endBtn);

  const profileSection = document.createElement("div");
  profileSection.className = "map-view__pick-profile-section";

  const profileHeader = document.createElement("div");
  profileHeader.className = "map-view__pick-profile-header";

  const profileLabel = document.createElement("p");
  profileLabel.className = "map-view__pick-profile-label";
  profileLabel.id = "map-view-pick-profile-label";
  profileLabel.textContent = "경로 탐색 유형 선택";

  if (typeof onClearRoute === "function") {
    const clearRouteBtn = document.createElement("button");
    clearRouteBtn.type = "button";
    clearRouteBtn.className = "map-view__pick-btn map-view__pick-btn--clear-route";
    clearRouteBtn.textContent = "경로 삭제";
    clearRouteBtn.title = "Clear route";
    clearRouteBtn.setAttribute("aria-label", "경로 전체 삭제");
    clearRouteBtn.onclick = () => {
      onClearRoute();
      pins.start = false;
      pins.end = false;
      closePopup();
    };
    profileHeader.append(profileLabel, clearRouteBtn);
  } else {
    profileHeader.appendChild(profileLabel);
  }

  const rowProfile = document.createElement("div");
  rowProfile.className = "map-view__pick-actions map-view__pick-actions--profile";
  rowProfile.setAttribute("role", "group");
  rowProfile.setAttribute("aria-labelledby", "map-view-pick-profile-label");

  const profileSpecs: { profile: RouteProfile; ariaLabelKo: string }[] = [
    { profile: "driving", ariaLabelKo: "자동차 경로" },
    { profile: "cycling", ariaLabelKo: "자전거 경로" },
    { profile: "walking", ariaLabelKo: "보행 경로" },
  ];

  const profileButtons: HTMLButtonElement[] = [];
  for (const { profile, ariaLabelKo } of profileSpecs) {
    const pb = document.createElement("button");
    pb.type = "button";
    pb.className = "map-view__pick-btn map-view__pick-btn--profile";
    if (profile === routeProfile) pb.classList.add("is-active");
    pb.innerHTML = PICK_POPUP_PROFILE_ICON_SVG[profile];
    pb.title =
      profile === "driving" ? "Route by car" : profile === "walking" ? "Route on foot" : "Route by bike";
    pb.setAttribute("aria-label", ariaLabelKo);
    pb.onclick = () => {
      if (!pins.start || !pins.end) return;
      onRouteProfile(profile);
      closePopup();
    };
    profileButtons.push(pb);
    rowProfile.appendChild(pb);
  }

  function syncProfileUi() {
    const ready = pins.start && pins.end;
    if (typeof onClearRoute === "function") {
      profileSection.hidden = false;
      rowProfile.hidden = !ready;
    } else {
      profileSection.hidden = !ready;
      rowProfile.hidden = false;
    }
    wrap.classList.toggle("map-view__pick--awaiting-profile", ready);
    if (!ready) return;
    profileSpecs.forEach((spec, i) => {
      const pb = profileButtons[i];
      if (!pb) return;
      pb.title =
        spec.profile === "driving"
          ? "Route by car"
          : spec.profile === "walking"
            ? "Route on foot"
            : "Route by bike";
    });
  }

  profileSection.append(profileHeader, rowProfile);
  syncProfileUi();

  wrap.append(addressEl, metaEl, pinRow, profileSection);

  const token = accessToken.trim();
  if (token.length > 0) {
    void (async () => {
      try {
        const [place, elevM] = await Promise.all([
          fetchMapboxReverseGeocodePlaceName(lngLat, token, signal),
          fetchPointElevationMeters(lngLat, signal),
        ]);
        if (signal.aborted) return;
        addressEl.textContent = place ?? "주소를 찾을 수 없습니다";
        const elevLabel =
          elevM != null && Number.isFinite(elevM) ? `${Math.round(elevM)}m` : "—";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 ${elevLabel}`;
      } catch {
        if (signal.aborted) return;
        addressEl.textContent = "주소를 불러오지 못했습니다";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 —`;
      }
    })();
  } else {
    addressEl.textContent = "지도 토큰이 없어 주소를 표시할 수 없습니다";
    void (async () => {
      try {
        const elevM = await fetchPointElevationMeters(lngLat, signal);
        if (signal.aborted) return;
        const elevLabel =
          elevM != null && Number.isFinite(elevM) ? `${Math.round(elevM)}m` : "—";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 ${elevLabel}`;
      } catch {
        if (signal.aborted) return;
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 —`;
      }
    })();
  }

  return wrap;
}

function getCameraForFollowMode(input: {
  mode: FollowMode;
  baseHeading: number;
  currentPitch: number;
  enable3D: boolean;
}) {
  const pitch3DRear = 70;
  const pitch3DFront = 60;
  const pitch3DSide = 85;
  const sidePitch = input.enable3D ? pitch3DSide : input.currentPitch;
  const frontPitch = input.enable3D ? pitch3DFront : input.currentPitch;
  const rearPitch = input.enable3D ? pitch3DRear : input.currentPitch;

  if (input.mode === "north") {
    return { bearing: 0, pitch: input.currentPitch };
  }
  if (input.mode === "rear30") {
    return { bearing: normalizeCompass(input.baseHeading), pitch: rearPitch };
  }
  if (input.mode === "front30") {
    return { bearing: normalizeCompass(input.baseHeading + 180), pitch: frontPitch };
  }
  if (input.mode === "rightFlat") {
    return { bearing: normalizeCompass(input.baseHeading + 90), pitch: sidePitch };
  }
  if (input.mode === "leftFlat") {
    return { bearing: normalizeCompass(input.baseHeading + 270), pitch: sidePitch };
  }
  return { bearing: normalizeCompass(input.baseHeading), pitch: input.currentPitch };
}

function normalizeCompass(deg: number) {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

function rearFollowOffsetMeters(zoom: number): number {
  const t = clamp((zoom - 12) / 10, 0, 1);
  return lerp(REAR_FOLLOW_OFFSET_M_MAX, REAR_FOLLOW_OFFSET_M_MIN, t);
}

/** bearing 방향으로 distanceM 이동한 좌표 (구면 근사) */
function offsetLngLatByBearingMeters(origin: LngLat, bearingDeg: number, distanceMeters: number): LngLat {
  if (distanceMeters <= 0) return origin;
  const earthRadiusM = 6378137;
  const bearingRad = (normalizeCompass(bearingDeg) * Math.PI) / 180;
  const latRad = (origin[1] * Math.PI) / 180;
  const lngRad = (origin[0] * Math.PI) / 180;
  const angDist = distanceMeters / earthRadiusM;
  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearingRad),
  );
  const lng2 =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat2),
    );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function getAverageHeadingAheadFromPoint(
  geometry: RouteLineStringGeometry | null,
  point: LngLat,
  windowMeters: number,
  samples: number,
): number | null {
  if (!geometry || geometry.coordinates.length < 2) return null;
  const currentDistance = getDistanceOnRouteByProjectedPoint(geometry.coordinates, point);
  if (currentDistance == null) return headingOnRouteAtPoint(geometry, point);
  if (windowMeters <= 0 || samples <= 0) {
    return getHeadingByRouteDistance(geometry.coordinates, currentDistance);
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 1; i <= samples; i += 1) {
    const ahead = getHeadingByRouteDistance(
      geometry.coordinates,
      currentDistance + (windowMeters * i) / samples,
    );
    if (ahead == null) continue;
    const rad = (ahead * Math.PI) / 180;
    sumX += Math.cos(rad);
    sumY += Math.sin(rad);
  }
  if (sumX === 0 && sumY === 0) return null;
  let deg = (Math.atan2(sumY, sumX) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function getHeadingByRouteDistance(coords: LngLat[], routeDistanceMeters: number): number | null {
  if (coords.length < 2) return null;
  let idx = 0;
  let remain = Math.max(0, routeDistanceMeters);
  while (idx < coords.length - 1) {
    const seg = getDistanceMeters(coords[idx], coords[idx + 1]);
    if (seg <= 0) {
      idx += 1;
      continue;
    }
    if (remain <= seg) return getBearing(coords[idx], coords[idx + 1]);
    remain -= seg;
    idx += 1;
  }
  return getBearing(coords[coords.length - 2], coords[coords.length - 1]);
}

function getDistanceOnRouteByProjectedPoint(coords: LngLat[], point: LngLat): number | null {
  if (coords.length < 2) return null;
  let cumulative = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = getDistanceMeters(a, b);
    if (segLen <= 0) continue;

    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = point[0] - a[0];
    const apy = point[1] - a[1];
    const denom = abx * abx + aby * aby;
    const rawT = denom > 0 ? (apx * abx + apy * aby) / denom : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected: LngLat = [a[0] + abx * t, a[1] + aby * t];
    const d = getDistanceMeters(projected, point);
    if (d < bestDistance) {
      bestDistance = d;
      bestRouteDistance = cumulative + segLen * t;
    }
    cumulative += segLen;
  }
  return bestRouteDistance;
}

function resetCameraSmoothing(
  state: {
    center: LngLat | null;
    bearingPrimary: number | null;
    bearing: number | null;
    pitch: number | null;
    zoom: number | null;
    lastTs: number | null;
  },
  map: mapboxgl.Map,
) {
  const c = map.getCenter();
  state.center = [c.lng, c.lat];
  state.bearing = map.getBearing();
  state.bearingPrimary = map.getBearing();
  state.pitch = map.getPitch();
  state.zoom = map.getZoom();
  state.lastTs = null;
}

/** 팔로우 모드 카메라 — rAF 매 프레임 (React liveLngLat 200ms throttle 우회) */
function shouldSyncMapZoomToApp(
  session: LiveRiderMotion["sessionStatus"] | undefined,
  followMode: FollowMode,
): boolean {
  return !((session === "running" || session === "paused") && followMode !== "free");
}

function tickRideCameraFollow(
  map: mapboxgl.Map,
  targetLngLat: LngLat,
  opts: {
    followMode: FollowMode;
    enable3D: boolean;
    mapZoom: number;
    sessionStatus?: LiveRiderMotion["sessionStatus"];
    routeGeometry: LineStringGeometry | null;
    prevLiveRef: { current: LngLat | null };
    smooth: {
      center: LngLat | null;
      bearingPrimary: number | null;
      bearing: number | null;
      pitch: number | null;
      zoom: number | null;
      lastTs: number | null;
    };
    suppressUntilMs: number;
    nowMs: number;
  },
): void {
  if (opts.nowMs < opts.suppressUntilMs) return;

  if (opts.followMode === "free") {
    opts.prevLiveRef.current = targetLngLat;
    return;
  }

  const rideActive = opts.sessionStatus === "running" || opts.sessionStatus === "paused";
  const followZoom =
    rideActive && opts.followMode === "rear30"
      ? RIDE_FOLLOW_CAMERA_ZOOM
      : opts.mapZoom;

  const prev = opts.prevLiveRef.current;
  const headingFromMove =
    prev && getDistanceMeters(prev, targetLngLat) >= 2 ? getBearing(prev, targetLngLat) : null;
  const headingFromRoute = getAverageHeadingAheadFromPoint(
    opts.routeGeometry,
    targetLngLat,
    CAMERA_BEARING_WINDOW_METERS,
    CAMERA_BEARING_WINDOW_SAMPLES,
  );
  const baseHeading = headingFromMove ?? headingFromRoute ?? map.getBearing();
  const nextCamera = getCameraForFollowMode({
    mode: opts.followMode,
    baseHeading,
    currentPitch: map.getPitch(),
    enable3D: opts.enable3D,
  });

  const cameraCenterTarget =
    opts.followMode === "rear30"
      ? offsetLngLatByBearingMeters(
          targetLngLat,
          nextCamera.bearing + 180,
          rearFollowOffsetMeters(followZoom),
        )
      : targetLngLat;

  opts.prevLiveRef.current = targetLngLat;
  const smooth = opts.smooth;
  if (
    !smooth.center ||
    smooth.bearing == null ||
    smooth.bearingPrimary == null ||
    smooth.pitch == null ||
    smooth.zoom == null
  ) {
    resetCameraSmoothing(smooth, map);
  }

  const dtMs = smooth.lastTs == null ? 0 : opts.nowMs - smooth.lastTs;
  smooth.lastTs = opts.nowMs;
  const dtSec = clamp(dtMs, 0, CAMERA_MAX_DT_MS) / 1000;
  const alphaPos = dampAlpha(dtSec, CAMERA_POSITION_TAU_SEC);
  const alphaBearingPrimary = dampAlpha(dtSec, CAMERA_BEARING_TAU_PRIMARY_SEC);
  const alphaBearingSecondary = dampAlpha(dtSec, CAMERA_BEARING_TAU_SECONDARY_SEC);
  const maxStepPrimary = CAMERA_BEARING_MAX_DPS_PRIMARY * dtSec;
  const maxStepSecondary = CAMERA_BEARING_MAX_DPS_SECONDARY * dtSec;

  const curCenter = smooth.center ?? cameraCenterTarget;
  const curPitch = smooth.pitch ?? map.getPitch();
  const curZoom = smooth.zoom ?? map.getZoom();
  const curBearingPrimary = smooth.bearingPrimary ?? map.getBearing();
  const curBearing = smooth.bearing ?? map.getBearing();

  const nextCenter: LngLat = [
    lerp(curCenter[0], cameraCenterTarget[0], alphaPos),
    lerp(curCenter[1], cameraCenterTarget[1], alphaPos),
  ];
  const nextPitch = lerp(curPitch, nextCamera.pitch, alphaPos);
  const nextZoom = lerp(curZoom, followZoom, alphaPos);
  const nextBearingPrimary = lerpAngle(
    curBearingPrimary,
    nextCamera.bearing,
    alphaBearingPrimary,
    maxStepPrimary,
  );
  const nextBearing = lerpAngle(
    curBearing,
    nextBearingPrimary,
    alphaBearingSecondary,
    maxStepSecondary,
  );

  smooth.center = nextCenter;
  smooth.pitch = nextPitch;
  smooth.zoom = nextZoom;
  smooth.bearingPrimary = nextBearingPrimary;
  smooth.bearing = nextBearing;

  map.stop();
  map.jumpTo({
    center: nextCenter,
    bearing: nextBearing,
    pitch: nextPitch,
    zoom: nextZoom,
  });
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalizeAngle(angle: number) {
  let n = angle % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
}

function shortestAngleDelta(from: number, to: number) {
  return normalizeAngle(to - from);
}

function lerpAngle(from: number, to: number, t: number, maxStep: number) {
  const delta = shortestAngleDelta(from, to);
  const stepped = clamp(delta * t, -maxStep, maxStep);
  return normalizeAngle(from + stepped);
}

function dampAlpha(dtSec: number, tauSec: number) {
  if (tauSec <= 0 || dtSec <= 0) return 0;
  return 1 - Math.exp(-dtSec / tauSec);
}

function getBearing(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function apply3DState(
  map: mapboxgl.Map,
  enabled: boolean,
  buildingLayerId: string,
  terrainSourceId: string,
) {
  if (!enabled) {
    map.setTerrain(null);
    if (map.getLayer(buildingLayerId)) map.removeLayer(buildingLayerId);
    map.easeTo({ pitch: 0, duration: 400 });
    return;
  }

  if (!map.getSource(terrainSourceId)) {
    map.addSource(terrainSourceId, {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: terrainSourceId, exaggeration: 1.3 });
  if (!map.getLayer(buildingLayerId)) {
    const layers = map.getStyle().layers ?? [];
    const symbolLayer = layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"]);
    map.addLayer(
      {
        id: buildingLayerId,
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#cbd5e1",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.65,
        },
      },
      symbolLayer?.id,
    );
  }
  if (map.getPitch() < 35) {
    map.easeTo({ pitch: 60, bearing: map.getBearing(), duration: 450 });
  }
}

/** 짧은 코스에서 세로 “자동 맞춤”만으로 고도 잡음이 과대 표시되는 것을 줄이기 위한 상한(m). */
const ELEV_CHART_SHORT_ROUTE_MAX_M = 10_000;
/** 전장 대비 세로 최소 표시 고도폭: 전장의 약 1.1%를 한 번에 쓰는 구간으로 본다(도심 완만 구간 완화). */
const ELEV_CHART_VERT_FLOOR_PER_ROUTE_M = 0.011;
/** 최소 표시 고도폭 하한(m): 아주 짧은 구간에서도 극단 과장 방지 */
const ELEV_CHART_VERT_FLOOR_MIN_M = 12;

/**
 * 고도 차트 세로 스케일.
 * - 10km 초과: 데이터 최소~최대를 세로에 맞춤(기존과 동일).
 * - 10km 이하: `max(데이터폭, 거리기반 바닥폭)`으로 세로 범위를 넓혀, 작은 편차가 그래프 높이를 덜 잡아먹게 함(중심 정렬).
 */
function buildElevationUi(
  values: number[],
  progressRatio: number | null,
  routeLengthMeters: number,
) {
  const width = 420;
  const height = 100;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const dataSpan = Math.max(max - min, 1);
  const mid = (min + max) / 2;
  let dispMin = min;
  let range = dataSpan;
  if (
    routeLengthMeters > 0 &&
    routeLengthMeters <= ELEV_CHART_SHORT_ROUTE_MAX_M &&
    Number.isFinite(routeLengthMeters)
  ) {
    const floorSpan = Math.max(
      ELEV_CHART_VERT_FLOOR_MIN_M,
      routeLengthMeters * ELEV_CHART_VERT_FLOOR_PER_ROUTE_M,
    );
    range = Math.max(dataSpan, floorSpan);
    dispMin = mid - range / 2;
  }
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - dispMin) / range) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  let marker: { x: string; y: string } | null = null;
  if (progressRatio != null && Number.isFinite(progressRatio)) {
    const clamped = Math.max(0, Math.min(1, progressRatio));
    const markerIdx = clamped * (values.length - 1);
    const lowerIdx = Math.floor(markerIdx);
    const upperIdx = Math.min(values.length - 1, lowerIdx + 1);
    const t = markerIdx - lowerIdx;
    const xLower = pad + (lowerIdx / (values.length - 1)) * (width - pad * 2);
    const xUpper = pad + (upperIdx / (values.length - 1)) * (width - pad * 2);
    const yLower = height - pad - ((values[lowerIdx] - dispMin) / range) * (height - pad * 2);
    const yUpper = height - pad - ((values[upperIdx] - dispMin) / range) * (height - pad * 2);
    marker = {
      x: (xLower + (xUpper - xLower) * t).toFixed(2),
      y: (yLower + (yUpper - yLower) * t).toFixed(2),
    };
  }
  return {
    polylinePoints: points.join(" "),
    startMeters: values[0],
    endMeters: values[values.length - 1],
    marker,
  };
}

function getProgressRatioOnRoute(
  routeGeometry: LineStringGeometry | null,
  liveLngLat: LngLat | null,
): number | null {
  if (!routeGeometry || routeGeometry.coordinates.length < 2 || !liveLngLat) return null;
  const coords = routeGeometry.coordinates;
  let total = 0;
  let closestIdx = 0;
  let closestDist = Number.POSITIVE_INFINITY;
  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    total += getDistanceMeters(coords[i - 1], coords[i]);
    cumulative.push(total);
  }
  if (total <= 0) return null;
  for (let i = 0; i < coords.length; i += 1) {
    const d = getDistanceMeters(coords[i], liveLngLat);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  return cumulative[closestIdx] / total;
}
