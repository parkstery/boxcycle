/* eslint-disable react-hooks/refs */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "../../lib/map/disableMapboxTelemetry";
import {
  lngLatBoundsToViewport,
  viewportSpanKm,
  type ActivityWorldRawOverlay,
  type MapViewportBounds,
} from "../../lib/activity/activityWorldLod";
import { DISTANCE_AUTO_ROUTE_REFERENCE_CIRCLE_HINT } from "../../lib/route/distanceAutoRoute";
import {
  getDistanceAutoRouteMapBridge,
  registerDistanceAutoRouteClickDebugMarkerClear,
} from "../../lib/map/distanceAutoRouteMapBridge";
import {
  createDistanceAutoRouteClickDebugMarkerElement,
  isDistanceAutoRouteClickDebugEnabled,
  updateDistanceAutoRouteClickDebugMarkerElement,
} from "../../lib/debug/distanceAutoRouteClickDebugMarker";
import {
  SELF_LOCATION_MARKER_CLASS,
  createSelfLocationMarkerRoot,
  updateSelfLocationMarkerViewportBearing,
} from "../../lib/map/mapSelfLocationMarker";
import {
  buildRoutePickDockFocus,
  clampRoutePickDockPosition,
  collectRoutePickDockReservedRects,
  mapLngLatToContainerPoint,
  mountRoutePickDockDrag,
  pickRoutePickDockPosition,
  toCanvasLocalRect,
  viewportRectFromElement,
} from "../../lib/map/mapPickRouteDock";
import {
  applyRtwLayerStyle,
  resetRtwStyleSnapshot,
  RTW_MAP_STYLE_URL,
  RTW_TRACE_ACCUMULATED_HALO_PAINT,
  RTW_TRACE_ACCUMULATED_PAINT,
  RTW_TRACE_LIVE_GLOW_PAINT,
  RTW_TRACE_LIVE_PAINT,
} from "../../lib/map/rtwMapConfig";
import { conquestLayerEmphasis } from "../../lib/conquest/conquestLayerEmphasis";
import {
  shouldMoveActivityWorldLayersToTop,
} from "../../lib/debug/mapDebugPhase";
import {
  noteLodScheduleEmit,
  noteLodScheduleEnter,
  noteMapEvent,
  notePathBInterval,
  noteRafFrame,
  noteSyncActivityMs,
  isFollowCameraJump,
} from "../../lib/debug/mapTickProbe";
import { installCameraRenderPhaseHook } from "../../lib/camera/cameraRenderPhase";
import { applyTickTestToMap, getTickTestOffList, installTickTestMapHooks, subscribeTickTest } from "../../lib/debug/tickTestSwitches";
import type { LngLat, LineStringGeometry } from "../../lib/geo/geo";
import {
  boundsFromLineCoordinates,
  getDistanceMeters,
  lineStringLengthMeters,
  resolveRiderBearingDeg,
} from "../../lib/geo/geo";
import { splitLineStringAtMeters } from "../../lib/route/routeProgressSplit";
import type { RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import type { FollowMode } from "../../lib/map/mapGlobeView";
import {
  getRouteTokenInsufficient as isRouteTokenBlocked,
} from "../../lib/account/routeTokenSpendBridge";
import type { CoverageOverlayMode } from "../../lib/activity/coverageOverlayMode";
import type { RouteProfile } from "../../services/mapboxDirections";
import { estimateCrankRpmFromSpeedKmh, resolvePedalCrankRpm } from "../../lib/sensor/crankRpm";
import { resolveGlbPedalPose } from "../../lib/rider/riderGlbPedalPose";
import { stepPeerDriveAndBuildGeoJson } from "../../lib/peerMotion/peerRidersDrive";
import { resetPeerMotionRegistry } from "../../lib/peerMotion";
import { MAP_PEER_SPRITE_MIN_ZOOM } from "../../lib/ride/rideSyncPolicy";
import { applyCoverageOverlayMode } from "../../services/coverageOverlaySync";
import type { GlobalLivePresenceDot } from "../../hooks/useGlobalLivePresence";
import type { TrailSpectatorDot } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";
import {
  getRiderPrototypeMode,
  isRiderPrototype3dMode,
} from "../../lib/riderPrototype/config";
import {
  applyIso2dRiderBearing,
  createIso2dRiderMarkerRoot,
  type RiderGlbModelSpec,
} from "../../lib/riderPrototype/iso2dMarker";
import { clearRiderGlbModels, ensureRiderGlbLayer, syncRiderGlbModels } from "../../lib/riderPrototype/glbModelLayer";
import {
  clearRiderPreservedModels,
  ensureRiderPreservedLayer,
  syncRiderPreservedModels,
} from "../../lib/map/riderPreservedLayer";
import { MapZoomGlobeControl } from "./MapZoomGlobeControl";
import {
  computeRideFollowFraming,
  distanceMFromRideFollowZoom,
  measureRiderScreenDiag,
  publishRiderScreenDiag,
  RIDE_HUD_SAFE_PADDING,
  viewportPxFromMap,
  resolveRideFitPadding,
} from "../../lib/camera/rideCameraFraming";
import {
  MAP_GLOBE_MIN_ZOOM,
  DEFAULT_MAP_ZOOM,
  RIDE_FOLLOW_CAMERA_MODE,
  RIDE_CAMERA_DISTANCE_DEFAULT_M,
  RIDE_CAMERA_DISTANCE_MIN_M,
  RIDE_CAMERA_DISTANCE_MAX_M,
  resolveRideCameraPitchClose,
} from "../../lib/map/mapGlobeView";
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
const RIDER_PROTOTYPE_IS_3D = isRiderPrototype3dMode(RIDER_PROTOTYPE_MODE);


import {
  ACTIVITY_HEAT_DOTS_LAYER,
  ACTIVITY_PULSE_DOTS_LAYER,
  forgetActivityWorldLayerOrder,
  moveActivityWorldLayersToTop,
  routeLayerInsertBefore,
  syncCourseActivityLayers,
  syncLiveOverlayLayersOnMap,
  syncWorldHeatDots,
  syncWorldRedDots,
} from "./mapLiveOverlayLayers";
import {
  buildPickPopup,
  createLiveRiderMarkerRoot,
  createRouteEndpointPinEl,
  createWaypointMarkerEl,
  pickPickPopupAnchor,
  tryOpenActivityWorldPinPopup,
  type PickPopupAutoRouteUi,
} from "./mapPopupElements";
import {
  addRouteLine,
  applyConquestEmphasis,
  CONQUEST_LIVE_GLOW_LAYER,
  CONQUEST_LIVE_LAYER,
  CONQUEST_LIVE_SRC,
  CONQUEST_TRACES_HALO_LAYER,
  CONQUEST_TRACES_LAYER,
  CONQUEST_TRACES_SRC,
  ROUTE_LINE_COLOR,
} from "./routeConquestLayers";

function isMapAttachedToContainer(map: mapboxgl.Map, container: HTMLElement | null): boolean {
  if (!container) return false;
  try {
    const el = map.getContainer();
    return el.parentNode === container;
  } catch {
    return false;
  }
}


/** 표고 프로필 선·종점 깃발 — 경로선(#ef4444)과 같은 색이라 혼동을 준다는 Chief 지적으로 분리(2026-09-24) */
const ELEVATION_LINE_COLOR = "#c36839";

const EMPTY_ACTIVITY_WORLD_RAW: ActivityWorldRawOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};


