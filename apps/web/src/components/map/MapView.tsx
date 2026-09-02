/* eslint-disable react-hooks/refs */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { DISTANCE_AUTO_ROUTE_REFERENCE_CIRCLE_HINT } from "../../lib/distanceAutoRoute";
import {
  DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
  DISTANCE_AUTO_ROUTE_KM_STEP,
  DISTANCE_AUTO_ROUTE_REROUTE_HINT,
  DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA,
  DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL,
  validateDistanceAutoRouteTargetKm,
} from "../../lib/distanceAutoRouteErrors";
import {
  getDistanceAutoRouteMapBridge,
  registerDistanceAutoRouteClickDebugMarkerClear,
} from "../../lib/distanceAutoRouteMapBridge";
import {
  createDistanceAutoRouteClickDebugMarkerElement,
  isDistanceAutoRouteClickDebugEnabled,
  updateDistanceAutoRouteClickDebugMarkerElement,
} from "../../lib/distanceAutoRouteClickDebugMarker";
import {
  buildRoutePickDockFocus,
  clampRoutePickDockPosition,
  collectRoutePickDockReservedRects,
  mapLngLatToContainerPoint,
  mountRoutePickDockDrag,
  pickRoutePickDockPosition,
  toCanvasLocalRect,
  viewportRectFromElement,
} from "../../lib/mapPickRouteDock";
import {
  applyRtwLayerStyle,
  resetRtwStyleSnapshot,
  RTW_MAP_STYLE_URL,
  RTW_TRACE_ACCUMULATED_PAINT,
  RTW_TRACE_LIVE_GLOW_PAINT,
  RTW_TRACE_LIVE_PAINT,
} from "../../lib/rtwMapConfig";
import {
  shouldMoveActivityWorldLayersToTop,
  shouldSkipLiveOverlaysOnMap,
} from "../../lib/mapDebugPhase";
import {
  noteLodScheduleEmit,
  noteLodScheduleEnter,
  noteMapEvent,
  noteMoveToTopMs,
  notePathBInterval,
  noteRafFrame,
  noteSyncActivityMs,
  isFollowCameraJump,
} from "../../lib/mapTickProbe";
import { installCameraRenderPhaseHook } from "../../lib/cameraRenderPhase";
import { applyTickTestToMap, getTickTestOffList, installTickTestMapHooks, subscribeTickTest } from "../../lib/tickTestSwitches";
import type { LngLat, LineStringGeometry } from "../../lib/geo";
import {
  boundsFromLineCoordinates,
  getDistanceMeters,
  lineStringLengthMeters,
  resolveRiderBearingDeg,
} from "../../lib/geo";
import { splitLineStringAtMeters } from "../../lib/routeProgressSplit";
import type { RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import type { FollowMode } from "../ride/RideRoutePanel";
import {
  getRouteTokenInsufficient as isRouteTokenBlocked,
  subscribeRouteTokenEffective,
} from "../../lib/routeTokenSpendBridge";
import { mountRouteTokenPopupFeedback } from "../../lib/mountRouteTokenPopupFeedback";
import { ROUTE_TOKEN_INSUFFICIENT_HINT } from "../../lib/routeTokenUiCopy";
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
  type RiderGlbModelSpec,
} from "../../lib/riderPrototype/iso2dMarker";
import { clearRiderGlbModels, ensureRiderGlbLayer, syncRiderGlbModels } from "../../lib/riderPrototype/glbModelLayer";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "../../lib/registerPeerRiderPedalSprites";
import { MapZoomGlobeControl } from "./MapZoomGlobeControl";
import {
  MAP_GLOBE_MIN_ZOOM,
  DEFAULT_MAP_ZOOM,
  RIDE_FOLLOW_CAMERA_MODE,
  RIDE_CAMERA_DISTANCE_DEFAULT_M,
  RIDE_CAMERA_DISTANCE_MIN_M,
  RIDE_CAMERA_DISTANCE_MAX_M,
} from "../../lib/mapGlobeView";
import {
  computeRideFollowFraming,
  measureRiderScreenDiag,
  publishRiderScreenDiag,
  RIDE_HUD_SAFE_PADDING,
  viewportPxFromMap,
} from "../../lib/rideCameraFraming";
import { type LiveRiderMotion } from "./mapViewTypes";
import {
  tickRideCameraFollow,
  getCameraForFollowMode,
  resetCameraSmoothing,
  shouldSyncMapZoomToApp,
  getBearing,
  apply3DState,
  getAverageHeadingAheadFromPoint,
  CAMERA_BEARING_WINDOW_METERS,
  CAMERA_BEARING_WINDOW_SAMPLES,
} from "./rideCameraFollow";
import { buildElevationUi, getProgressRatioOnRoute } from "./mapElevationUi";
import { TickTestOffBadge } from "./TickTestOffBadge";
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

/** Conquest — 「내 도로망」(과거 주행 궤적, 경로선 아래) */
const CONQUEST_TRACES_SRC = "boxcycle-conquest-traces";
const CONQUEST_TRACES_LAYER = "boxcycle-conquest-traces-line";
/** Conquest — 이번 주행에서 지금까지 달린 구간(실시간 칠하기) */
const CONQUEST_LIVE_SRC = "boxcycle-conquest-live";
const CONQUEST_LIVE_LAYER = "boxcycle-conquest-live-line";
const CONQUEST_LIVE_GLOW_LAYER = "boxcycle-conquest-live-glow";

/**
 * 궤적 레이어를 경로선 **위**로 올려 고정한다.
 *
 * 「내 도로망」을 경로선 아래에 두면(이전 동작) 이미 내 것인 도로 위를 다시 달릴 때
 * 강한 빨강(#ef4444)에 덮여 어떤 색을 써도 드러나지 않는다. 레이어 추가 순서는
 * 경로 로드 시점에 따라 뒤집히므로 매 적용마다 다시 세운다.
 *
 * 최종 순서: route < 누적(내 도로망) < live glow < live(이번 주행)
 */
function orderConquestLayersAboveRoute(map: mapboxgl.Map): void {
  try {
    const ids = (map.getStyle()?.layers ?? []).map((l) => l.id);
    const routeIdx = ids.indexOf("route");
    if (routeIdx < 0) return;
    const ours = new Set([CONQUEST_TRACES_LAYER, CONQUEST_LIVE_GLOW_LAYER, CONQUEST_LIVE_LAYER]);
    const afterRoute = ids.slice(routeIdx + 1).find((id) => !ours.has(id));
    for (const id of [CONQUEST_TRACES_LAYER, CONQUEST_LIVE_GLOW_LAYER, CONQUEST_LIVE_LAYER]) {
      if (map.getLayer(id)) map.moveLayer(id, afterRoute);
    }
  } catch {
    /* noop */
  }
}

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
function moveActivityWorldLayersToTop(map: mapboxgl.Map): void {
  const sig = activityWorldLayerSignature(map);
  if (sig === lastActivityWorldLayerSigByMap.get(map)) return;
  const t0 = performance.now();
  for (const id of ACTIVITY_WORLD_LAYER_IDS) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch {
        /* style switching */
      }
    }
  }
  lastActivityWorldLayerSigByMap.set(map, activityWorldLayerSignature(map));
  noteMoveToTopMs(performance.now() - t0);
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
const DEFAULT_ZOOM = DEFAULT_MAP_ZOOM;
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
  if (RIDER_PROTOTYPE_MODE === "glb" && ensureRiderGlbLayer(map)) {
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


export type { LiveRiderMotion } from "./mapViewTypes";

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
  /** Route Token 부족(잔액<1) — 팝업 수단 버튼을 비활성해 생성을 막음(RouteDock와 동일 정책) */
  routeTokenInsufficient?: boolean;
  /** Conquest — 「내 도로망」 궤적(과거 주행). null=미로그인/로딩 전 */
  conquestTraces?: readonly LineStringGeometry[] | null;
  /** Conquest — 이번 주행 진행 거리(m). 진행 구간을 실시간으로 칠한다. null=비주행 */
  conquestLiveTraveledMeters?: number | null;
  /** 핀 팝업 도로 상태 한 줄(「내가 달린 도로」 등). null=비표시 */
  onLookupPioneer?: (lngLat: LngLat) => Promise<string | null>;
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
  /** anchor 이어 달리기 — 지도 Route pick dock 을 프로그램matic 으로 연다 */
  openRoutePickRequest?: {
    lngLat: LngLat;
    requestId: number;
  } | null;
  /** 메뉴 장소 검색으로 이동한 위치 — 기본 핀과 구분되는 마커 */
  placeSearchMarkerLngLat?: LngLat | null;
  /**
   * 이어 달리기 재개점(§3.4) — 「31% · 여기서 계속」 단일 마커. null=표시 없음.
   * 주행 전(idle) 재개 준비 상태에서만 넘어온다.
   */
  resumeAnchor?: { lngLat: LngLat; label: string } | null;
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
  /** RTW Dark 한정 — 주행 중 도로 유령화·건물 숨김 해제 */
  rideActive?: boolean;
  /** 주행 카메라 라이더~카메라 거리(m) — 개발용 거리 슬라이더, 최적값 확정 후 제거 예정 */
  rideCameraDistanceM?: number;
  /** 임시 — RTW Dark POI 라벨 표시 비교용 토글 */
  showRtwPoi?: boolean;
  /** 목표 거리 참고 원 — GeoJSON LineString(지도 stroke용) */
  distanceTargetCircle?: LineStringGeometry | null;
  /** 원 bounds fitBounds — 사용자가 자동 찾기·거리 변경할 때만 증가 */
  distanceTargetCircleFitToken?: number;
  /** offered 결과: 클릭 지점(고스트)·도달 거리 표시용 */
  autoRouteOfferedState?: {
    clickLngLat: LngLat;
    directKm: number;
    targetKm: number;
  } | null;
  /** offered 거리 조정 재탐색 버튼 클릭 핸들러 */
  onDistanceAdjustRetry?: () => void;
  /** 자동 경로 마법사 중 지도 탭 가로채기 */
  autoRouteMapPick?: "start" | "direction" | null;
  /** 자동 Route 세션 — End 존재와 별도로 단일 설정창 유지 */
  autoRouteSessionActive?: boolean;
  autoRouteTargetKm?: number;
  autoRouteStatusMessage?: string | null;
  onSuspendAutoRoutePopupPick?: () => void;
  /** 자동 찾기 펼침·거리 preset — provider/Token 없이 원만 미리보기 */
  onPreviewDistanceAutoRouteCircle?: (input: {
    start: LngLat;
    targetKm: number;
  }) => void;
  onClearDistanceAutoRouteCircle?: () => void;
  /** End 없을 때 이동수단 선택만(경로 생성·Token 차감 없음) */
  onSetRouteProfileOnly?: (p: RouteProfile) => void;
  /** 기본 지점 선택 popup — 목표거리 조작 시 방향 선택 모드 진입 */
  onArmDirectionPick?: (input: {
    start: LngLat;
    profile: RouteProfile;
    targetKm: number;
  }) => { ok: true } | { ok: false; message: string };
  onAutoRouteMapPick?: (
    lngLat: LngLat,
  ) => Promise<
    | {
        status: "found" | "failed";
        message: string;
        offered?: { adjustLabel: string };
      }
    | null
  >;
  onRetryDistanceAutoRoute?: () => void;
  onDismissDistanceAutoRoute?: () => void;
};