/** 레거시 `app.js` 와 동일한 서울 근처 기본 시야(강남). 지시09 — 부트 중심은 `initialCenter` 우선. */
const DEFAULT_CENTER: [number, number] = [127.035, 37.505];
const DEFAULT_ZOOM = DEFAULT_MAP_ZOOM;

function mountSelfLocationMarker(
  map: mapboxgl.Map,
  lngLat: LngLat,
): { marker: mapboxgl.Marker; bearingEl: HTMLDivElement } {
  const { root, bearingEl } = createSelfLocationMarkerRoot();
  const marker = new mapboxgl.Marker({
    element: root,
    className: SELF_LOCATION_MARKER_CLASS,
    anchor: "center",
    ...PIN_MARKER_VIEWPORT_ALIGNMENT,
  })
    .setLngLat(lngLat)
    .addTo(map);
  return { marker, bearingEl };
}

import {
  PIN_MARKER_VIEWPORT_ALIGNMENT,
  RIDER_ROUTE_MARKER_OFFSET_PX,
  reprojectGlbNametagMarkers,
  syncGlbLiveNametagMarker,
  syncPeerDomMarkers,
  type PeerDomGJFeature,
} from "./riderDomMarkers";

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
  if (RIDER_PROTOTYPE_IS_3D) return;

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
  /** OSRM(Mapbox Streets) 도로 커버리지 */
  coverageOverlayMode: CoverageOverlayMode;
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
  /**
   * 지도 **최초** 생성 중심(지시09 A). 생략 시 강남 기본.
   * 생성 후에는 쓰지 않는다 — 재점프 금지.
   */
  initialCenter?: LngLat | null;
  /** 최초 줌. 생략 시 DEFAULT_MAP_ZOOM(13). */
  initialZoom?: number | null;
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
  /**
   * RTW Dark 한정 — 주행 중 도로 유령화·건물 숨김 해제.
   * 2026-09-18 부터 **경로 설정 표면 정리**(팝업·도크·목표 거리 원)도 이 신호를 쓴다.
   * `lockRouteWorkspaceDuringRide` 를 쓰지 않는 이유: 그건 `import.meta.env.PROD` 게이트가
   * 걸려 있어 개발·시험 빌드에서는 항상 false 라 정리가 통째로 안 걸린다.
   */
  rideActive?: boolean;
  /** 주행 카메라 라이더~카메라 거리(m) — 개발용 거리 슬라이더, 최적값 확정 후 제거 예정 */
  rideCameraDistanceM?: number;
  /** Quick Camera 6 — baseHeading 고정(북쪽=0). null 이면 일반 heading 소스 */
  lockBaseHeading?: number | null;
  /**
   * 사용자 휠/핀치 줌 → 거리 역산 반영(지시06).
   * `spanFloorMode: "userZoom"` 과 함께 쓴다.
   */
  onRideCameraDistanceFromUserZoom?: (distanceM: number) => void;
  /** B1 floor 모드 — preset | userZoom */
  rideCameraSpanFloorMode?: "preset" | "userZoom";
  /** 임시 — RTW Dark POI 라벨 표시 비교용 토글 */
  showRtwPoi?: boolean;
  /** 목표 거리 참고 원 — GeoJSON LineString(지도 stroke용) */
  distanceTargetCircle?: LineStringGeometry | null;
  /** 예상 시간 계산용 누적 주행(5A-R2 §4.3). 없으면 폴백 속도를 쓴다. */
  userMileageTotalMeters?: number | null;
  userMileageTotalSec?: number | null;
  /** 원 bounds fitBounds — 사용자가 자동 찾기·거리 변경할 때만 증가 */
  distanceTargetCircleFitToken?: number;
  /** offered 결과: 클릭 지점(고스트)·도달 거리 표시용 */
  autoRouteOfferedState?: {
    clickLngLat: LngLat;
    directKm: number;
    targetKm: number;
  } | null;
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
  externalCameraJump = null,
  openRoutePickRequest = null,
  placeSearchMarkerLngLat = null,
  resumeAnchor = null,
  initialCenter = null,
  initialZoom = null,
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
  lockBaseHeading = null,
  onRideCameraDistanceFromUserZoom,
  rideCameraSpanFloorMode = "preset",
  showRtwPoi = false,
  distanceTargetCircle = null,
  userMileageTotalMeters = null,
  userMileageTotalSec = null,
  distanceTargetCircleFitToken = 0,
  autoRouteOfferedState = null,
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
  const selfLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const selfLocationBearingRef = useRef<HTMLDivElement | null>(null);
  const selfLocationGeoBearingRef = useRef<number | null>(null);
  const liveRiderNametagRef = useRef(liveRiderNametag);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const mapShellRef = useRef<HTMLDivElement>(null);
  const routePickDockLayerRef = useRef<HTMLDivElement>(null);
  /** 경로 설정 표면(팝업·도크·원)을 한 번에 닫는다 — 아래 pick 효과가 채우고 주행 시작이 부른다 */
  const closePickSurfacesRef = useRef<(() => void) | null>(null);
  const routePickDockPositionRef = useRef<{ left: number; top: number } | null>(null);
  const routePickDockDragCleanupRef = useRef<(() => void) | null>(null);
  const routePickDockResizeHandlerRef = useRef<(() => void) | null>(null);
  const routePickDockDraggingRef = useRef(false);
  const routePickDockPanelRef = useRef<HTMLDivElement | null>(null);
  const openRoutePickAtRef = useRef<((lngLat: LngLat) => void) | null>(null);
  const routeGeometryRef = useRef<LineStringGeometry | null>(null);
  /**
   * 궤적/경로선 강조 — 단계마다 주인공이 다르다(`lib/conquest/conquestLayerEmphasis`).
   * ref 로 두는 이유: 레이어 적용이 `style.load`·`idle` 콜백 안에서도 일어나 최신 값이 필요하다.
   */
  const conquestEmphasisRef = useRef(
    conquestLayerEmphasis({ rideActive: false, hasRoute: false }),
  );
  conquestEmphasisRef.current = conquestLayerEmphasis({
    rideActive,
    hasRoute: Boolean(routeGeometry?.coordinates?.length),
  });
  const routeDistanceMetersRef = useRef(routeDistanceMeters);
  const liveLngLatRef = useRef<LngLat | null>(null);
  const sampleLiveLngLatRef = useRef(sampleLiveLngLat);
  const liveRiderMotionRef = useRef(liveRiderMotion);
  const followModeRef = useRef(followMode);
  const mapZoomRef = useRef(mapZoom);
  /** 주행 카메라 거리(m) — 개발용 거리 슬라이더 최신값, rAF 루프에서 참조 */
  const rideCameraDistanceMRef = useRef(rideCameraDistanceM);
  const lockBaseHeadingRef = useRef(lockBaseHeading);
  const rideCameraSpanFloorModeRef = useRef(rideCameraSpanFloorMode);
  const onRideCameraDistanceFromUserZoomRef = useRef(onRideCameraDistanceFromUserZoom);
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
  const userMileageRef = useRef({
    totalMeters: userMileageTotalMeters,
    totalSec: userMileageTotalSec,
  });
  userMileageRef.current = { totalMeters: userMileageTotalMeters, totalSec: userMileageTotalSec };
  const onPreviewDistanceAutoRouteCircleRef = useRef(onPreviewDistanceAutoRouteCircle);
  const onClearDistanceAutoRouteCircleRef = useRef(onClearDistanceAutoRouteCircle);
  const onSetRouteProfileOnlyRef = useRef(onSetRouteProfileOnly);
  const onAutoRouteMapPickRef = useRef(onAutoRouteMapPick);
  const onRetryDistanceAutoRouteRef = useRef(onRetryDistanceAutoRoute);
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
    lockBaseHeadingRef.current = lockBaseHeading;
  }, [lockBaseHeading]);

  useEffect(() => {
    rideCameraSpanFloorModeRef.current = rideCameraSpanFloorMode;
  }, [rideCameraSpanFloorMode]);

  useEffect(() => {
    onRideCameraDistanceFromUserZoomRef.current = onRideCameraDistanceFromUserZoom;
  }, [onRideCameraDistanceFromUserZoom]);

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

  /*
   * 주행이 시작되면 경로 설정 표면을 접는다(2026-09-18 Chief) — 팝업·도크를 닫고 목표 거리
   * 원과 방향 클릭 임시 표시를 치운다. `finalizePickClose` 하나가 그 넷을 모두 정리하므로
   * 여기서 따로 손으로 지우지 않는다(두 벌로 만들면 한쪽만 고쳐지는 사고가 난다).
   * 거리 기반 세션 자체는 `useDistanceAutoRoute` 가 같은 신호로 끊는다.
   */
  useEffect(() => {
    if (!rideActive) return;
    closePickSurfacesRef.current?.();
  }, [rideActive]);

  useEffect(() => {
    const key = startLngLat ? `${startLngLat[0]},${startLngLat[1]}` : null;
    if (prevStartLngLatKeyRef.current != null && key !== prevStartLngLatKeyRef.current) {
      clearAutoRouteClickDebugMarkerRef.current();
    }
    prevStartLngLatKeyRef.current = key;
  }, [startLngLat]);

  const coverageOverlayModeRef = useRef(coverageOverlayMode);
  coverageOverlayModeRef.current = coverageOverlayMode;

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
    const bootCenter: [number, number] =
      initialCenter &&
      Number.isFinite(initialCenter[0]) &&
      Number.isFinite(initialCenter[1])
        ? [initialCenter[0], initialCenter[1]]
        : DEFAULT_CENTER;
    const bootZoom =
      typeof initialZoom === "number" && Number.isFinite(initialZoom)
        ? initialZoom
        : DEFAULT_ZOOM;
    const map = new mapboxgl.Map({
      container: el,
      style: initialMapStyleRef.current,
      center: bootCenter,
      zoom: bootZoom,
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
    if (typeof window !== "undefined") {
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

    /** 지시06 — 사용자 기원 zoom → 거리 역산(팔로우 tick 이 덮지 않도록) */
    let userZoomGesture = false;
    const onUserZoomStart = (e: mapboxgl.MapboxEvent & { originalEvent?: Event }) => {
      if (e.originalEvent) userZoomGesture = true;
    };
    const onUserZoomEnd = () => {
      if (!userZoomGesture) return;
      userZoomGesture = false;
      if (isFollowCameraJump()) return;
      const mode = followModeRef.current;
      const session = liveRiderMotionRef.current?.sessionStatus;
      const following =
        (session === "running" || session === "paused") && mode !== "free";
      const z = map.getZoom();
      // 거리 없는 모드(topDown·north·keep…): 앱 mapZoom 을 사용자 줌에 맞춰 tick fallback 이 따라가게
      if (following && (mode === "topDown" || mode === "north" || mode === "keep")) {
        mapZoomRef.current = z;
        onMapZoomRef.current?.(Number(z.toFixed(1)));
        return;
      }
      // 밀착/Aerial — 거리 역산
      if (
        following &&
        (mode === "forward" ||
          mode === "backward" ||
          mode === "left" ||
          mode === "right" ||
          mode === "aerial")
      ) {
        const vp = viewportPxFromMap(map);
        const c = map.getCenter();
        const pitchDeg = mode === "aerial" ? 0 : resolveRideCameraPitchClose();
        const dist = distanceMFromRideFollowZoom({
          zoom: z,
          pitchDeg,
          latDeg: c.lat,
          viewportWidthPx: vp.width,
          viewportHeightPx: vp.height,
        });
        if (!(dist > 0) || !Number.isFinite(dist)) return;
        // 상한만 느슨히 — 하한(floor)은 userZoom 경로에서 적용하지 않음(B1)
        const capped = Math.min(dist, RIDE_CAMERA_DISTANCE_MAX_M * 2);
        rideCameraDistanceMRef.current = capped;
        rideCameraSpanFloorModeRef.current = "userZoom";
        onRideCameraDistanceFromUserZoomRef.current?.(capped);
        // smooth.zoom 을 현재에 맞춰 급격한 lerp 되돌림 완화
        cameraSmoothRef.current.zoom = z;
      }
      // free(Route Fit): reportMapZoomToApp 가 shouldSync=true 로 이미 앱 줌을 맞춘다
    };
    map.on("zoomstart", onUserZoomStart);
    map.on("zoomend", onUserZoomEnd);

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
      forgetActivityWorldLayerOrder(map);
      const latestRoute = routeGeometryRef.current;
      if (latestRoute?.coordinates?.length) {
        const routeFeature = {
          type: "Feature" as const,
          properties: {} as Record<string, never>,
          geometry: latestRoute,
        };
        if (!map.getSource("route")) {
          map.addSource("route", { type: "geojson", data: routeFeature });
          addRouteLine(map, routeLayerInsertBefore(map));
        }
      }
      if (shouldMoveActivityWorldLayersToTop()) {
        moveActivityWorldLayersToTop(map);
      }
      apply3DState(map, enable3DRef.current, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
      if (RIDER_PROTOTYPE_MODE === "glb") {
        clearRiderGlbModels(map);
        ensureRiderGlbLayer(map);
      } else if (RIDER_PROTOTYPE_MODE === "preserved") {
        clearRiderPreservedModels(map);
        ensureRiderPreservedLayer(map);
      }
      if (import.meta.env.DEV) applyTickTestToMap(map);
      try {
        applyCoverageOverlayMode(
          map,
          coverageOverlayModeRef.current,
        );
      } catch (e) {
        console.warn("[MapView] coverage overlay", e);
      }
      /** 스타일 리로드 시 기존 동행 DOM 마커 제거 후 시뮬 타깃만 재병합(동행은 GeoJSON이 아닌 Marker 로 표시) */
      glbLiveNametagMarkerRef.current?.remove();
      glbLiveNametagMarkerRef.current = null;
      glbLiveNametagElRef.current = null;
      selfLocationMarkerRef.current?.remove();
      selfLocationMarkerRef.current = null;
      selfLocationBearingRef.current = null;
      selfLocationGeoBearingRef.current = null;
      const selfLl = liveLngLatRef.current;
      if (selfLl) {
        const mounted = mountSelfLocationMarker(map, selfLl);
        selfLocationMarkerRef.current = mounted.marker;
        selfLocationBearingRef.current = mounted.bearingEl;
      }
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

    closePickSurfacesRef.current = () => finalizePickClose();

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
        getUserMileage: () => ({
          totalMeters: userMileageRef.current.totalMeters,
          totalSec: userMileageRef.current.totalSec,
        }),
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

      /**
       * 자동 Route 결과를 popup 에 반영하는 **단일 경로**.
       *
       * 지도 클릭과 「거리 조정 재탐색」이 서로 다른 코드를 타서, 재탐색 쪽만 popup 갱신을
       * 건너뛰었다 — 그래서 조정 성공 뒤에도 `offered` 문구가 남고(결함 ③) 슬라이더가 옛
       * 값 그대로였다(결함 ②). 두 진입점이 이 함수를 함께 쓴다.
       */
      function applyAutoRoutePickResultToPopup(
        result: { status: "found" | "failed"; message: string } | null,
      ): void {
        if (!result) return;
        const ui = pickPopupAutoRouteUiRef.current;
        if (result.status === "found") {
          ui?.setInlinePhase("found", result.message);
          return;
        }
        ui?.setInlinePhase("failed", result.message);
        onRetryDistanceAutoRouteRef.current?.();
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
            applyAutoRoutePickResultToPopup(result);
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
      map.off("zoomstart", onUserZoomStart);
      map.off("zoomend", onUserZoomEnd);
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
      selfLocationMarkerRef.current?.remove();
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
      selfLocationMarkerRef.current = null;
      selfLocationBearingRef.current = null;
      selfLocationGeoBearingRef.current = null;
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
      addRouteLine(map, routeLayerInsertBefore(map));
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
      // 고정 padding 은 폰 가로에서 뷰포트의 54 % 를 먹는다(5A-R1 §4.1 실측).
      padding: resolveRideFitPadding(
        map.getContainer().clientWidth,
        map.getContainer().clientHeight,
      ),
      maxZoom: 16,
      duration: prefersReducedMotion ? 0 : 1100,
      essential: true,
    });

    if (map.isStyleLoaded()) {
      try {
        applyCoverageOverlayMode(
          map,
          coverageOverlayModeRef.current,
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

    /** 안내 원 하나 = D (5A-R2c §2). 파선. 도넛(두 번째 링·채움) 없음. */
    const feature = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: distanceTargetCircle,
        },
      ],
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
  }, [
    mapLoaded,
    distanceTargetCircle,
    distanceTargetCircleFitToken,
    prefersReducedMotion,
  ]);

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
  }, [mapLoaded, coverageOverlayMode]);

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
        if (!map.getLayer(CONQUEST_TRACES_HALO_LAYER)) {
          // 줌아웃 LOD — 본선보다 먼저(아래) 추가한다. 순서는 아래에서 다시 세운다.
          map.addLayer({
            id: CONQUEST_TRACES_HALO_LAYER,
            type: "line",
            source: CONQUEST_TRACES_SRC,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { ...RTW_TRACE_ACCUMULATED_HALO_PAINT },
          });
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
        applyConquestEmphasis(map, conquestEmphasisRef.current);
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
      applyConquestEmphasis(map, conquestEmphasisRef.current);
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
      if (!RIDER_PROTOTYPE_IS_3D && !liveMarkerRef.current) {
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
      } else if (RIDER_PROTOTYPE_MODE === "preserved") {
        clearRiderPreservedModels(map);
      }
    }

    if (!RIDER_PROTOTYPE_IS_3D) {
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

  /** Self-location — 화면 고정 px dot. live nametag·GLB 라이더와 별 요소, `liveLngLat`(=liveForMap) 좌표만 재사용 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (liveLngLat) {
      if (!selfLocationMarkerRef.current) {
        const mounted = mountSelfLocationMarker(map, liveLngLat);
        selfLocationMarkerRef.current = mounted.marker;
        selfLocationBearingRef.current = mounted.bearingEl;
      } else {
        selfLocationMarkerRef.current.setLngLat(liveLngLat);
      }
    } else {
      selfLocationMarkerRef.current?.remove();
      selfLocationMarkerRef.current = null;
      selfLocationBearingRef.current = null;
      selfLocationGeoBearingRef.current = null;
    }
  }, [liveLngLat, mapLoaded]);

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
        if (liveMarkerRef.current && !RIDER_PROTOTYPE_IS_3D) {
          liveMarkerRef.current.setLngLat(sampled);
        }
        if (selfLocationMarkerRef.current) {
          selfLocationMarkerRef.current.setLngLat(sampled);
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
          lockBaseHeading: lockBaseHeadingRef.current,
          spanFloorMode: rideCameraSpanFloorModeRef.current,
          sessionStatus: liveRiderMotionRef.current?.sessionStatus,
          routeGeometry: routeGeometryRef.current,
          prevLiveRef: prevLiveRef,
          smooth: cameraSmoothRef.current,
          suppressUntilMs: suppressCameraFollowUntilRef.current,
          nowMs: now,
        });
        if (selfLocationMarkerRef.current) {
          const geoBearingDeg = resolveRiderBearingDeg(
            routeGeometryRef.current,
            sampled,
            prevForBearing,
          );
          selfLocationGeoBearingRef.current = geoBearingDeg;
          updateSelfLocationMarkerViewportBearing(
            selfLocationBearingRef.current,
            geoBearingDeg,
            map.getBearing(),
          );
        }
        if (import.meta.env.DEV) {
          const headingDeg = resolveRiderBearingDeg(
            routeGeometryRef.current,
            sampled,
            prevForBearing,
          );
          publishRiderScreenDiag(measureRiderScreenDiag(map, sampled, headingDeg));
        }
      } else if (selfLocationMarkerRef.current && selfLocationGeoBearingRef.current != null) {
        updateSelfLocationMarkerViewportBearing(
          selfLocationBearingRef.current,
          selfLocationGeoBearingRef.current,
          map.getBearing(),
        );
      }

      const showPeerSprites = mapZoomRef.current > MAP_PEER_SPRITE_MIN_ZOOM;
      /*
       * 2026-09-27 — 종전에는 계산을 다 하고 결과만 버렸다(`showPeerSprites ? fc : EMPTY`).
       * 게이트를 계산 **앞**으로 넘긴다. 위치 적분은 안에서 언제나 돌므로,
       * 다시 그릴 때 동행이 제자리로 뛰지 않는다.
       */
      const fc = stepPeerDriveAndBuildGeoJson(
        null,
        dt,
        getBearing,
        routeGeometryRef.current,
        Date.now(),
        { buildFeatures: showPeerSprites },
      );
      syncPeerDomMarkers(map, fc.features as PeerDomGJFeature[], peerDomMarkersRef);
      const riderLayerReady =
        RIDER_PROTOTYPE_MODE === "glb"
          ? ensureRiderGlbLayer(map)
          : RIDER_PROTOTYPE_MODE === "preserved"
            ? ensureRiderPreservedLayer(map)
            : false;
      if (RIDER_PROTOTYPE_IS_3D && riderLayerReady) {
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
            phaseRev: liveCrankPhaseRevRef.current,
            leanDeg: glbLeanDegRef.current,
          });
        }
        for (const f of fc.features as PeerDomGJFeature[]) {
          // 연속 위상을 그대로 쓴다 — 종전에는 6단계 `pframe` 을 다시 6으로 나눠
          // 동행의 페달만 계단으로 움직였다(본인 라이더는 연속값).
          const phaseRev = f.properties.phaseRev;
          specs.push({
            id: f.properties.id,
            lngLat: f.geometry.coordinates,
            bearingDeg: f.properties.hdg,
            pedalPose: resolveGlbPedalPose(phaseRev),
            phaseRev,
          });
        }
        if (RIDER_PROTOTYPE_MODE === "glb") syncRiderGlbModels(map, specs);
        else syncRiderPreservedModels(map, specs);
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

  /** GLB 네임태그·self-location — 3D terrain·카메라 이동 시 DOM 마커 재투영 */
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current;
    if (!map) return;
    const onRender = () => {
      if (RIDER_PROTOTYPE_IS_3D) {
        reprojectGlbNametagMarkers(glbLiveNametagMarkerRef.current, peerDomMarkersRef.current);
      }
      const selfMk = selfLocationMarkerRef.current;
      if (selfMk) {
        const ll = selfMk.getLngLat();
        selfMk.setLngLat([ll.lng, ll.lat]);
        const geo = selfLocationGeoBearingRef.current;
        if (geo != null) {
          updateSelfLocationMarkerViewportBearing(
            selfLocationBearingRef.current,
            geo,
            map.getBearing(),
          );
        }
      }
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
      screenUpBearing: nextCamera.bearing,
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
          {/* 한도 초과(429)를 따로 적는다 — 이게 뭉개지면 다음에도 코드 회귀로 오인한다. */}
          <div className="elevation-overlay__empty">
            {elevation.quotaExceeded
              ? "고도 API 일일 한도 초과 — 내일 다시 시도됩니다."
              : "고도 데이터를 불러오지 못했습니다."}
          </div>
        </div>
      ) : null}
      {elevationUi ? (
        <div className="elevation-overlay">
          {/* 시점/종점 — 화면 하단 코칭 멘트 줄(`.hud-coach`, MapHud.css)과 같은 세로 높이로
              절대배치한다(CSS, 2026-09-24 지시03). 코칭 멘트 유무와 무관하게 고정 높이여야
              하므로 실제 코치 DOM 이 아니라 그 줄의 `bottom` 값을 복제해 쓴다 — 가로는 기존처럼
              좌(시점)·우(종점) 끝 그대로. */}
          <div className="elevation-overlay__meta">
            <span>시점 {elevationUi.startMeters.toFixed(0)}m</span>
            <span>종점 {elevationUi.endMeters.toFixed(0)}m</span>
          </div>
          {/* viewBox 는 420x100 인데 실제 렌더는 비균등 비율(preserveAspectRatio="none")이라
              SVG <text> 로 라벨을 쓰면 가로로 눌려 찌그러진다. 라벨은 SVG 밖 HTML 요소로
              같은 박스에 겹쳐서(% 좌표) 절대배치한다 — 그래서 svg 와 라벨을 __plot 으로 함께 감싼다.
              (2026-09-24 지시03) 「시점/종점」 메타 행이 코칭 멘트 줄 높이로 내려가면서, 라벨이
              점 위로 뺄 때 메타 행을 침범하던 문제 자체가 없어졌다 — yPct<20 뒤집기(`--below`)를
              제거했다. 라벨은 이제 항상 점 위에 뜬다(가로 앵커만 남음, 아래). */}
          <div className="elevation-overlay__plot">
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
                stroke={ELEVATION_LINE_COLOR}
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
            {elevationUi.marker ? (
              <span
                className={`elevation-overlay__progress${
                  elevationUi.marker.xPct < 15
                    ? " elevation-overlay__progress--start"
                    : elevationUi.marker.xPct > 85
                      ? " elevation-overlay__progress--end"
                      : ""
                }`}
                style={{
                  // "N% covered" 라벨은 폭이 약 60px 로 커져(구 "N%" 는 ~17px), 예전처럼
                  // 4~96% 로 left 를 클램프하면 경로 시작·끝 부근에서 라벨이 점에서 30px 가까이
                  // 떨어져 보인다(클램프를 더 키워도 더 떨어질 뿐). 그래서 클램프 대신 CSS 쪽
                  // 앵커 전환(--start/--end)으로 처리한다 — left 는 xPct 그대로 쓴다.
                  left: `${elevationUi.marker.xPct}%`,
                  top: `${elevationUi.marker.yPct}%`,
                }}
              >
                {elevationUi.marker.progressPct}% covered
              </span>
            ) : null}
            {/* 종점 깃발 — 이모지(🏁)는 색을 바꿀 수 없어 인라인 SVG 로 그린다(2026-09-17 Chief).
                깃대 밑동이 종점에 정확히 앉아야 하므로 깃대를 SVG 오른쪽 끝에 두고
                `translate(-100%, -100%)` 로 span 의 우하단을 종점에 맞춘다. 천은 왼쪽으로
                뻗는다 — 종점이 플롯 오른쪽 끝(xPct 98%)이라 오른쪽으로 뻗으면 박스를 넘는다. */}
            <span
              className="elevation-overlay__finish"
              style={{ left: `${elevationUi.endPoint.xPct}%`, top: `${elevationUi.endPoint.yPct}%` }}
              aria-hidden
            >
              <svg viewBox="0 0 13 14" width="13" height="14">
                <path
                  d="M11.9 1V14"
                  stroke={ELEVATION_LINE_COLOR}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path d="M11.15 1.6 L3 4.2 L11.15 6.8 Z" fill={ELEVATION_LINE_COLOR} />
              </svg>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