function clearAutoRouteClickDebugMarkerOnMap(
  markerRef: { current: mapboxgl.Marker | null },
): void {
  markerRef.current?.remove();
  markerRef.current = null;
}

function placeAutoRouteClickDebugMarkerOnMap(
  map: mapboxgl.Map,
  markerRef: { current: mapboxgl.Marker | null },
  lngLat: LngLat,
): void {
  if (!isDistanceAutoRouteClickDebugEnabled()) {
    clearAutoRouteClickDebugMarkerOnMap(markerRef);
    return;
  }
  if (markerRef.current) {
    markerRef.current.setLngLat(lngLat);
    updateDistanceAutoRouteClickDebugMarkerElement(markerRef.current.getElement(), lngLat);
    return;
  }
  const element = createDistanceAutoRouteClickDebugMarkerElement(lngLat);
  markerRef.current = new mapboxgl.Marker({
    element,
    anchor: "center",
    className: "map-view__auto-route-click-debug-marker-host",
  })
    .setLngLat(lngLat)
    .addTo(map);
}

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
  mapStyle,
  mapZoom,
  followMode,
  enable3D,
  onMapZoom,
  onSelectPoint,
  routeProfile,
  onRouteProfile,
  routeTokenInsufficient = false,
  conquestTraces = null,
  conquestLiveTraveledMeters = null,
  onLookupPioneer,
  onClearRoute,
  coverageOverlayMode,
  mapillaryClientToken,
  externalCameraJump = null,
  openRoutePickRequest = null,
  placeSearchMarkerLngLat = null,
  resumeAnchor = null,
  trailSpectatorDots = null,
  trailSpectatorRoutes = null,
  globalPresenceDots = null,
  activityWorldRaw = null,
  getActivityWorldPinLabel = null,
  onMapViewport,
  onMapLodViewport,
  rideFollowCameraNonce = 0,
  rideActive = false,
  rideCameraDistanceM = RIDE_CAMERA_DISTANCE_DEFAULT_M,
  showRtwPoi = false,
  distanceTargetCircle = null,
  distanceTargetCircleFitToken = 0,
  autoRouteOfferedState = null,
  onDistanceAdjustRetry,
  autoRouteMapPick = null,
  autoRouteSessionActive = false,
  autoRouteTargetKm = 10,
  autoRouteStatusMessage = null,
  onSuspendAutoRoutePopupPick,
  onPreviewDistanceAutoRouteCircle,
  onClearDistanceAutoRouteCircle,
  onSetRouteProfileOnly,
  onArmDirectionPick,
  onAutoRouteMapPick,
  onRetryDistanceAutoRoute,
  onDismissDistanceAutoRoute,
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
    const t0 = performance.now();
    const raw = activityWorldRawRef.current;
    syncCourseActivityLayers(map, raw.pulseRoutes, raw.heatRoutes);
    syncWorldHeatDots(map, raw.heatDots);
    syncWorldRedDots(map, raw.pulseDots);
    moveActivityWorldLayersToTop(map);
    noteSyncActivityMs(performance.now() - t0);
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  /** props `mapZoom` → `map.zoomTo` 적용을 한 프레임으로 묶어 연속 onChange·리렌더 떨림 완화 */
  const mapZoomApplyRafRef = useRef<number | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const autoRouteClickDebugMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const placeSearchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resumeMarkerRef = useRef<mapboxgl.Marker | null>(null);
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
  const mapShellRef = useRef<HTMLDivElement>(null);
  const routePickDockLayerRef = useRef<HTMLDivElement>(null);
  const routePickDockPositionRef = useRef<{ left: number; top: number } | null>(null);
  const routePickDockDragCleanupRef = useRef<(() => void) | null>(null);
  const routePickDockResizeHandlerRef = useRef<(() => void) | null>(null);
  const routePickDockDraggingRef = useRef(false);
  const routePickDockPanelRef = useRef<HTMLDivElement | null>(null);
  const openRoutePickAtRef = useRef<((lngLat: LngLat) => void) | null>(null);
  const routeGeometryRef = useRef<LineStringGeometry | null>(null);
  const routeDistanceMetersRef = useRef(routeDistanceMeters);
  const liveLngLatRef = useRef<LngLat | null>(null);
  const sampleLiveLngLatRef = useRef(sampleLiveLngLat);
  const liveRiderMotionRef = useRef(liveRiderMotion);
  const followModeRef = useRef(followMode);
  const mapZoomRef = useRef(mapZoom);
  /** 주행 카메라 거리(m) — 개발용 거리 슬라이더 최신값, rAF 루프에서 참조 */
  const rideCameraDistanceMRef = useRef(rideCameraDistanceM);
  const prefersReducedMotionRef = useRef(false);
  const enable3DRef = useRef(enable3D);
  /** GLB 코너링 린 — 직전 heading·지수 감쇠 린(°) */
  const glbPrevBearingRef = useRef<number | null>(null);
  const glbLeanDegRef = useRef(0);
  const initialMapStyleRef = useRef(mapStyle);
  const currentStyleRef = useRef(mapStyle);
  const onSelectPointRef = useRef(onSelectPoint);
  const routeWaypointsRef = useRef(routeWaypoints);
  const startLngLatRef = useRef(startLngLat);
  const endLngLatRef = useRef(endLngLat);
  const routeProfileRef = useRef(routeProfile);
  const onRouteProfileRef = useRef(onRouteProfile);
  const routeTokenInsufficientRef = useRef(routeTokenInsufficient);
  const onLookupPioneerRef = useRef(onLookupPioneer);
  const onClearRouteRef = useRef(onClearRoute);
  const onArmDirectionPickRef = useRef(onArmDirectionPick);
  const pickPopupAutoRouteUiRef = useRef<PickPopupAutoRouteUi | null>(null);
  const onPreviewDistanceAutoRouteCircleRef = useRef(onPreviewDistanceAutoRouteCircle);
  const onClearDistanceAutoRouteCircleRef = useRef(onClearDistanceAutoRouteCircle);
  const onSetRouteProfileOnlyRef = useRef(onSetRouteProfileOnly);
  const onAutoRouteMapPickRef = useRef(onAutoRouteMapPick);
  const onRetryDistanceAutoRouteRef = useRef(onRetryDistanceAutoRoute);
  const onDistanceAdjustRetryRef = useRef(onDistanceAdjustRetry);
  const onDismissDistanceAutoRouteRef = useRef(onDismissDistanceAutoRoute);
  const autoRouteMapPickRef = useRef(autoRouteMapPick);
  const autoRouteSessionActiveRef = useRef(autoRouteSessionActive);
  const autoRouteTargetKmRef = useRef(autoRouteTargetKm);
  const autoRouteStatusMessageRef = useRef(autoRouteStatusMessage);
  const onSuspendAutoRoutePopupPickRef = useRef(onSuspendAutoRoutePopupPick);
  const autoRouteSearchBusyRef = useRef(false);
  const placeAutoRouteClickDebugMarkerRef = useRef<(lngLat: LngLat) => void>(() => {});
  const clearAutoRouteClickDebugMarkerRef = useRef<() => void>(() => {});
  const prevStartLngLatKeyRef = useRef<string | null>(null);
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
    const q = Number(new URLSearchParams(window.location.search).get("rideCam"));
    const fromQuery =
      Number.isFinite(q) && q >= RIDE_CAMERA_DISTANCE_MIN_M && q <= RIDE_CAMERA_DISTANCE_MAX_M
        ? q
        : null;
    rideCameraDistanceMRef.current = fromQuery ?? rideCameraDistanceM;
  }, [rideCameraDistanceM]);

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
    routeTokenInsufficientRef.current = routeTokenInsufficient;
  }, [routeTokenInsufficient]);

  useEffect(() => {
    onLookupPioneerRef.current = onLookupPioneer;
  }, [onLookupPioneer]);

  useEffect(() => {
    onRouteProfileRef.current = onRouteProfile;
  }, [onRouteProfile]);

  useEffect(() => {
    onClearRouteRef.current = onClearRoute;
  }, [onClearRoute]);

  useEffect(() => {
    onArmDirectionPickRef.current = onArmDirectionPick;
  }, [onArmDirectionPick]);

  useEffect(() => {
    onPreviewDistanceAutoRouteCircleRef.current = onPreviewDistanceAutoRouteCircle;
  }, [onPreviewDistanceAutoRouteCircle]);

  useEffect(() => {
    onClearDistanceAutoRouteCircleRef.current = onClearDistanceAutoRouteCircle;
  }, [onClearDistanceAutoRouteCircle]);

  useEffect(() => {
    onSetRouteProfileOnlyRef.current = onSetRouteProfileOnly;
  }, [onSetRouteProfileOnly]);

  useEffect(() => {
    onAutoRouteMapPickRef.current = onAutoRouteMapPick;
  }, [onAutoRouteMapPick]);

  useEffect(() => {
    onRetryDistanceAutoRouteRef.current = onRetryDistanceAutoRoute;
  }, [onRetryDistanceAutoRoute]);

  useEffect(() => {
    onDistanceAdjustRetryRef.current = onDistanceAdjustRetry;
  }, [onDistanceAdjustRetry]);

  useEffect(() => {
    onDismissDistanceAutoRouteRef.current = onDismissDistanceAutoRoute;
  }, [onDismissDistanceAutoRoute]);

  useEffect(() => {
    autoRouteMapPickRef.current = autoRouteMapPick;
  }, [autoRouteMapPick]);

  useEffect(() => {
    autoRouteSessionActiveRef.current = autoRouteSessionActive;
  }, [autoRouteSessionActive]);

  useEffect(() => {
    autoRouteTargetKmRef.current = autoRouteTargetKm;
  }, [autoRouteTargetKm]);

  useEffect(() => {
    autoRouteStatusMessageRef.current = autoRouteStatusMessage;
  }, [autoRouteStatusMessage]);

  useEffect(() => {
    onSuspendAutoRoutePopupPickRef.current = onSuspendAutoRoutePopupPick;
  }, [onSuspendAutoRoutePopupPick]);

  useEffect(() => {
    placeAutoRouteClickDebugMarkerRef.current = (lngLat) => {
      const map = mapRef.current;
      if (!map) return;
      placeAutoRouteClickDebugMarkerOnMap(map, autoRouteClickDebugMarkerRef, lngLat);
    };
    clearAutoRouteClickDebugMarkerRef.current = () => {
      clearAutoRouteClickDebugMarkerOnMap(autoRouteClickDebugMarkerRef);
    };
    registerDistanceAutoRouteClickDebugMarkerClear(() => {
      clearAutoRouteClickDebugMarkerRef.current();
    });
    return () => registerDistanceAutoRouteClickDebugMarkerClear(null);
  }, []);

  useEffect(() => {
    if (!autoRouteSessionActive) {
      clearAutoRouteClickDebugMarkerRef.current();
    }
  }, [autoRouteSessionActive]);

  useEffect(() => {
    const key = startLngLat ? `${startLngLat[0]},${startLngLat[1]}` : null;
    if (prevStartLngLatKeyRef.current != null && key !== prevStartLngLatKeyRef.current) {
      clearAutoRouteClickDebugMarkerRef.current();
    }
    prevStartLngLatKeyRef.current = key;
  }, [startLngLat]);

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
    if (!import.meta.env.DEV || !mapLoaded) return;
    const apply = () => {
      const map = mapRef.current;
      if (map) applyTickTestToMap(map);
    };
    apply();
    return subscribeTickTest(apply);
  }, [mapLoaded]);

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
      // 주행 밀착 카메라(거리 1~3m)가 zoom 22+를 요구 — 기본 maxZoom 22 클램프 해제
      maxZoom: 24,
    });
    map.addControl(new MapZoomGlobeControl(), "top-right");
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true, showZoom: false }),
      "top-right",
    );
    /** 축척: Mapbox 기본 우하단(bottom-right) */
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    mapRef.current = map;
    if (import.meta.env.DEV && typeof window !== "undefined") {
      (window as Window & { __RTW_MAP__?: mapboxgl.Map }).__RTW_MAP__ = map;
    }
    installCameraRenderPhaseHook(map);
    installTickTestMapHooks(map);

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
      if (isFollowCameraJump()) return;
      noteLodScheduleEnter();
      if (lodRaf) return;
      lodRaf = requestAnimationFrame(() => {
        lodRaf = 0;
        const now = performance.now();
        if (now - lodLastEmit < LOD_VIEWPORT_THROTTLE_MS) {
          scheduleLodViewportReport();
          return;
        }
        lodLastEmit = now;
        noteLodScheduleEmit();
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
    const onMoveCount = () => noteMapEvent("move");
    const onZoomCount = () => noteMapEvent("zoom");
    const onMoveEndCount = () => noteMapEvent("moveend");
    const onZoomEndCount = () => noteMapEvent("zoomend");
    const onIdleCount = () => noteMapEvent("idle");
    map.on("move", onMoveCount);
    map.on("zoom", onZoomCount);
    map.on("moveend", onMoveEndCount);
    map.on("zoomend", onZoomEndCount);
    map.on("idle", onIdleCount);

    map.on("style.load", () => {
      try {
      lastActivityWorldLayerSigByMap.delete(map);
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
      clearRiderGlbModels(map);
      ensureRiderGlbLayer(map);
      if (import.meta.env.DEV) applyTickTestToMap(map);
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
      } catch (err) {
        console.warn("[MapView] style.load failed", err);
      }
    });

    const teardownRoutePickDock = () => {
      routePickDockDragCleanupRef.current?.();
      routePickDockDragCleanupRef.current = null;
      if (routePickDockResizeHandlerRef.current) {
        window.removeEventListener("resize", routePickDockResizeHandlerRef.current);
        routePickDockResizeHandlerRef.current = null;
      }
      routePickDockLayerRef.current?.replaceChildren();
      routePickDockPanelRef.current = null;
      routePickDockPositionRef.current = null;
      map.getCanvas().classList.remove("map-view--pick-dragging");
    };

    let pickPopupCloseHandler: (() => void) | null = null;

    const detachPickPopup = () => {
      const popup = popupRef.current;
      popupRef.current = null;
      if (!popup) return;
      if (pickPopupCloseHandler) {
        popup.off("close", pickPopupCloseHandler);
        pickPopupCloseHandler = null;
      }
      popup.remove();
    };

    const finalizePickClose = (ac?: AbortController) => {
      ac?.abort();
      const suspendPick =
        onSuspendAutoRoutePopupPickRef.current ??
        getDistanceAutoRouteMapBridge()?.suspendPopupPick;
      suspendPick?.();
      pickPopupAutoRouteUiRef.current = null;
      onClearDistanceAutoRouteCircleRef.current?.();
      detachPickPopup();
      teardownRoutePickDock();
    };

    const buildDockFocus = (click?: LngLat) => {
      const route = routeGeometryRef.current;
      const routePoints =
        route && route.coordinates.length > 1
          ? [
              mapLngLatToContainerPoint(map, route.coordinates[0] as LngLat),
              mapLngLatToContainerPoint(
                map,
                route.coordinates[route.coordinates.length - 1] as LngLat,
              ),
            ]
          : [];
      return buildRoutePickDockFocus({
        click: click ? mapLngLatToContainerPoint(map, click) : null,
        start: startLngLatRef.current
          ? mapLngLatToContainerPoint(map, startLngLatRef.current)
          : null,
        routePoints,
      });
    };

    const positionRoutePickDockPanel = (panel: HTMLDivElement, click?: LngLat) => {
      const canvas = map.getCanvas();
      const canvasRect = viewportRectFromElement(canvas);
      const shell = mapShellRef.current;
      if (!shell) return;
      const shellRect = shell.getBoundingClientRect();
      const offsetLeft = canvasRect.left - shellRect.left;
      const offsetTop = canvasRect.top - shellRect.top;
      const viewport = {
        left: 0,
        top: 0,
        right: canvasRect.width,
        bottom: canvasRect.height,
        width: canvasRect.width,
        height: canvasRect.height,
      };
      const reservedRects = collectRoutePickDockReservedRects(document).map((rect) =>
        toCanvasLocalRect(rect, canvasRect),
      );
      const panelWidth = panel.offsetWidth || 280;
      const panelHeight = panel.offsetHeight || 220;
      const clamped = pickRoutePickDockPosition({
        viewport,
        panelWidth,
        panelHeight,
        reservedRects,
        focus: buildDockFocus(click),
        savedPosition: routePickDockPositionRef.current,
      });
      panel.style.left = `${offsetLeft + clamped.left}px`;
      panel.style.top = `${offsetTop + clamped.top}px`;
    };

    const mountDockedRoutePanel = (
      wrap: HTMLElement,
      click: LngLat,
      ac: AbortController,
    ) => {
      const layer = routePickDockLayerRef.current;
      const shell = mapShellRef.current;
      if (!layer || !shell) return;
      teardownRoutePickDock();
      detachPickPopup();

      const panel = document.createElement("div");
      panel.className = "map-view__pick-dock-panel";
      panel.dataset.dockClickLng = String(click[0]);
      panel.dataset.dockClickLat = String(click[1]);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "map-view__pick-dock-close";
      closeBtn.setAttribute("aria-label", "닫기");
      closeBtn.textContent = "×";
      closeBtn.onclick = () => finalizePickClose(ac);

      panel.append(closeBtn, wrap);
      layer.append(panel);
      routePickDockPanelRef.current = panel;

      requestAnimationFrame(() => {
        positionRoutePickDockPanel(panel, click);
      });

      const dragHandle = wrap.querySelector(".map-view__pick-drag-handle");
      if (dragHandle instanceof HTMLElement) {
        routePickDockDragCleanupRef.current = mountRoutePickDockDrag({
          handleEl: dragHandle,
          panelEl: panel,
          mapCanvas: map.getCanvas(),
          getPosition: () => {
            const canvasRect = viewportRectFromElement(map.getCanvas());
            const shellRect = shell.getBoundingClientRect();
            const offsetLeft = canvasRect.left - shellRect.left;
            const offsetTop = canvasRect.top - shellRect.top;
            return {
              left: Number.parseFloat(panel.style.left || "0") - offsetLeft,
              top: Number.parseFloat(panel.style.top || "0") - offsetTop,
            };
          },
          onPositionChange: (pos) => {
            const canvasRect = viewportRectFromElement(map.getCanvas());
            const shellRect = shell.getBoundingClientRect();
            const offsetLeft = canvasRect.left - shellRect.left;
            const offsetTop = canvasRect.top - shellRect.top;
            const viewport = {
              left: 0,
              top: 0,
              right: canvasRect.width,
              bottom: canvasRect.height,
              width: canvasRect.width,
              height: canvasRect.height,
            };
            const clamped = clampRoutePickDockPosition(
              pos.left,
              pos.top,
              panel.offsetWidth,
              panel.offsetHeight,
              viewport,
            );
            routePickDockPositionRef.current = clamped;
            panel.style.left = `${offsetLeft + clamped.left}px`;
            panel.style.top = `${offsetTop + clamped.top}px`;
          },
          onDraggingChange: (dragging) => {
            routePickDockDraggingRef.current = dragging;
            map.getCanvas().classList.toggle("map-view--pick-dragging", dragging);
            if (dragging) {
              map.dragPan.disable();
              map.doubleClickZoom.disable();
            } else {
              map.dragPan.enable();
              map.doubleClickZoom.enable();
            }
          },
        });
      }

      const onDockResize = () => {
        if (routePickDockDraggingRef.current) return;
        const lng = Number.parseFloat(panel.dataset.dockClickLng ?? "");
        const lat = Number.parseFloat(panel.dataset.dockClickLat ?? "");
        const resizeClick =
          Number.isFinite(lng) && Number.isFinite(lat)
            ? ([lng, lat] as LngLat)
            : click;
        positionRoutePickDockPanel(panel, resizeClick);
      };
      routePickDockResizeHandlerRef.current = onDockResize;
      window.addEventListener("resize", onDockResize);
    };

    const promotePointPopupToDock = (click: LngLat, ac: AbortController) => {
      const popup = popupRef.current;
      const wrap = popup?.getElement()?.querySelector(".map-view__pick");
      if (!(wrap instanceof HTMLElement)) return;
      wrap.remove();
      mountDockedRoutePanel(wrap, click, ac);
    };

    const openPickSurface = (picked: LngLat, event: mapboxgl.MapMouseEvent) => {
      if (routePickDockDraggingRef.current) return;
      finalizePickClose();
      const ac = new AbortController();
      const closePopup = () => finalizePickClose(ac);
      const initialHasStart = Boolean(startLngLatRef.current);
      const pickContent = buildPickPopup({
        lngLat: picked,
        getWaypointCount: () => routeWaypointsRef.current.length,
        accessToken: accessToken.trim(),
        signal: ac.signal,
        onSelectPoint: (type, lngLat, slot) => onSelectPointRef.current(type, lngLat, slot),
        initialStart: startLngLatRef.current,
        routeProfile: routeProfileRef.current,
        onRouteProfile: (p) => onRouteProfileRef.current(p),
        onArmDirectionPick: (input) => onArmDirectionPickRef.current?.(input) ?? {
          ok: false,
          message: "자동 경로를 시작할 수 없습니다.",
        },
        onRegisterAutoRouteUi: (ui) => {
          pickPopupAutoRouteUiRef.current = ui;
        },
        onDirectionPickArmed: () => {
          const popup = popupRef.current;
          if (popup) popup.options.closeOnClick = false;
        },
        onRoutePanelActivated: () => promotePointPopupToDock(picked, ac),
        onPreviewDistanceAutoRouteCircle: (input) =>
          onPreviewDistanceAutoRouteCircleRef.current?.(input),
        onClearDistanceAutoRouteCircle: () =>
          onClearDistanceAutoRouteCircleRef.current?.(),
        onSetRouteProfileOnly: (p) => onSetRouteProfileOnlyRef.current?.(p),
        getRouteTokenInsufficient: () =>
          isRouteTokenBlocked() || routeTokenInsufficientRef.current,
        lookupPioneer: (ll) => onLookupPioneerRef.current?.(ll) ?? Promise.resolve(null),
        onClearRoute:
          typeof onClearRouteRef.current === "function"
            ? () => {
                clearAutoRouteClickDebugMarkerRef.current();
                onClearRouteRef.current?.();
              }
            : undefined,
        onClearAutoRouteClickDebugMarker: () => clearAutoRouteClickDebugMarkerRef.current(),
        initialHasStart,
        initialHasEnd: Boolean(endLngLatRef.current),
        autoRouteSessionActive:
          autoRouteSessionActiveRef.current ||
          getDistanceAutoRouteMapBridge()?.sessionActive ||
          false,
        autoRouteTargetKm:
          getDistanceAutoRouteMapBridge()?.targetKm ?? autoRouteTargetKmRef.current,
        autoRouteStatusMessage:
          getDistanceAutoRouteMapBridge()?.statusMessage ??
          autoRouteStatusMessageRef.current,
        closePopup,
      });

      if (initialHasStart) {
        mountDockedRoutePanel(pickContent, picked, ac);
        return;
      }

      const anchor = pickPickPopupAnchor(map, event);
      const popup = new mapboxgl.Popup({
        closeOnClick: false,
        closeOnMove: false,
        className: "map-view__pick-popup",
        maxWidth: "min(300px, calc(100vw - 1.5rem))",
        anchor,
        offset: 18,
      })
        .setLngLat(picked)
        .setDOMContent(pickContent)
        .addTo(map);
      pickPopupCloseHandler = () => {
        ac.abort();
        const suspendPick =
          onSuspendAutoRoutePopupPickRef.current ??
          getDistanceAutoRouteMapBridge()?.suspendPopupPick;
        suspendPick?.();
        pickPopupAutoRouteUiRef.current = null;
        onClearDistanceAutoRouteCircleRef.current?.();
        if (popupRef.current === popup) popupRef.current = null;
        teardownRoutePickDock();
      };
      popup.on("close", pickPopupCloseHandler);
      popupRef.current = popup;
    };

    openRoutePickAtRef.current = (picked: LngLat) => {
      if (routePickDockDraggingRef.current) return;
      const point = map.project(picked);
      const fakeEvent = {
        lngLat: { lng: picked[0], lat: picked[1] },
        point,
      } as mapboxgl.MapMouseEvent;
      openPickSurface(picked, fakeEvent);
    };

    map.on("click", (event) => {
      if (routePickDockDraggingRef.current) return;
      if (autoRouteSearchBusyRef.current) return;
      const pinLabel = getActivityWorldPinLabelRef.current;
      if (
        pinLabel &&
        tryOpenActivityWorldPinPopup(map, event, pinLabel, popupRef, pickPickPopupAnchor)
      ) {
        return;
      }

      const picked: LngLat = [event.lngLat.lng, event.lngLat.lat];
      if (autoRouteMapPickRef.current === "direction" && onAutoRouteMapPickRef.current) {
        if (autoRouteSearchBusyRef.current) return;
        if (routePickDockDraggingRef.current) return;
        placeAutoRouteClickDebugMarkerRef.current(picked);
        const popup = popupRef.current;
        if (popup) popup.options.closeOnClick = false;
        autoRouteSearchBusyRef.current = true;
        pickPopupAutoRouteUiRef.current?.setInlinePhase(
          "searching",
          "목표 거리에 맞는 도로 경로를 찾는 중입니다…",
        );

        void onAutoRouteMapPickRef.current(picked)
          .then((result) => {
            if (!result) return;
            if (result.status === "found") {
              pickPopupAutoRouteUiRef.current?.setInlinePhase("found", result.message);
              if (result.offered) {
                pickPopupAutoRouteUiRef.current?.setOfferedPanel(
                  { adjustLabel: result.offered.adjustLabel },
                  () => onDistanceAdjustRetryRef.current?.(),
                );
              } else {
                pickPopupAutoRouteUiRef.current?.setOfferedPanel(null);
              }
              return;
            }
            pickPopupAutoRouteUiRef.current?.setOfferedPanel(null);
            pickPopupAutoRouteUiRef.current?.setInlinePhase("failed", result.message);
            onRetryDistanceAutoRouteRef.current?.();
          })
          .catch(() => {
            pickPopupAutoRouteUiRef.current?.setInlinePhase(
              "failed",
              "경로 탐색 중 오류가 발생했습니다. 방향을 다시 선택해 주세요.",
            );
            onRetryDistanceAutoRouteRef.current?.();
          })
          .finally(() => {
            autoRouteSearchBusyRef.current = false;
          });
        return;
      }
      if (autoRouteMapPickRef.current === "direction") {
        return;
      }
      openPickSurface(picked, event);
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
      map.off("move", onMoveCount);
      map.off("zoom", onZoomCount);
      map.off("moveend", onMoveEndCount);
      map.off("zoomend", onZoomEndCount);
      map.off("idle", onIdleCount);
      if (lodRaf) cancelAnimationFrame(lodRaf);
      window.removeEventListener("resize", onResize);
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      clearAutoRouteClickDebugMarkerOnMap(autoRouteClickDebugMarkerRef);
      placeSearchMarkerRef.current?.remove();
      for (const wm of waypointMarkersRef.current) wm.remove();
      waypointMarkersRef.current = [];
      liveMarkerRef.current?.remove();
      glbLiveNametagMarkerRef.current?.remove();
      popupRef.current?.remove();
      routePickDockDragCleanupRef.current?.();
      routePickDockDragCleanupRef.current = null;
      if (routePickDockResizeHandlerRef.current) {
        window.removeEventListener("resize", routePickDockResizeHandlerRef.current);
        routePickDockResizeHandlerRef.current = null;
      }
      routePickDockLayerRef.current?.replaceChildren();
      routePickDockPanelRef.current = null;
      routePickDockPositionRef.current = null;
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
          applyCoverageOverlayMode(
            map,
            coverageOverlayModeRef.current,
            mapillaryClientTokenRef.current ?? undefined,
          );
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
          applyCoverageOverlayMode(
            map,
            coverageOverlayModeRef.current,
            mapillaryClientTokenRef.current ?? undefined,
          );
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
      padding: RIDE_HUD_SAFE_PADDING,
      maxZoom: 16,
      duration: prefersReducedMotion ? 0 : 1100,
      essential: true,
    });

    if (map.isStyleLoaded()) {
      try {
        applyCoverageOverlayMode(
          map,
          coverageOverlayModeRef.current,
          mapillaryClientTokenRef.current ?? undefined,
        );
      } catch {
        /* noop */
      }
    }

    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [routeGeometry, mapLoaded, prefersReducedMotion]);

  const DISTANCE_TARGET_CIRCLE_SRC = "distance-target-circle";
  const lastAppliedCircleFitTokenRef = useRef(0);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!distanceTargetCircle?.coordinates?.length) {
      if (map.getLayer("distance-target-circle-line")) map.removeLayer("distance-target-circle-line");
      if (map.getLayer("distance-target-circle-casing")) {
        map.removeLayer("distance-target-circle-casing");
      }
      if (map.getSource(DISTANCE_TARGET_CIRCLE_SRC)) map.removeSource(DISTANCE_TARGET_CIRCLE_SRC);
      return;
    }

    const feature = {
      type: "Feature" as const,
      properties: {} as Record<string, never>,
      geometry: distanceTargetCircle,
    };

    const circleBeforeLayer = map.getLayer("route") ? "route" : undefined;

    if (map.getSource(DISTANCE_TARGET_CIRCLE_SRC)) {
      (map.getSource(DISTANCE_TARGET_CIRCLE_SRC) as mapboxgl.GeoJSONSource).setData(feature);
    } else {
      map.addSource(DISTANCE_TARGET_CIRCLE_SRC, { type: "geojson", data: feature });
      map.addLayer(
        {
          id: "distance-target-circle-casing",
          type: "line",
          source: DISTANCE_TARGET_CIRCLE_SRC,
          paint: {
            "line-color": "#111827",
            "line-width": 4,
            "line-dasharray": [2, 2],
            "line-opacity": 0.2,
          },
        },
        circleBeforeLayer,
      );
      map.addLayer(
        {
          id: "distance-target-circle-line",
          type: "line",
          source: DISTANCE_TARGET_CIRCLE_SRC,
          paint: {
            "line-color": ROUTE_LINE_COLOR,
            "line-width": 3,
            "line-opacity": 0.95,
            "line-dasharray": [2, 2],
          },
        },
        circleBeforeLayer,
      );
    }

    if (distanceTargetCircleFitToken <= 0) return;
    if (distanceTargetCircleFitToken <= lastAppliedCircleFitTokenRef.current) return;
    lastAppliedCircleFitTokenRef.current = distanceTargetCircleFitToken;

    const { minLng, minLat, maxLng, maxLat } = boundsFromLineCoordinates(
      distanceTargetCircle.coordinates,
    );
    const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);

    map.stop();
    suppressCameraFollowUntilRef.current = performance.now() + (prefersReducedMotion ? 120 : 1700);

    map.fitBounds(bounds, {
      padding: {
        top: RIDE_HUD_SAFE_PADDING.top + 48,
        bottom: RIDE_HUD_SAFE_PADDING.bottom + 200,
        left: RIDE_HUD_SAFE_PADDING.left + 72,
        right: RIDE_HUD_SAFE_PADDING.right + 72,
      },
      maxZoom: 14,
      duration: prefersReducedMotion ? 0 : 850,
      essential: true,
    });
    onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
  }, [mapLoaded, distanceTargetCircle, distanceTargetCircleFitToken, prefersReducedMotion]);

  // offered 결과: 고스트 마커(클릭 지점) + 점선(클릭→End)
  const DISTANCE_OFFERED_SRC = "distance-offered-overlay";
  const offeredGhostMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const clearOffered = () => {
      offeredGhostMarkerRef.current?.remove();
      offeredGhostMarkerRef.current = null;
      if (map.getLayer("distance-offered-line")) map.removeLayer("distance-offered-line");
      if (map.getSource(DISTANCE_OFFERED_SRC)) map.removeSource(DISTANCE_OFFERED_SRC);
    };

    if (!autoRouteOfferedState || !endLngLat) {
      clearOffered();
      return;
    }

    const { clickLngLat } = autoRouteOfferedState;

    // 고스트 마커 (클릭 지점)
    if (offeredGhostMarkerRef.current) {
      offeredGhostMarkerRef.current.setLngLat(clickLngLat);
    } else {
      const el = document.createElement("div");
      el.className = "map-view__auto-route-offered-ghost";
      el.title = DISTANCE_AUTO_ROUTE_REFERENCE_CIRCLE_HINT;
      offeredGhostMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(clickLngLat)
        .addTo(map);
    }

    // 점선(클릭→End)
    const lineData = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [clickLngLat, endLngLat] as [number, number][],
      },
    };
    if (map.getSource(DISTANCE_OFFERED_SRC)) {
      (map.getSource(DISTANCE_OFFERED_SRC) as mapboxgl.GeoJSONSource).setData(lineData);
    } else {
      map.addSource(DISTANCE_OFFERED_SRC, { type: "geojson", data: lineData });
      map.addLayer({
        id: "distance-offered-line",
        type: "line",
        source: DISTANCE_OFFERED_SRC,
        paint: {
          "line-color": "#9ca3af",
          "line-width": 2,
          "line-dasharray": [3, 3],
          "line-opacity": 0.7,
        },
      });
    }
  }, [mapLoaded, autoRouteOfferedState, endLngLat]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    let disposed = false;
    const apply = () => {
      if (disposed) return;
      try {
        applyCoverageOverlayMode(
          map,
          coverageOverlayModeRef.current,
          mapillaryClientTokenRef.current ?? undefined,
        );
      } catch {
        // 스타일시트 준비 전 addSource/addLayer throw — 다음 idle에 재시도
        map.once("idle", apply);
      }
    };

    apply();
    // 베이스맵 스타일 전환 시 커스텀 커버리지 레이어가 폐기되므로 재적용
    map.on("style.load", apply);
    return () => {
      disposed = true;
      map.off("style.load", apply);
      map.off("idle", apply);
    };
  }, [mapLoaded, coverageOverlayMode, mapillaryClientToken]);

  /**
   * Conquest — 「내 도로망」(과거 주행 궤적) 영구 렌더. 경로선 아래.
   * 스타일 전환 시 재적용.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const apply = () => {
      // 「지나온 구간」과 같은 이유로 isStyleLoaded() 를 게이트로 쓰지 않는다.
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }
      try {
        const features = (conquestTraces ?? [])
          .filter((g) => g?.coordinates?.length >= 2)
          .map((g) => ({
            type: "Feature" as const,
            properties: {},
            geometry: g,
          }));
        const fc = { type: "FeatureCollection" as const, features };
        const src = map.getSource(CONQUEST_TRACES_SRC) as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData(fc);
        } else {
          map.addSource(CONQUEST_TRACES_SRC, { type: "geojson", data: fc });
        }
        if (!map.getLayer(CONQUEST_TRACES_LAYER)) {
          map.addLayer(
            {
              id: CONQUEST_TRACES_LAYER,
              type: "line",
              source: CONQUEST_TRACES_SRC,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { ...RTW_TRACE_ACCUMULATED_PAINT },
            },
            // beforeId 없음 — 경로선 아래로 넣지 않는다. 순서는 아래에서 세운다.
          );
        }
        orderConquestLayersAboveRoute(map);
      } catch {
        /* noop */
      }
    };

    apply();
    if (!map.isStyleLoaded()) map.once("idle", apply);
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
      map.off("idle", apply);
    };
  }, [mapLoaded, conquestTraces]);

  /**
   * Conquest — 이번 주행의 진행 구간 실시간 칠하기(경로선 위, 라이더가 지나온 길이 골드로 물든다).
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const apply = () => {
      /*
       * isStyleLoaded() 를 게이트로 쓰지 않는다 — 베이스맵 타일이 계속 갱신되는 동안
       * false 라서 「지나온 구간」이 영영 안 그려졌다(주행 중엔 카메라가 매 프레임 움직여
       * idle 도 오지 않아 폴백조차 못 탄다). 스타일 접근 가능 여부만 확인한다.
       */
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }
      const traveled = conquestLiveTraveledMeters ?? 0;
      /**
       * 완료 구간·남은 구간은 **같은 경계 좌표**를 공유해야 한다 — 각자 자르면 틈·중복이 생긴다.
       * 분할은 순수 함수(`splitLineStringAtMeters`)가 단일 진실로 담당하고 시험이 고정한다(§3.4).
       */
      const completedLine = splitLineStringAtMeters(routeGeometry, traveled).completed;
      const coordinates: [number, number][] =
        traveled > 0 && completedLine ? (completedLine.coordinates as [number, number][]) : [];
      const fc = {
        type: "FeatureCollection" as const,
        features:
          coordinates.length >= 2
            ? [
                {
                  type: "Feature" as const,
                  properties: {},
                  geometry: { type: "LineString" as const, coordinates },
                },
              ]
            : [],
      };
      const src = map.getSource(CONQUEST_LIVE_SRC) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(fc);
      } else {
        map.addSource(CONQUEST_LIVE_SRC, { type: "geojson", data: fc });
      }
      if (!map.getLayer(CONQUEST_LIVE_GLOW_LAYER)) {
        // glow 를 본선보다 먼저(아래) 추가 — Mapbox drop-shadow 대체
        map.addLayer({
          id: CONQUEST_LIVE_GLOW_LAYER,
          type: "line",
          source: CONQUEST_LIVE_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { ...RTW_TRACE_LIVE_GLOW_PAINT },
        });
      }
      if (!map.getLayer(CONQUEST_LIVE_LAYER)) {
        map.addLayer({
          id: CONQUEST_LIVE_LAYER,
          type: "line",
          source: CONQUEST_LIVE_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { ...RTW_TRACE_LIVE_PAINT },
        });
      }
      orderConquestLayersAboveRoute(map);
    };

    try {
      apply();
    } catch {
      /* noop */
    }
    if (!map.isStyleLoaded()) map.once("idle", apply);
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
      map.off("idle", apply);
    };
  }, [mapLoaded, routeGeometry, conquestLiveTraveledMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (currentStyleRef.current === mapStyle) return;
    currentStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
    resetRtwStyleSnapshot(map);
  }, [mapStyle, mapLoaded]);

  /** RTW 다크 스타일 한정 — POI/건물 숨김 + 도로 존재감 다이어트 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    let disposed = false;
    const apply = () => {
      if (disposed) return;
      if (mapStyle !== RTW_MAP_STYLE_URL) return;
      // isStyleLoaded()는 traffic 등 라이브 소스 타일 갱신 중 false — 게이트로 쓰면 영영 미적용
      // (본 파일 red dot 사례와 동일 교훈). 스타일시트 준비 전이면 다음 idle에 재시도.
      let applied: boolean;
      try {
        applied = applyRtwLayerStyle(map, { rideActive, showPoi: showRtwPoi });
      } catch {
        applied = false;
      }
      if (!applied) map.once("idle", apply);
    };
    apply();
    map.on("style.load", apply);
    return () => {
      disposed = true;
      map.off("style.load", apply);
      map.off("idle", apply);
    };
  }, [mapLoaded, mapStyle, rideActive, showRtwPoi]);

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

  /** 이어 달리기 재개점 마커 — 「N% · 여기서 계속」(§3.4) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (resumeAnchor) {
      if (!resumeMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "map-view__resume-marker";
        el.textContent = resumeAnchor.label;
        el.title = resumeAnchor.label;
        resumeMarkerRef.current = new mapboxgl.Marker({
          element: el,
          className: "map-view__pin-marker map-view__resume-marker-host",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(resumeAnchor.lngLat)
          .addTo(map);
      } else {
        const el = resumeMarkerRef.current.getElement().querySelector<HTMLDivElement>(
          ".map-view__resume-marker",
        );
        const host = resumeMarkerRef.current.getElement();
        const target = el ?? (host.classList.contains("map-view__resume-marker") ? host : null);
        if (target) {
          target.textContent = resumeAnchor.label;
          target.title = resumeAnchor.label;
        }
        resumeMarkerRef.current.setLngLat(resumeAnchor.lngLat);
      }
    } else {
      resumeMarkerRef.current?.remove();
      resumeMarkerRef.current = null;
    }
  }, [resumeAnchor, mapLoaded]);

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
    const tickBody = (now: number) => {
      noteRafFrame(now);
      const map = mapRef.current;
      // isStyleLoaded() 는 위성+3D terrain 에서 영구 false 가능 → 동행 스프라이트 영영 차단.
      if (!map?.style) return;
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
          mapZoom: mapZoomRef.current,
          rideCameraDistanceM: rideCameraDistanceMRef.current,
          sessionStatus: liveRiderMotionRef.current?.sessionStatus,
          routeGeometry: routeGeometryRef.current,
          prevLiveRef: prevLiveRef,
          smooth: cameraSmoothRef.current,
          suppressUntilMs: suppressCameraFollowUntilRef.current,
          nowMs: now,
        });
        if (import.meta.env.DEV) {
          const headingDeg = resolveRiderBearingDeg(
            routeGeometryRef.current,
            sampled,
            prevForBearing,
          );
          publishRiderScreenDiag(measureRiderScreenDiag(map, sampled, headingDeg));
        }
      }

      const showPeerSprites = mapZoomRef.current > MAP_PEER_SPRITE_MIN_ZOOM;
      const peerFc = stepPeerDriveAndBuildGeoJson(
        null,
        dt,
        getBearing,
        routeGeometryRef.current,
        Date.now(),
      );
      const fc = showPeerSprites ? peerFc : EMPTY_GEOJSON_FC;
      syncPeerDomMarkers(map, fc.features as PeerDomGJFeature[], peerDomMarkersRef);
      if (RIDER_PROTOTYPE_MODE === "glb" && ensureRiderGlbLayer(map)) {
        const specs: RiderGlbModelSpec[] = [];
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
          // 코너링 린 — heading 변화율(°/s)에 비례, 지수 감쇠로 부드럽게
          const prevB = glbPrevBearingRef.current;
          glbPrevBearingRef.current = bearingDeg;
          let leanTarget = 0;
          if (prevB != null && dt > 0) {
            let dB = bearingDeg - prevB;
            if (dB > 180) dB -= 360;
            if (dB < -180) dB += 360;
            leanTarget = Math.max(-10, Math.min(10, (dB / dt) * 0.22));
          }
          const leanAlpha = 1 - Math.exp(-dt / 0.35);
          glbLeanDegRef.current += (leanTarget - glbLeanDegRef.current) * leanAlpha;
          specs.push({
            id: "live-self",
            lngLat: live,
            bearingDeg,
            pedalPose: resolveGlbPedalPose(liveCrankPhaseRevRef.current),
            leanDeg: glbLeanDegRef.current,
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
        if (import.meta.env.DEV && getTickTestOffList().length > 0) applyTickTestToMap(map);
        const liveLabel = liveRiderNametagRef.current?.trim() ?? "";
        syncGlbLiveNametagMarker(
          map,
          live,
          liveLabel,
          glbLiveNametagMarkerRef,
          glbLiveNametagElRef,
        );
      }
    };
    /**
     * 프레임 예외가 rAF 체인을 끊으면 카메라 팔로우·GLB 라이더 갱신이 영구 정지한다
     * (스타일을 되돌려도 복구 불가). 예외는 프레임 단위로 격리하고 재예약은 무조건 보장.
     */
    const tick = (now: number) => {
      try {
        tickBody(now);
      } catch {
        /* noop — 다음 프레임 재시도 */
      } finally {
        peerRidersRafRef.current = requestAnimationFrame(tick);
      }
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

  /** UI·시트에서 바꾼 `mapZoom` props → Mapbox. fitBounds 직후에는 suppress 윈도우 동안 건너뜀 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (performance.now() < suppressCameraFollowUntilRef.current) return;
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

    const rideMode = RIDE_FOLLOW_CAMERA_MODE;
    suppressCameraFollowUntilRef.current = 0;

    const headingFromRoute = getAverageHeadingAheadFromPoint(
      routeGeometryRef.current,
      target,
      CAMERA_BEARING_WINDOW_METERS,
      CAMERA_BEARING_WINDOW_SAMPLES,
    );
    const baseHeading = headingFromRoute ?? map.getBearing();
    const nextCamera = getCameraForFollowMode({
      mode: rideMode,
      baseHeading,
      currentPitch: map.getPitch(),
      distanceM: rideCameraDistanceMRef.current,
    });
    const vp = viewportPxFromMap(map);
    const framing = computeRideFollowFraming({
      riderLngLat: target,
      offsetBearing: nextCamera.offsetBearing,
      distanceM: nextCamera.distanceM,
      pitchDeg: nextCamera.pitch,
      viewportWidthPx: vp.width,
      viewportHeightPx: vp.height,
      fallbackZoom: mapZoomRef.current,
    });
    const center = framing.center;
    const rideZoom = framing.zoom;
    mapZoomRef.current = rideZoom;
    cameraSmoothRef.current.zoom = rideZoom;

    const applySnap = () => {
      const live = mapRef.current;
      if (!live) return;
      live.stop();
      live.jumpTo({
        center,
        zoom: rideZoom,
        bearing: nextCamera.bearing,
        pitch: nextCamera.pitch,
      });
      const smooth = cameraSmoothRef.current;
      smooth.center = center;
      smooth.bearing = nextCamera.bearing;
      smooth.bearingPrimary = nextCamera.bearing;
      smooth.pitch = nextCamera.pitch;
      smooth.zoom = rideZoom;
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

  const hasActivityDots =
    (activityWorldRaw?.pulseDots.length ?? 0) > 0 ||
    (activityWorldRaw?.heatDots.length ?? 0) > 0;

  /** style.reload 후 dot layer 유실 시 주기적 재동기화 */
  useEffect(() => {
    if (!mapLoaded || !hasActivityDots) return;
    const map = mapRef.current;
    if (!map) return;

    const run = () => {
      notePathBInterval();
      if (!map.style) return;
      const needPulse =
        (activityWorldRaw?.pulseDots.length ?? 0) > 0 && !map.getLayer(ACTIVITY_PULSE_DOTS_LAYER);
      const needHeat =
        (activityWorldRaw?.heatDots.length ?? 0) > 0 && !map.getLayer(ACTIVITY_HEAT_DOTS_LAYER);
      if (needPulse || needHeat) syncActivityWorldLayersOnMapRef.current(map);
    };
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
  }, [mapLoaded, hasActivityDots]);

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
          padding: RIDE_HUD_SAFE_PADDING,
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
    if (!mapLoaded || !openRoutePickRequest) return;
    openRoutePickAtRef.current?.(openRoutePickRequest.lngLat);
  }, [openRoutePickRequest, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      apply3DState(map, enable3D, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
    } catch (err) {
      console.warn("[MapView] apply3DState failed", err);
    }
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
    <div ref={mapShellRef} className="map-view-shell">
      <div ref={containerRef} className="map-view" role="presentation" />
      <div ref={routePickDockLayerRef} className="map-view__pick-dock-layer" />
      <TickTestOffBadge />
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

type PickPopupAutoRouteUi = {
  setInlinePhase: (
    phase: "idle" | "direction" | "searching" | "found" | "failed",
    message?: string,
  ) => void;
  tryArmDirectionPick: () => void;
  setOfferedPanel: (
    offered: { adjustLabel: string } | null,
    onAdjust?: () => void,
  ) => void;
};

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
  initialStart: LngLat | null;
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  onArmDirectionPick?: (input: {
    start: LngLat;
    profile: RouteProfile;
    targetKm: number;
  }) => { ok: true } | { ok: false; message: string };
  onRegisterAutoRouteUi?: (ui: PickPopupAutoRouteUi) => void;
  onDirectionPickArmed?: () => void;
  onRoutePanelActivated?: () => void;
  onPreviewDistanceAutoRouteCircle?: (input: {
    start: LngLat;
    targetKm: number;
  }) => void;
  onClearDistanceAutoRouteCircle?: () => void;
  onSetRouteProfileOnly?: (p: RouteProfile) => void;
  /** 호출 시점의 Route Token 부족 여부(잔액<1) — true면 수단 버튼 비활성 */
  getRouteTokenInsufficient?: () => boolean;
  /** Conquest — 이 지점 영토의 개척자 한 줄(null=미개척) */
  lookupPioneer?: (lngLat: LngLat) => Promise<string | null>;
  onClearRoute?: (() => void) | undefined;
  onClearAutoRouteClickDebugMarker?: () => void;
  initialHasStart: boolean;
  initialHasEnd: boolean;
  autoRouteSessionActive?: boolean;
  autoRouteTargetKm?: number;
  autoRouteStatusMessage?: string | null;
  closePopup: () => void;
}): HTMLDivElement {
  const {
    lngLat,
    getWaypointCount,
    accessToken,
    signal,
    onSelectPoint,
    initialStart,
    routeProfile,
    onRouteProfile,
    onArmDirectionPick,
    onRegisterAutoRouteUi,
    onDirectionPickArmed,
    onRoutePanelActivated,
    onPreviewDistanceAutoRouteCircle,
    onClearDistanceAutoRouteCircle,
    onSetRouteProfileOnly,
    getRouteTokenInsufficient,
    lookupPioneer,
    onClearRoute,
    onClearAutoRouteClickDebugMarker,
    initialHasStart,
    initialHasEnd,
    autoRouteSessionActive = false,
    autoRouteTargetKm = 10,
    autoRouteStatusMessage = null,
    closePopup,
  } = deps;
  const [lng, lat] = lngLat;

  const wrap = document.createElement("div");
  wrap.className = "map-view__pick";

  /** 팝업이 열린 뒤 출발/도착 클릭으로 갱신되는 끝점 보유 상태(리렌더 전에도 동작). */
  const pins = { start: initialHasStart, end: initialHasEnd };
  let selectedStart = initialStart;
  let currentProfile = routeProfile;
  const mapBridge = getDistanceAutoRouteMapBridge();
  let autoSessionActive = autoRouteSessionActive || mapBridge?.sessionActive || false;
  let distanceDirectionChecked =
    mapBridge?.distanceDirectionMode ?? autoSessionActive;

  function getRouteStart(): LngLat | null {
    return selectedStart ?? initialStart;
  }

  function previewCircleForTargetKm(km: number) {
    const start = getRouteStart();
    if (!start || typeof onPreviewDistanceAutoRouteCircle !== "function") return;
    onPreviewDistanceAutoRouteCircle({ start, targetKm: km });
  }

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
    onClearAutoRouteClickDebugMarker?.();
    getDistanceAutoRouteMapBridge()?.disarm?.();
    onSelectPoint("start", lngLat);
    queueMicrotask(() => {
      if (!getDistanceAutoRouteMapBridge()?.distanceDirectionMode) {
        applyDistanceDirectionMode(false);
      }
    });
    pins.start = true;
    selectedStart = lngLat;
    syncProfileUi();
    syncAutoRouteUi();
    syncTokenUi();
    if (pins.start && distanceDirectionChecked) previewCircleForTargetKm(targetKm);
    onRoutePanelActivated?.();
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
    else {
      syncProfileUi();
      syncAutoRouteUi();
      syncTokenUi();
    }
  };

  pinRow.append(startBtn, wpButtons[0]!, wpButtons[1]!, wpButtons[2]!, endBtn);

  const profileSection = document.createElement("div");
  profileSection.className = "map-view__pick-profile-section";

  const rowProfile = document.createElement("div");
  rowProfile.className = "map-view__pick-actions map-view__pick-actions--profile";
  rowProfile.setAttribute("role", "group");

  const profileLabel = document.createElement("span");
  profileLabel.className = "map-view__pick-sr-only";
  profileLabel.id = "map-view-pick-profile-label";
  profileLabel.textContent = "이동수단";
  rowProfile.setAttribute("aria-labelledby", "map-view-pick-profile-label");
  rowProfile.append(profileLabel);

  const tokenSection = document.createElement("div");
  const tokenFeedback = mountRouteTokenPopupFeedback(tokenSection, signal);

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
    if (profile === currentProfile) pb.classList.add("is-active");
    pb.innerHTML = PICK_POPUP_PROFILE_ICON_SVG[profile];
    pb.title =
      profile === "driving" ? "Route by car" : profile === "walking" ? "Route on foot" : "Route by bike";
    pb.setAttribute("aria-label", ariaLabelKo);
    pb.onclick = () => {
      if (!pins.start) return;
      currentProfile = profile;
      profileButtons.forEach((item, index) => {
        item.classList.toggle("is-active", profileSpecs[index]?.profile === currentProfile);
      });
      const manualRouteReady = pins.start && pins.end && !distanceDirectionChecked;
      if (manualRouteReady) {
        if (getRouteTokenInsufficient?.()) return;
        tokenFeedback.setRoutePending(true);
        onRouteProfile(profile);
      } else {
        onSetRouteProfileOnly?.(profile);
      }
    };
    profileButtons.push(pb);
    rowProfile.appendChild(pb);
  }

  if (typeof onClearRoute === "function") {
    const clearRouteBtn = document.createElement("button");
    clearRouteBtn.type = "button";
    clearRouteBtn.className = "map-view__pick-btn map-view__pick-btn--clear-route";
    clearRouteBtn.textContent = "경로 삭제";
    clearRouteBtn.title = "Clear route";
    clearRouteBtn.setAttribute("aria-label", "경로 전체 삭제");
    clearRouteBtn.onclick = () => {
      onClearRoute();
      onClearDistanceAutoRouteCircle?.();
      pins.start = false;
      pins.end = false;
      selectedStart = null;
      closePopup();
    };
    rowProfile.appendChild(clearRouteBtn);
  }

  function syncProfileUi() {
    const hasStart = pins.start;
    const manualRouteReady = pins.start && pins.end && !distanceDirectionChecked;
    profileSection.hidden = !hasStart;
    rowProfile.hidden = !hasStart;
    wrap.classList.toggle("map-view__pick--awaiting-profile", manualRouteReady);
    profileLabel.textContent = manualRouteReady ? "경로 탐색 유형 선택" : "이동수단";
    profileSpecs.forEach((spec, i) => {
      const pb = profileButtons[i];
      if (!pb) return;
      pb.classList.toggle("is-active", spec.profile === currentProfile);
      if (!manualRouteReady) {
        pb.disabled = false;
        pb.classList.remove("is-disabled");
        pb.title =
          spec.profile === "driving"
            ? "Route by car"
            : spec.profile === "walking"
              ? "Route on foot"
              : "Route by bike";
        return;
      }
      const tokenInsufficient = Boolean(getRouteTokenInsufficient?.());
      pb.disabled = tokenInsufficient;
      pb.classList.toggle("is-disabled", tokenInsufficient);
      pb.title = tokenInsufficient
        ? ROUTE_TOKEN_INSUFFICIENT_HINT
        : spec.profile === "driving"
          ? "Route by car"
          : spec.profile === "walking"
            ? "Route on foot"
            : "Route by bike";
    });
  }

  function syncTokenUi() {
    tokenSection.hidden = !pins.start;
  }

  profileSection.append(rowProfile);
  syncProfileUi();
  syncTokenUi();

  const autoRouteSection = document.createElement("div");
  autoRouteSection.className = "map-view__pick-auto-route";

  let targetKm = autoRouteTargetKm;

  const distanceRow = document.createElement("div");
  distanceRow.className = "map-view__pick-distance-row";

  const modeField = document.createElement("label");
  modeField.className = "map-view__pick-distance-mode";

  const modeCheckbox = document.createElement("input");
  modeCheckbox.type = "checkbox";
  modeCheckbox.className = "map-view__pick-distance-mode-checkbox";
  modeCheckbox.setAttribute("aria-label", DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA);

  const modeLabel = document.createElement("span");
  modeLabel.className = "map-view__pick-distance-mode-label";
  modeLabel.textContent = DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL;

  modeField.append(modeCheckbox, modeLabel);

  const distanceLabel = document.createElement("label");
  distanceLabel.className = "map-view__pick-sr-only";
  distanceLabel.textContent = "목표거리(km)";
  distanceLabel.htmlFor = "map-view-pick-distance-slider";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "map-view__pick-distance-step map-view__pick-distance-step--minus";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "목표 거리 0.5km 감소");

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "map-view__pick-distance-step map-view__pick-distance-step--plus";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "목표 거리 0.5km 증가");

  const distanceSlider = document.createElement("input");
  distanceSlider.type = "range";
  distanceSlider.className = "map-view__pick-distance-slider";
  distanceSlider.id = "map-view-pick-distance-slider";
  distanceSlider.min = String(DISTANCE_AUTO_ROUTE_KM_MIN);
  distanceSlider.max = String(DISTANCE_AUTO_ROUTE_KM_MAX);
  distanceSlider.step = String(DISTANCE_AUTO_ROUTE_KM_STEP);
  distanceSlider.value = String(targetKm);

  const distanceNumber = document.createElement("input");
  distanceNumber.type = "text";
  distanceNumber.inputMode = "decimal";
  distanceNumber.className = "map-view__pick-distance-number";
  distanceNumber.setAttribute("aria-label", "목표거리 km");
  distanceNumber.value = targetKm.toFixed(1);

  distanceRow.append(modeField, distanceLabel, minusBtn, distanceSlider, plusBtn, distanceNumber);

  const autoRouteStatusSlot = document.createElement("div");
  autoRouteStatusSlot.className = "map-view__pick-auto-route-status-slot";

  const autoRouteStatus = document.createElement("p");
  autoRouteStatus.className = "map-view__pick-auto-route-status map-view__pick-auto-route-status--idle";
  autoRouteStatus.setAttribute("role", "status");
  autoRouteStatus.setAttribute("aria-live", "polite");
  autoRouteStatus.dataset.phase = "idle";

  const offeredPanel = document.createElement("div");
  offeredPanel.className = "map-view__pick-auto-route-offered";
  offeredPanel.hidden = true;

  const offeredAdjustBtn = document.createElement("button");
  offeredAdjustBtn.type = "button";
  offeredAdjustBtn.className = "map-view__pick-auto-route-offered-btn";
  offeredAdjustBtn.hidden = true;
  offeredPanel.append(offeredAdjustBtn);

  autoRouteStatusSlot.append(autoRouteStatus, offeredPanel);

  function setOfferedPanel(
    offered: { adjustLabel: string } | null,
    onAdjust?: () => void,
  ) {
    if (!offered) {
      offeredPanel.hidden = true;
      offeredAdjustBtn.hidden = true;
      offeredAdjustBtn.onclick = null;
      return;
    }
    offeredPanel.hidden = false;
    offeredAdjustBtn.hidden = false;
    offeredAdjustBtn.textContent = offered.adjustLabel;
    offeredAdjustBtn.onclick = () => onAdjust?.();
  }

  function syncDistanceInputs(km: number) {
    targetKm = km;
    distanceSlider.value = String(km);
    distanceNumber.value = km.toFixed(1);
    if (distanceDirectionChecked) {
      minusBtn.disabled = km <= DISTANCE_AUTO_ROUTE_KM_MIN;
      plusBtn.disabled = km >= DISTANCE_AUTO_ROUTE_KM_MAX;
    }
  }

  function syncDistanceModeUi() {
    modeCheckbox.checked = distanceDirectionChecked;
    distanceSlider.disabled = !distanceDirectionChecked;
    distanceNumber.disabled = !distanceDirectionChecked;
    distanceRow.classList.toggle(
      "map-view__pick-distance-row--disabled",
      !distanceDirectionChecked,
    );
    if (!distanceDirectionChecked) {
      minusBtn.disabled = true;
      plusBtn.disabled = true;
      return;
    }
    syncDistanceInputs(targetKm);
  }

  function applyDistanceDirectionMode(checked: boolean) {
    distanceDirectionChecked = checked;
    mapBridge?.setDistanceDirectionMode?.(checked);
    syncDistanceModeUi();
    if (!checked) {
      onClearAutoRouteClickDebugMarker?.();
      setInlinePhase("idle");
      return;
    }
    previewCircleForTargetKm(targetKm);
    tryArmDirectionPickIfChecked();
  }

  function tryArmDirectionPickIfChecked() {
    if (!distanceDirectionChecked) return;
    tryArmDirectionPick();
  }

  function stepTargetKm(deltaKm: number) {
    if (!distanceDirectionChecked) return;
    const next = Math.min(
      DISTANCE_AUTO_ROUTE_KM_MAX,
      Math.max(
        DISTANCE_AUTO_ROUTE_KM_MIN,
        Math.round((targetKm + deltaKm) / DISTANCE_AUTO_ROUTE_KM_STEP) * DISTANCE_AUTO_ROUTE_KM_STEP,
      ),
    );
    syncDistanceInputs(next);
    previewCircleForTargetKm(next);
    tryArmDirectionPickIfChecked();
  }

  function setInlinePhase(
    phase: "idle" | "direction" | "searching" | "found" | "failed",
    message?: string,
  ) {
    autoRouteStatus.className = "map-view__pick-auto-route-status";
    autoRouteStatus.dataset.phase = phase;
    if (phase === "idle") {
      autoRouteStatus.textContent = "";
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--idle");
      return;
    }
    if (phase === "direction") {
      autoRouteStatus.textContent = message ?? DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT;
      return;
    }
    if (phase === "searching") {
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--searching");
      autoRouteStatus.textContent =
        message ?? "목표 거리에 맞는 도로 경로를 찾는 중입니다…";
      return;
    }
    if (phase === "failed") {
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--failed");
      autoRouteStatus.textContent = message ?? "경로를 찾지 못했습니다.";
      return;
    }
    autoRouteStatus.classList.add("map-view__pick-auto-route-status--found");
    autoRouteStatus.textContent = message ?? "경로를 찾았습니다.";
  }

  function tryArmDirectionPick() {
    if (!distanceDirectionChecked) return;
    const start = getRouteStart();
    if (!start || typeof onArmDirectionPick !== "function") return;
    if (getRouteTokenInsufficient?.()) {
      setInlinePhase("failed", ROUTE_TOKEN_INSUFFICIENT_HINT);
      return;
    }
    const parsed = Number.parseFloat(distanceNumber.value);
    const validated = validateDistanceAutoRouteTargetKm(parsed);
    if (!validated.ok) {
      setInlinePhase("failed", validated.message);
      return;
    }
    syncDistanceInputs(validated.km);
    previewCircleForTargetKm(validated.km);
    const result = onArmDirectionPick({
      start,
      profile: currentProfile,
      targetKm: validated.km,
    });
    if (!result.ok) {
      setInlinePhase("failed", result.message);
      return;
    }
    autoSessionActive = true;
    const rerouteReady = autoRouteStatus.dataset.phase === "found";
    setInlinePhase(
      "direction",
      rerouteReady || autoRouteStatusMessage === DISTANCE_AUTO_ROUTE_REROUTE_HINT
        ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
        : DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
    );
    onDirectionPickArmed?.();
  }

  onRegisterAutoRouteUi?.({
    setInlinePhase,
    tryArmDirectionPick: tryArmDirectionPickIfChecked,
    setOfferedPanel,
  });

  modeCheckbox.addEventListener("change", () => {
    applyDistanceDirectionMode(modeCheckbox.checked);
  });

  distanceSlider.addEventListener("input", () => {
    if (!distanceDirectionChecked) return;
    const km = Number.parseFloat(distanceSlider.value);
    if (!Number.isFinite(km)) return;
    syncDistanceInputs(km);
    previewCircleForTargetKm(km);
    tryArmDirectionPickIfChecked();
  });

  minusBtn.addEventListener("click", () => {
    if (minusBtn.disabled) return;
    stepTargetKm(-DISTANCE_AUTO_ROUTE_KM_STEP);
  });
  plusBtn.addEventListener("click", () => {
    if (plusBtn.disabled) return;
    stepTargetKm(DISTANCE_AUTO_ROUTE_KM_STEP);
  });

  distanceNumber.addEventListener("change", () => {
    if (!distanceDirectionChecked) return;
    tryArmDirectionPickIfChecked();
  });

  autoRouteSection.append(distanceRow, autoRouteStatusSlot);

  function syncAutoRouteUi() {
    const available = pins.start && typeof onArmDirectionPick === "function";
    autoRouteSection.hidden = !available;
    if (!available) {
      setInlinePhase("idle");
      onClearDistanceAutoRouteCircle?.();
    }
  }
  syncAutoRouteUi();
  syncDistanceModeUi();
  syncDistanceInputs(targetKm);
  if (distanceDirectionChecked && pins.start) {
    tryArmDirectionPickIfChecked();
  }
  if (distanceDirectionChecked && autoRouteStatusMessage) {
    setInlinePhase("found", autoRouteStatusMessage);
  }

  const unsubTokenForProfile = subscribeRouteTokenEffective(() => {
    syncProfileUi();
    syncAutoRouteUi();
    syncTokenUi();
  });
  signal.addEventListener(
    "abort",
    () => {
      unsubTokenForProfile();
      onClearDistanceAutoRouteCircle?.();
    },
    { once: true },
  );

  /** Conquest — 이 지점 영토의 개척자(있을 때만 노출, §3.4 Phase A 유일 노출 지점) */
  const pioneerEl = document.createElement("div");
  pioneerEl.className = "map-view__pick-pioneer";
  pioneerEl.hidden = true;
  if (typeof lookupPioneer === "function") {
    void lookupPioneer(lngLat)
      .then((line) => {
        if (signal.aborted) return;
        if (line) {
          pioneerEl.textContent = line;
          pioneerEl.hidden = false;
        }
      })
      .catch(() => {
        /* noop */
      });
  }

  const dragHandle = document.createElement("div");
  dragHandle.className = "map-view__pick-drag-handle";
  dragHandle.append(addressEl, metaEl);

  wrap.append(dragHandle, pioneerEl, pinRow, tokenSection, profileSection, autoRouteSection);

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

  // App 측 armDirectionPick(anchor extend) 이 popup DOM 보다 먼저 커밋되면 checkbox 가 한 틱 늦게 맞춰진다.
  queueMicrotask(() => {
    if (signal.aborted) return;
    const live = getDistanceAutoRouteMapBridge();
    if (!live?.distanceDirectionMode) return;
    if (!pins.start && !selectedStart) return;
    distanceDirectionChecked = true;
    if (typeof live.targetKm === "number" && live.targetKm > 0) {
      syncDistanceInputs(live.targetKm);
    }
    syncDistanceModeUi();
    tryArmDirectionPickIfChecked();
    onDirectionPickArmed?.();
  });

  return wrap;
}
