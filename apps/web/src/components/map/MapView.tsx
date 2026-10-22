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
import {
  DISTANCE_AUTO_ROUTE_REFERENCE_CIRCLE_HINT,
  buildCircleRadialArrowsFromLineString,
} from "../../lib/route/distanceAutoRoute";
import { pulseDistanceCircle } from "../../lib/map/distanceCircleAttention";
import { DISTANCE_AUTO_ROUTE_DEFAULT_KM } from "../../lib/route/distanceAutoRouteErrors";
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
  installRiderMapPixelRatioCap,
  resetRtwStyleSnapshot,
  RTW_MAP_STYLE_URL,
  RTW_TRACE_ACCUMULATED_HALO_PAINT,
  RTW_TRACE_ACCUMULATED_PAINT,
  RTW_TRACE_LIVE_GLOW_PAINT,
  RTW_TRACE_LIVE_PAINT,
} from "../../lib/map/rtwMapConfig";
import { conquestLayerEmphasis } from "../../lib/conquest/conquestLayerEmphasis";
import { applyMapCutToMap, getMapCutKeys } from "../../lib/map/mapCut";
import { getRideLabelsController } from "../../lib/map/rideLabels";
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
} from "../../lib/debug/mapTickProbe";
import { isFollowCameraJump } from "./followCameraJump";
import {
  attachMapRenderProbe,
  noteRiderJitterFrame,
  openFrameBreakdownTick,
} from "../../lib/debug/perfLabFacade";
import { installCameraRenderPhaseHook } from "../../lib/camera/cameraRenderPhase";
import type { LngLat, LineStringGeometry } from "../../lib/geo/geo";
import {
  boundsFromLineCoordinates,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatLateral,
  resolveRiderBearingDeg,
  smoothedCurveHeadingAtRouteDistanceMeters,
  smoothedRoutePoint,
} from "../../lib/geo/geo";
import { splitLineStringAtMeters } from "../../lib/route/routeProgressSplit";
import type { RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import type { FollowMode } from "../../lib/map/mapGlobeView";
import {
  getRouteTokenInsufficient as isRouteTokenBlocked,
} from "../../lib/account/routeTokenSpendBridge";
import type { CoverageOverlayMode } from "../../lib/activity/coverageOverlayMode";
import type { RouteProfile } from "../../services/mapboxDirections";
import { resolvePedalCrankRpm } from "../../lib/sensor/crankRpm";
import { resolveGlbPedalPose } from "../../lib/rider/riderGlbPedalPose";
import {
  RIDER_CURVE_HALF_SPAN_M,
  RIDER_TURN_HEADING_TAU_ROUTE_S,
  RIDER_TURN_HEADING_TAU_S,
  RiderTurnSmoother,
} from "../../lib/rider/riderTurn";
import { stepPeerDriveAndBuildGeoJson } from "../../lib/peerMotion/peerRidersDrive";
import { companionDisplayDelayMs, getPeerMotionRegistry, resetPeerMotionRegistry } from "../../lib/peerMotion";
import {
  createPacerWorld,
  enteredPacers,
  pacerSpeedMps,
  resolvePacerDistM,
  stepPacerWorld,
  type PacerWorld,
} from "../../lib/ride/pacer/pacerMotion";
import { MAP_PEER_SPRITE_MIN_ZOOM } from "../../lib/ride/rideSyncPolicy";
import { applyCoverageOverlayMode } from "../../services/coverageOverlaySync";
import type { GlobalLivePresenceDot } from "../../hooks/useGlobalLivePresence";
import type { TrailSpectatorDot } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";
import {
  getRiderPrototypeMode,
  isRiderPrototype3dMode,
} from "../../lib/riderPrototype/config";
import {
  createIso2dRiderMarkerRoot,
  type RiderGlbModelSpec,
} from "../../lib/riderPrototype/iso2dMarker";
import { clearRiderGlbModels, ensureRiderGlbLayer, syncRiderGlbModels } from "../../lib/riderPrototype/glbModelLayer";
import {
  clearRiderPreservedModels,
  ensureRiderPreservedLayer,
  syncRiderPreservedModels,
} from "../../lib/map/riderPreservedLayer";
import { MapCameraAltitudeControl } from "./MapCameraAltitudeControl";
import { createFixedScaleBoxControl, isMapAttachedToContainer } from "./mapViewControls";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  subscribeReducedMotion,
} from "./mapViewReducedMotion";
import { mountSelfLocationMarker, syncLiveSelfRiderVisual } from "./mapViewSelfRider";
import { useAssignRef } from "./useAssignRef";

import {
  computeRideFollowFraming,
  RIDE_FOLLOW_NO_PADDING,
  distanceMFromRideFollowZoom,
  measureRiderScreenDiag,
  publishRiderScreenDiag,
  RIDE_HUD_SAFE_PADDING,
  viewportPxFromMap,
  resolveRideFitPadding,
} from "../../lib/camera/rideCameraFraming";
import {
  MAP_GLOBE_MIN_ZOOM,
  MAP_ZOOM_SLIDER_MAX,
  RIDE_FOLLOW_CAMERA_MODE,
  RIDE_CAMERA_DISTANCE_DEFAULT_M,
  RIDE_CAMERA_DISTANCE_MIN_M,
  RIDE_CAMERA_DISTANCE_MAX_M,
  resolveRideCameraPitchClose,
} from "../../lib/map/mapGlobeView";
import {
  MAP_FALLBACK_CENTER,
  MAP_FALLBACK_ZOOM,
  resolveEntryLocationFlightMs,
} from "../../lib/map/mapBootCenter";
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
import {
  shouldEaseNorthUpOnRideActiveChange,
  easeMapNorthUpAfterRideEnd,
  isSameRouteLine,
  RIDE_END_NORTH_UP_DURATION_MS,
} from "../../lib/map/rideEndNorthUp";
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
  pickPickPopupAnchor,
  tryOpenActivityWorldPinPopup,
  type PickPopupAutoRouteUi,
} from "./mapPopupElements";
import {
  attachMapRoutePickGesture,
  type MapRoutePickCommit,
} from "./mapRoutePickGesture";
import {
  addRouteLine,
  applyConquestEmphasis,
  CONQUEST_LIVE_GLOW_LAYER,
  CONQUEST_LIVE_LAYER,
  CONQUEST_LIVE_SRC,
  type ConquestDisplayMode,
  CONQUEST_RECENT_NEW_GLOW_LAYER,
  CONQUEST_RECENT_NEW_GLOW_PAINT,
  CONQUEST_RECENT_NEW_LAYER,
  CONQUEST_RECENT_NEW_PAINT,
  CONQUEST_RECENT_NEW_SRC,
  CONQUEST_TRACES_HALO_LAYER,
  CONQUEST_TRACES_LAYER,
  CONQUEST_TRACES_SRC,
  ROUTE_LINE_COLOR,
} from "./routeConquestLayers";
import { RouteElevationOverlay } from "./RouteElevationOverlay";
import { useMapPinMarkers } from "./useMapPinMarkers";



const EMPTY_ACTIVITY_WORLD_RAW: ActivityWorldRawOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};


/** 지역 초기값이 없을 때의 첫 지도 — 로마 콜로세움 주변. `initialCenter`/`initialZoom` 이 있으면 그쪽이 우선. */
const DEFAULT_CENTER: [number, number] = [MAP_FALLBACK_CENTER[0], MAP_FALLBACK_CENTER[1]];
const DEFAULT_ZOOM = MAP_FALLBACK_ZOOM;

import {
  PIN_MARKER_VIEWPORT_ALIGNMENT,
  RIDER_ROUTE_MARKER_OFFSET_PX,
  reprojectGlbNametagMarkers,
  setMarkerLngLatIfChanged,
  syncGlbLiveNametagMarker,
  syncPeerDomMarkers,
  type PeerDomGJFeature,
} from "./riderDomMarkers";

export type { LiveRiderMotion } from "./mapViewTypes";

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
  sampleLiveLngLat?: (frameEpochMs?: number) => LngLat | null;
  /** `sampleLiveLngLat` 과 같은 경로 거리. 페이서 배치용. */
  sampleLiveDistM?: (frameEpochMs?: number) => number | null;
  /** 혼자 달릴 때 로컬 페이서. 기본 켜짐. */
  pacerEnabled?: boolean;
  /** 내 위치 마커 페달 애니메이션(주행/일시정지·가상 속도). 없으면 스프라이트만 정지 표시 */
  liveRiderMotion?: LiveRiderMotion | null;
  /** 주행 중 내 머리 위 표시(닉네임·guest1 등). 없으면 태그 숨김 */
  liveRiderNametag?: string | null;
  mapStyle: string;
  mapZoom: number;
  followMode: FollowMode;
  enable3D: boolean;
  onMapZoom: (zoom: number) => void;
  /**
   * HUD 줌 ± — 맵 실측 zoom+delta 를 즉시 적용(App mapZoom↔idle sync 경합·반대 jump 회피).
   * `requestId` 가 바뀔 때마다 1회.
   */
  mapZoomStepRequest?: { requestId: number; delta: number } | null;
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
  /** 내 도로망 표시 모드 — 전체 또는 최근 신규 도로 중심 */
  conquestDisplayMode?: ConquestDisplayMode;
  /** Conquest — 이번 주행 진행 거리(m). 진행 구간을 실시간으로 칠한다. null=비주행 */
  conquestLiveTraveledMeters?: number | null;
  /** Conquest — 최근 주행에서 새로 인정된 도로. 메모리 전용 임시 강조 */
  conquestRecentNewRoad?: readonly LineStringGeometry[] | null;
  /** 지도 지점 선택 팝업에서 출발·도착·경유·계산 경로 전체 초기화 */
  onClearRoute?: () => void;
  onStartRide?: () => void;
  canStartRide?: boolean;
  /** OSRM(Mapbox Streets) 도로 커버리지 */
  coverageOverlayMode: CoverageOverlayMode;
  /** 메뉴 지명 검색 등 — `requestId`가 바뀔 때마다 한 번 카메라 이동 (`bbox` 있으면 도시 단위 fitBounds) */
  externalCameraJump?: {
    lngLat: LngLat;
    zoom?: number;
    requestId: number;
    bbox?: [number, number, number, number] | null;
  } | null;
  /** 외부 카메라 이동이 끝난 뒤 requestId 를 알린다. */
  onExternalCameraSettled?: (requestId: number) => void;
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
   * 지도 최초 생성 중심. 생략 시 콜로세움 주변 폴백.
   * 생성 후에는 쓰지 않는다 — 재점프 금지.
   */
  initialCenter?: LngLat | null;
  /** 최초 줌. 생략 시 MAP_FALLBACK_ZOOM(15). */
  initialZoom?: number | null;
  /** true 인 동안 시작 지역을 유지한다. 위치 목적지가 정해지면 이동한다. */
  bootFlyHold?: boolean;
  /** 부트 확대 목적지. 이동을 시작하기 전까지만 반영한다. */
  bootFlyTarget?: { center: [number, number]; zoom: number } | null;
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
  /** 활성 QC 슬롯 — 제품 카메라 튜닝표 적용 */
  activeQuickCamera?: 1 | 2 | 3 | 4 | 5 | 6 | null;
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
  sampleLiveDistM,
  pacerEnabled = true,
  liveRiderMotion,
  liveRiderNametag,
  mapStyle,
  mapZoom,
  followMode,
  enable3D,
  onMapZoom,
  mapZoomStepRequest = null,
  onSelectPoint,
  routeProfile,
  onRouteProfile,
  routeTokenInsufficient = false,
  conquestTraces = null,
  conquestDisplayMode = "all",
  conquestLiveTraveledMeters = null,
  conquestRecentNewRoad = null,
  onClearRoute,
  onStartRide,
  canStartRide = false,
  coverageOverlayMode,
  externalCameraJump = null,
  openRoutePickRequest = null,
  placeSearchMarkerLngLat = null,
  resumeAnchor = null,
  initialCenter = null,
  initialZoom = null,
  bootFlyHold = false,
  bootFlyTarget = null,
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
  activeQuickCamera = null,
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
  autoRouteTargetKm = DISTANCE_AUTO_ROUTE_DEFAULT_KM,
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
  const autoRouteClickDebugMarkerRef = useRef<mapboxgl.Marker | null>(null);
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
  const routePickHintRef = useRef<HTMLDivElement | null>(null);
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
  const sampleLiveDistMRef = useRef(sampleLiveDistM);
  const pacerEnabledRef = useRef(pacerEnabled);
  const pacerWorldRef = useRef<PacerWorld | null>(null);
  const pacerPrevStatusRef = useRef<string | null>(null);
  const pacerDiagRef = useRef({
    enabled: false,
    visible: false,
    count: 0,
    gaps: [] as number[],
  });
  const liveRiderMotionRef = useRef(liveRiderMotion);
  const followModeRef = useRef(followMode);
  const mapZoomRef = useRef(mapZoom);
  /** 첫 지도 연출의 확대 목표. 확대를 시작했거나 취소되면 null. */
  const bootFlyTargetRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const bootFlyTargetPropRef = useRef(bootFlyTarget);
  bootFlyTargetPropRef.current = bootFlyTarget;
  /** 부트 이동을 시작했거나 제스처·명시 카메라가 취소하면 다시 덮지 않는다. */
  const bootFlyMovedRef = useRef(false);
  /** 주행 카메라 거리(m) — 개발용 거리 슬라이더 최신값, rAF 루프에서 참조 */
  const rideCameraDistanceMRef = useRef(rideCameraDistanceM);
  const lockBaseHeadingRef = useRef(lockBaseHeading);
  const activeQuickCameraRef = useRef(activeQuickCamera);
  const rideCameraSpanFloorModeRef = useRef(rideCameraSpanFloorMode);
  const onRideCameraDistanceFromUserZoomRef = useRef(onRideCameraDistanceFromUserZoom);
  const prefersReducedMotionRef = useRef(false);
  const enable3DRef = useRef(enable3D);
  /** 본인·동행·페이서의 화면 방향·기울기. 라이더 id 하나당 상태 하나. */
  const riderTurnRef = useRef(new RiderTurnSmoother());
  /** 동행 feature 에 속도가 없을 때, 직전 경로 거리. */
  const peerTurnDistPrevRef = useRef(new Map<string, number>());
  const initialMapStyleRef = useRef(mapStyle);
  const currentStyleRef = useRef(mapStyle);
  const onSelectPointRef = useRef(onSelectPoint);
  const routeWaypointsRef = useRef(routeWaypoints);
  const startLngLatRef = useRef(startLngLat);
  const endLngLatRef = useRef(endLngLat);
  const routeProfileRef = useRef(routeProfile);
  const onRouteProfileRef = useRef(onRouteProfile);
  const routeTokenInsufficientRef = useRef(routeTokenInsufficient);
  const onClearRouteRef = useRef(onClearRoute);
  const onArmDirectionPickRef = useRef(onArmDirectionPick);
  const pickPopupAutoRouteUiRef = useRef<PickPopupAutoRouteUi | null>(null);
  const rideStartRef = useRef({onStartRide, canStartRide});
  useEffect(() => {
    rideStartRef.current = {onStartRide, canStartRide};
    pickPopupAutoRouteUiRef.current?.syncRideStart();
  }, [onStartRide, canStartRide]);
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
  const conquestDisplayModeRef = useRef(conquestDisplayMode);
  conquestDisplayModeRef.current = conquestDisplayMode;
  const getActivityWorldPinLabelRef = useRef(getActivityWorldPinLabel);
  const prevLiveRef = useRef<LngLat | null>(null);
  /** 지명 검색 flyTo 직후 `liveLngLat` 추적 jumpTo 가 카메라를 되돌리는 것을 막는다 */
  const suppressCameraFollowUntilRef = useRef(0);
  /** 주행 종료 정북 hold — fitBounds·mapZoom props·follow tick 이 중심·줌을 덮지 않게 */
  const prevRideActiveForNorthUpRef = useRef(rideActive);
  const holdCameraAfterRideEndRef = useRef(false);
  const rideEndHeldRouteRef = useRef<LineStringGeometry | null>(null);
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

  /** 핀 마커(출발·도착·장소 검색·재개점·경유지) 생명주기 — A-5b 에서 훅으로 뽑았다. */
  const {
    clearOnMapTeardown: clearPinMarkers,
    showTemporaryPick,
    clearTemporaryPick,
  } = useMapPinMarkers({
    mapRef,
    mapLoaded,
    startLngLat,
    endLngLat,
    placeSearchMarkerLngLat,
    resumeAnchor,
    routeWaypoints,
  });
  /** 지도 초기화 effect 의 정리 구간에서 부른다 — 그 effect 의 의존성을 늘리지 않으려고 ref 로 받는다. */
  const clearPinMarkersRef = useRef(clearPinMarkers);
  useAssignRef(clearPinMarkersRef, clearPinMarkers);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const BUILDING_LAYER_ID = "boxcycle-3d-buildings";
  const TERRAIN_SOURCE_ID = "boxcycle-dem";

  useAssignRef(liveRiderNametagRef, liveRiderNametag);

  useAssignRef(routeGeometryRef, routeGeometry);

  useAssignRef(routeDistanceMetersRef, routeDistanceMeters);

  useAssignRef(liveLngLatRef, liveLngLat);

  useAssignRef(sampleLiveLngLatRef, sampleLiveLngLat);

  useAssignRef(sampleLiveDistMRef, sampleLiveDistM);

  useAssignRef(pacerEnabledRef, pacerEnabled);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const w = window as Window & {
      __rtwPacerDiag?: () => {
        enabled: boolean;
        visible: boolean;
        count: number;
        gaps: number[];
        companionDelayMs: number;
      };
    };
    w.__rtwPacerDiag = () => ({
      enabled: pacerDiagRef.current.enabled,
      visible: pacerDiagRef.current.visible,
      count: pacerDiagRef.current.count,
      gaps: pacerDiagRef.current.gaps.slice(),
      companionDelayMs: companionDisplayDelayMs(),
    });
    return () => {
      delete w.__rtwPacerDiag;
    };
  }, []);

  useAssignRef(liveRiderMotionRef, liveRiderMotion);

  useAssignRef(followModeRef, followMode);

  useEffect(() => {
    // 종료 hold 중에는 App idle 줌 복원이 ref 를 덮지 않게 — follow tick fallback 이 옛 줌으로 뛰지 않음.
    if (holdCameraAfterRideEndRef.current) return;
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

  useAssignRef(lockBaseHeadingRef, lockBaseHeading);
  useAssignRef(activeQuickCameraRef, activeQuickCamera);

  useAssignRef(rideCameraSpanFloorModeRef, rideCameraSpanFloorMode);

  useAssignRef(onRideCameraDistanceFromUserZoomRef, onRideCameraDistanceFromUserZoom);

  useAssignRef(prefersReducedMotionRef, prefersReducedMotion);

  useAssignRef(enable3DRef, enable3D);

  useAssignRef(onSelectPointRef, onSelectPoint);

  useAssignRef(routeWaypointsRef, routeWaypoints);

  useAssignRef(startLngLatRef, startLngLat);

  useAssignRef(endLngLatRef, endLngLat);

  useAssignRef(routeProfileRef, routeProfile);

  useAssignRef(routeTokenInsufficientRef, routeTokenInsufficient);

  useAssignRef(onRouteProfileRef, onRouteProfile);

  useAssignRef(onClearRouteRef, onClearRoute);

  useAssignRef(onArmDirectionPickRef, onArmDirectionPick);

  useAssignRef(onPreviewDistanceAutoRouteCircleRef, onPreviewDistanceAutoRouteCircle);

  useAssignRef(onClearDistanceAutoRouteCircleRef, onClearDistanceAutoRouteCircle);

  useAssignRef(onSetRouteProfileOnlyRef, onSetRouteProfileOnly);

  useAssignRef(onAutoRouteMapPickRef, onAutoRouteMapPick);

  useAssignRef(onRetryDistanceAutoRouteRef, onRetryDistanceAutoRoute);

  useAssignRef(onDismissDistanceAutoRouteRef, onDismissDistanceAutoRoute);

  useAssignRef(autoRouteMapPickRef, autoRouteMapPick);

  useAssignRef(autoRouteSessionActiveRef, autoRouteSessionActive);

  useAssignRef(autoRouteTargetKmRef, autoRouteTargetKm);

  useAssignRef(autoRouteStatusMessageRef, autoRouteStatusMessage);

  useAssignRef(onSuspendAutoRoutePopupPickRef, onSuspendAutoRoutePopupPick);

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

  /**
   * 주행 종료(running|paused → idle) — follow 해제와 같은 신호(`rideActive` false)에서
   * bearing 만 정북(0°)으로 ease. 일시정지(rideActive 유지)에서는 호출되지 않는다.
   * 흐름: App `rideStatus→idle` → `liveRiderMotion=null`·`liveForMap=null`(follow tick 중단)
   * → 이 effect → `easeMapNorthUpAfterRideEnd`.
   * App idle `setMapZoom` 복원은 Chief(중심·줌 유지)와 충돌하므로 hold 로 무시하고,
   * 다음 주행 시작(`rideFollowCameraNonce`)에서 해제한다.
   */
  useEffect(() => {
    const was = prevRideActiveForNorthUpRef.current;
    prevRideActiveForNorthUpRef.current = rideActive;
    if (!shouldEaseNorthUpOnRideActiveChange(was, rideActive)) return;
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const durationMs = prefersReducedMotion ? 0 : RIDE_END_NORTH_UP_DURATION_MS;
    holdCameraAfterRideEndRef.current = true;
    rideEndHeldRouteRef.current = routeGeometryRef.current;
    // hold 동안 follow tick 이 재개되지 않게 — ease 끝나면 짧게 여유.
    suppressCameraFollowUntilRef.current = performance.now() + durationMs + 200;
    const heldZoom = map.getZoom();
    cameraSmoothRef.current.zoom = heldZoom;
    mapZoomRef.current = heldZoom;
    easeMapNorthUpAfterRideEnd(map, { durationMs });
    const smooth = cameraSmoothRef.current;
    smooth.bearing = 0;
    smooth.bearingPrimary = 0;
    // App idle `setMapZoom(preRide)` 와 경합 — held 줌을 다시 올려 mapZoom props 충돌을 없앤다.
    const pushHeldZoom = () => {
      if (!holdCameraAfterRideEndRef.current) return;
      onMapZoomRef.current?.(Number(heldZoom.toFixed(1)));
    };
    pushHeldZoom();
    const t0 = window.setTimeout(pushHeldZoom, 0);
    const t1 = window.setTimeout(pushHeldZoom, 50);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [rideActive, mapLoaded, prefersReducedMotion]);

  useEffect(() => {
    const key = startLngLat ? `${startLngLat[0]},${startLngLat[1]}` : null;
    if (prevStartLngLatKeyRef.current != null && key !== prevStartLngLatKeyRef.current) {
      clearAutoRouteClickDebugMarkerRef.current();
    }
    prevStartLngLatKeyRef.current = key;
  }, [startLngLat]);

  const coverageOverlayModeRef = useRef(coverageOverlayMode);
  coverageOverlayModeRef.current = coverageOverlayMode;

  useAssignRef(onMapZoomRef, onMapZoom);

  useAssignRef(onMapViewportRef, onMapViewport);
  useAssignRef(onMapLodViewportRef, onMapLodViewport);

  useAssignRef(getActivityWorldPinLabelRef, getActivityWorldPinLabel);

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
    // 최초 화면부터 시작 지역을 표시한다. 위치 공유를 기다리는 동안도 지구본으로 축소하지 않는다.
    const pendingBoot = bootFlyTargetPropRef.current;
    const pendingCenter =
      pendingBoot &&
      Number.isFinite(pendingBoot.center[0]) &&
      Number.isFinite(pendingBoot.center[1])
        ? pendingBoot.center
        : bootCenter;
    const pendingZoom =
      pendingBoot && Number.isFinite(pendingBoot.zoom) ? pendingBoot.zoom : bootZoom;
    bootFlyMovedRef.current = false;
    bootFlyTargetRef.current = {
      center: [pendingCenter[0], pendingCenter[1]],
      zoom: pendingZoom,
    };
    /*
     * 고밀도 렌더 상한 (P1): mapbox-gl 3.23.1 의 MapOptions 에는 `pixelRatio` 가 없어
     * 생성자 옵션으로 줄 수 없다 — `installRiderMapPixelRatioCap()` 이 JS 관측 DPR 을
     * min(실측, 상한) 으로 고정하고, Mapbox 내부(`_resizeCanvas`·painter·타일·셰이더)가
     * 그 값을 읽는다. DPR ≤ 2 기기는 min 으로 그대로라 동작이 바뀌지 않는다.
     */
    installRiderMapPixelRatioCap();
    const map = new mapboxgl.Map({
      container: el,
      style: initialMapStyleRef.current,
      center: bootCenter,
      zoom: bootZoom,
      minZoom: MAP_GLOBE_MIN_ZOOM,
      // 주행 밀착 카메라(거리 1~3m)가 zoom 22+를 요구 — 기본 maxZoom 22 클램프 해제
      maxZoom: 24,
    });
    /** 축척: 가변 막대(createFixedScaleBoxControl 래퍼). 고도는 오른쪽 끝 같은 행(CSS). */
    map.addControl(createFixedScaleBoxControl(), "bottom-right");
    map.addControl(new MapCameraAltitudeControl(), "bottom-right");
    mapRef.current = map;
    let stopCircleAttention: (() => void) | undefined;
    const stopDistanceCircleAttention = () => {
      stopCircleAttention?.();
      stopCircleAttention = undefined;
    };
    if (typeof window !== "undefined") {
      (window as Window & { __RTW_MAP__?: mapboxgl.Map }).__RTW_MAP__ = map;
    }
    installCameraRenderPhaseHook(map);
    const detachFrameBreakdown = attachMapRenderProbe(map);

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

    // 사용자가 지도를 직접 움직이면 초기 위치 이동을 취소한다.
    map.on("movestart", (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return;
      bootFlyTargetRef.current = null;
      bootFlyMovedRef.current = true;
    });

    map.on("load", () => {
      setMapLoaded(true);
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
      reportMapViewport();
      reportMapLodViewport();
      syncActivityWorldLayersOnMapRef.current(map);
    });

    /*
     * 팔로우 카메라는 매 프레임 jumpTo 하고, jumpTo 는 moveend·zoomend 를 **동기로** 쏜다.
     * 그때마다 App 상태(중심·span)를 바꾸면 App 이하 전체가 매 프레임 다시 렌더된다 —
     * 2026-10-08 실측 초당 10~27회, 메인 스레드 포화로 화면 떨림·동행 튐. 팔로우 중엔 1초에 1번.
     * (주행 중 중심은 liveForMap 이 우선이고, span 은 카메라 거리가 고정이라 거의 변하지 않는다.)
     */
    const FOLLOW_VIEWPORT_REPORT_MS = 1000;
    let followViewportReportedAt = Number.NEGATIVE_INFINITY;
    const reportMapViewportAfterMove = () => {
      if (!isFollowCameraJump()) {
        reportMapViewport();
        return;
      }
      const t = performance.now();
      if (t - followViewportReportedAt < FOLLOW_VIEWPORT_REPORT_MS) return;
      followViewportReportedAt = t;
      reportMapViewport();
    };

    map.on("moveend", reportMapViewportAfterMove);
    map.on("zoomend", reportMapViewportAfterMove);
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
      // mapcut 측정 스위치 — 쿼리 있을 때만. apply3DState 가 지형·건물을 되살린 뒤라 순서가 중요.
      try {
        applyMapCutToMap(map);
      } catch {
        /* lab 스위치 실패가 주행 지도를 막지 않는다 */
      }
      if (RIDER_PROTOTYPE_MODE === "glb") {
        clearRiderGlbModels(map);
        ensureRiderGlbLayer(map);
      } else if (RIDER_PROTOTYPE_MODE === "preserved") {
        clearRiderPreservedModels(map);
        ensureRiderPreservedLayer(map);
      }
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

    let dockPanelResizeObserver: ResizeObserver | null = null;

    const teardownRoutePickDock = () => {
      dockPanelResizeObserver?.disconnect();
      dockPanelResizeObserver = null;
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
    let activePickController: AbortController | null = null;
    let directionSearchSequence = 0;

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
      activePickController?.abort();
      activePickController = null;
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
      // 결과/토큰 문구의 높이 변화마다 초점 점수를 다시 매겨 창이 이동하지 않게 한다.
      routePickDockPositionRef.current = clamped;
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
      dockPanelResizeObserver?.disconnect();
      dockPanelResizeObserver = new ResizeObserver(onDockResize);
      dockPanelResizeObserver.observe(panel);
    };

    const promotePointPopupToDock = (click: LngLat, ac: AbortController) => {
      const popup = popupRef.current;
      const wrap = popup?.getElement()?.querySelector(".map-view__pick");
      if (!(wrap instanceof HTMLElement)) return;
      wrap.remove();
      mountDockedRoutePanel(wrap, click, ac);
    };

    const openPickSurface = (picked: LngLat, event: mapboxgl.MapMouseEvent, preferredView?: "location" | "distance") => {
      if (routePickDockDraggingRef.current) return;
      const initialRoutePickView = preferredView ?? pickPopupAutoRouteUiRef.current?.getRoutePickView();
      finalizePickClose();
      const ac = new AbortController();
      activePickController = ac;
      const closePopup = () => finalizePickClose(ac);
      const initialHasStart = Boolean(startLngLatRef.current);
      const pickContent = buildPickPopup({
        onStartRide: rideStartRef.current.onStartRide ? () => rideStartRef.current.onStartRide?.() : undefined,
        getCanStartRide: () => rideStartRef.current.canStartRide,
        lngLat: picked,
        getWaypointCount: () => routeWaypointsRef.current.length,
        accessToken: accessToken.trim(),
        signal: ac.signal,
        onSelectPoint: (type, lngLat, slot) => {
          clearTemporaryPick();
          onSelectPointRef.current(type, lngLat, slot);
        },
        initialStart: startLngLatRef.current,
        initialRoutePickView,
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
        onPulseDistanceCircle: () => {
          stopDistanceCircleAttention();
          stopCircleAttention = pulseDistanceCircle(map);
        },
        onStopDistanceCirclePulse: stopDistanceCircleAttention,
        onGenerateDistanceRoute: (point) => runDirectionRouteSearch(point),
        onPreviewDistanceAutoRouteCircle: (input) =>
          onPreviewDistanceAutoRouteCircleRef.current?.(input),
        onClearDistanceAutoRouteCircle: () =>
          onClearDistanceAutoRouteCircleRef.current?.(),
        onSetRouteProfileOnly: (p) => onSetRouteProfileOnlyRef.current?.(p),
        getRouteTokenInsufficient: () =>
          isRouteTokenBlocked() || routeTokenInsufficientRef.current,
        onClearRoute:
          typeof onClearRouteRef.current === "function"
            ? () => {
                directionSearchSequence += 1;
                autoRouteSearchBusyRef.current = false;
                clearAutoRouteClickDebugMarkerRef.current();
                onClearRouteRef.current?.();
              }
            : undefined,
        onClearAutoRouteClickDebugMarker: () => clearAutoRouteClickDebugMarkerRef.current(),
        initialHasStart,
        initialHasEnd: Boolean(endLngLatRef.current),
        initialHasRoute: Boolean(routeGeometryRef.current),
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
      openPickSurface(picked, fakeEvent, "distance");
    };

    /**
     * 자동 Route 결과를 popup 에 반영하는 **단일 경로**.
     *
     * 지도 클릭과 「거리 조정 재탐색」이 서로 다른 코드를 타서, 재탐색 쪽만 popup 갱신을
     * 건너뛰었다 — 그래서 조정 성공 뒤에도 `offered` 문구가 남고(결함 ③) 슬라이더가 옛
     * 값 그대로였다(결함 ②). 두 진입점이 이 함수를 함께 쓴다.
     */
    const applyAutoRoutePickResultToPopup = (
      result: { status: "found" | "failed"; message: string } | null,
    ): void => {
      if (!result) return;
      const ui = pickPopupAutoRouteUiRef.current;
      if (result.status === "found") {
        ui?.setInlinePhase("found", result.message);
        return;
      }
      ui?.setInlinePhase("failed", result.message);
      onRetryDistanceAutoRouteRef.current?.();
    };

    const mapMouseEventFromPickCommit = (commit: MapRoutePickCommit): mapboxgl.MapMouseEvent =>
      ({
        lngLat: { lng: commit.lngLat[0], lat: commit.lngLat[1] },
        point: commit.point,
      }) as mapboxgl.MapMouseEvent;

    const runDirectionRouteSearch = (picked: LngLat) => {
      if (autoRouteSearchBusyRef.current) return;
      if (routePickDockDraggingRef.current) return;
      if (autoRouteMapPickRef.current !== "direction" || !onAutoRouteMapPickRef.current) {
        return;
      }
      placeAutoRouteClickDebugMarkerRef.current(picked);
      const popup = popupRef.current;
      if (popup) popup.options.closeOnClick = false;
      autoRouteSearchBusyRef.current = true;
      const searchSequence = ++directionSearchSequence;
      pickPopupAutoRouteUiRef.current?.setInlinePhase(
        "searching",
        "목표 거리에 맞는 도로 경로를 찾는 중입니다…",
      );

      void onAutoRouteMapPickRef.current(picked)
        .then((result) => {
          if (searchSequence !== directionSearchSequence) return;
          applyAutoRoutePickResultToPopup(result);
        })
        .catch(() => {
          if (searchSequence !== directionSearchSequence) return;
          pickPopupAutoRouteUiRef.current?.setInlinePhase(
            "failed",
            "경로 탐색 중 오류가 발생했습니다. 방향을 다시 선택해 주세요.",
          );
          onRetryDistanceAutoRouteRef.current?.();
        })
        .finally(() => {
          if (searchSequence !== directionSearchSequence) return;
          autoRouteSearchBusyRef.current = false;
        });
    };

    const runDirectionMapPick = (picked: LngLat) => {
      if (autoRouteSearchBusyRef.current || routePickDockDraggingRef.current) return;
      if (pickPopupAutoRouteUiRef.current?.stageDirectionPick(picked)) return;
      runDirectionRouteSearch(picked);
    };

    const runLongPressRoutePick = (commit: MapRoutePickCommit) => {
      if (routePickDockDraggingRef.current) return;
      if (autoRouteSearchBusyRef.current) return;
      if (!startLngLatRef.current && pickPopupAutoRouteUiRef.current?.getRoutePickView() === "distance") {
        openPickSurface(commit.lngLat, mapMouseEventFromPickCommit(commit), "distance");
        pickPopupAutoRouteUiRef.current?.selectDistanceStart(commit.lngLat);
        return;
      }
      // 거리·방향 선택 중에는 누른 길이와 관계없이 같은 방향 탐색 경로를 쓴다.
      if (autoRouteMapPickRef.current === "direction") {
        runDirectionMapPick(commit.lngLat);
        return;
      }
      const event = mapMouseEventFromPickCommit(commit);
      const picked = commit.lngLat;
      showTemporaryPick(picked);
      openPickSurface(picked, event);
    };

    let routePickHintHideTimer: ReturnType<typeof setTimeout> | null = null;
    const showRoutePickHint = () => {
      const el = routePickHintRef.current;
      if (!el) return;
      el.hidden = false;
      if (routePickHintHideTimer) clearTimeout(routePickHintHideTimer);
      routePickHintHideTimer = setTimeout(() => {
        if (routePickHintRef.current) routePickHintRef.current.hidden = true;
      }, 2200);
    };

    const detachRoutePickGesture = attachMapRoutePickGesture({
      map,
      getAutoRouteMapPick: () => autoRouteMapPickRef.current,
      // 경로창은 다음 위치/방향 선택을 위해 열어 두고, 별도 메뉴·설정만 차단한다.
      isRoutePickOverlayOpen: () =>
        Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some((el) => {
          if (el.closest('[aria-hidden="true"], [inert], [hidden]')) return false;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
            rect.left < window.innerWidth && rect.top < window.innerHeight;
        }),
      shouldBlockPick: () =>
        routePickDockDraggingRef.current || autoRouteSearchBusyRef.current,
      onLongPressPick: runLongPressRoutePick,
      onDirectionShortTap: (commit) => runDirectionMapPick(commit.lngLat),
      onActivityPinShortTap: (commit) => {
        const pinLabel = getActivityWorldPinLabelRef.current;
        if (!pinLabel) return false;
        const event = mapMouseEventFromPickCommit(commit);
        return tryOpenActivityWorldPinPopup(
          map,
          event,
          pinLabel,
          popupRef,
          pickPickPopupAnchor,
        );
      },
      onShortTapNoPick: showRoutePickHint,
    });

    /** `zoom` 은 제스처·네비 버튼 애니메이션 중 매 프레임 발생 → React 재동기화가 `zoomTo` 와 맞물려 떨림 유발. 완료 시점만 반영 */
    map.on("zoomend", () => {
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    });

    /*
     * 화면 회전·창 크기 변경: Mapbox 의 trackResize(`_onWindowResize` → `resize()`,
     * orientationchange 포함)와 아래 리스너가 같은 `map.resize()` 로 모인다.
     * resize 경로는 고정된 DPR 관측값(min(실측, 상한))을 다시 읽으므로 상한이 유지된다
     * (`map.setPixelRatio` 는 mapbox-gl 3.23.1 에 없어 별도 강제 호출이 없다).
     */
    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);

    return () => {
      detachRoutePickGesture();
      activePickController?.abort();
      stopDistanceCircleAttention();
      if (routePickHintHideTimer) clearTimeout(routePickHintHideTimer);
      detachFrameBreakdown();
      map.off("moveend", reportMapViewportAfterMove);
      map.off("zoomend", reportMapViewportAfterMove);
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
      clearPinMarkersRef.current();
      clearAutoRouteClickDebugMarkerOnMap(autoRouteClickDebugMarkerRef);
      liveMarkerRef.current?.remove();
      glbLiveNametagMarkerRef.current?.remove();
      selfLocationMarkerRef.current?.remove();
      popupRef.current?.remove();
      dockPanelResizeObserver?.disconnect();
      dockPanelResizeObserver = null;
      routePickDockDragCleanupRef.current?.();
      routePickDockDragCleanupRef.current = null;
      if (routePickDockResizeHandlerRef.current) {
        window.removeEventListener("resize", routePickDockResizeHandlerRef.current);
        routePickDockResizeHandlerRef.current = null;
      }
      routePickDockLayerRef.current?.replaceChildren();
      routePickDockPanelRef.current = null;
      routePickDockPositionRef.current = null;
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

    const ensureRouteLine = (geometry: LineStringGeometry) => {
      const routeFeature = {
        type: "Feature" as const,
        properties: {} as Record<string, never>,
        geometry,
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
    };
    /*
     * 스타일을 다시 읽는 중이면 addSource 가 「Style is not done loading」을 던진다. effect 안의
     * throw 는 React 가 잡지 못해 **앱 전체가 흰 화면**이 됐다 — 주행 종료 직후 결과 시트가
     * 사라지던 원인(2026-10-08, e2e 8회 중 4회 재현). 던지면 다음 idle 에 **그때의 최신 경로**로
     * 다시 그린다. isStyleLoaded() 로 막지 않는다 — 라이브 소스가 도는 동안 영영 false 다.
     */
    try {
      ensureRouteLine(routeGeometry);
    } catch {
      const retry = () => {
        const latest = routeGeometryRef.current;
        if (!latest?.coordinates?.length) return;
        try {
          ensureRouteLine(latest);
        } catch {
          map.once("idle", retry);
        }
      };
      map.once("idle", retry);
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

    // 주행 종료 정북 hold: 같은 경로 재-fitBounds 금지. 좌표가 바뀌면 hold 해제.
    if (holdCameraAfterRideEndRef.current) {
      if (isSameRouteLine(rideEndHeldRouteRef.current, routeGeometry)) return;
      holdCameraAfterRideEndRef.current = false;
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
  const DISTANCE_TARGET_CIRCLE_ARROWS_SRC = "distance-target-circle-arrows";
  const lastAppliedCircleFitTokenRef = useRef(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    let disposed = false;
    // 스타일 재적용 때는 좌표를 다시 계산하지 않고 같은 데이터로 복원한다.
    const arrowData = distanceTargetCircle?.coordinates?.length
      ? buildCircleRadialArrowsFromLineString(distanceTargetCircle)
      : null;

    const removeCircleLayers = () => {
      if (map.getLayer("distance-target-circle-arrows-line")) {
        map.removeLayer("distance-target-circle-arrows-line");
      }
      if (map.getLayer("distance-target-circle-arrows-casing")) {
        map.removeLayer("distance-target-circle-arrows-casing");
      }
      if (map.getLayer("distance-target-circle-line")) map.removeLayer("distance-target-circle-line");
      if (map.getLayer("distance-target-circle-casing")) {
        map.removeLayer("distance-target-circle-casing");
      }
      if (map.getSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC)) {
        map.removeSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC);
      }
      if (map.getSource(DISTANCE_TARGET_CIRCLE_SRC)) map.removeSource(DISTANCE_TARGET_CIRCLE_SRC);
    };

    const apply = () => {
      if (disposed) return;
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }

      if (!distanceTargetCircle?.coordinates?.length) {
        removeCircleLayers();
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

      if (arrowData) {
        if (map.getSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC)) {
          (map.getSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC) as mapboxgl.GeoJSONSource).setData(
            arrowData,
          );
        } else {
          map.addSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC, { type: "geojson", data: arrowData });
          map.addLayer(
            {
              id: "distance-target-circle-arrows-casing",
              type: "line",
              source: DISTANCE_TARGET_CIRCLE_ARROWS_SRC,
              paint: {
                "line-color": "#111827",
                "line-width": 4,
                "line-opacity": 0.2,
              },
            },
            circleBeforeLayer,
          );
          map.addLayer(
            {
              id: "distance-target-circle-arrows-line",
              type: "line",
              source: DISTANCE_TARGET_CIRCLE_ARROWS_SRC,
              paint: {
                "line-color": ROUTE_LINE_COLOR,
                "line-width": 3,
                "line-opacity": 0.95,
              },
            },
            circleBeforeLayer,
          );
        }
      } else if (map.getSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC)) {
        if (map.getLayer("distance-target-circle-arrows-line")) {
          map.removeLayer("distance-target-circle-arrows-line");
        }
        if (map.getLayer("distance-target-circle-arrows-casing")) {
          map.removeLayer("distance-target-circle-arrows-casing");
        }
        map.removeSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC);
      }
    };

    let restoring = false;
    const restoreMissingCircle = () => {
      if (disposed || restoring || !distanceTargetCircle?.coordinates?.length) return;
      if (map.getSource(DISTANCE_TARGET_CIRCLE_SRC) &&
          (!arrowData || map.getSource(DISTANCE_TARGET_CIRCLE_ARROWS_SRC))) return;
      restoring = true;
      try {
        apply();
      } finally {
        restoring = false;
      }
    };

    apply();
    if (!map.isStyleLoaded()) map.once("idle", apply);
    map.on("style.load", apply);
    // setStyle의 차분 적용은 style.load를 발생시키지 않을 수 있다.
    map.on("styledata", restoreMissingCircle);
    return () => {
      disposed = true;
      map.off("style.load", apply);
      map.off("styledata", restoreMissingCircle);
      map.off("idle", apply);
    };
  }, [mapLoaded, distanceTargetCircle]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!distanceTargetCircle?.coordinates?.length) return;

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
        applyConquestEmphasis(map, conquestEmphasisRef.current, {
          displayMode: conquestDisplayModeRef.current,
        });
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
  }, [mapLoaded, conquestTraces, conquestDisplayMode]);

  /**
   * Conquest — 최근 주행에서 새로 인정된 도로.
   *
   * 누적 traces 와 live paint 와 분리된 임시 source다. 영구 trace에는 합치지 않고,
   * 서버의 최신 신규도로 날짜 snapshot을 App state로 받아 style.load 뒤에도 복원한다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const apply = () => {
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }
      try {
        const features = (conquestRecentNewRoad ?? [])
          .filter((g) => g?.coordinates?.length >= 2)
          .map((geometry) => ({
            type: "Feature" as const,
            properties: {},
            geometry,
          }));
        const fc = { type: "FeatureCollection" as const, features };
        const src = map.getSource(CONQUEST_RECENT_NEW_SRC) as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData(fc);
        } else {
          map.addSource(CONQUEST_RECENT_NEW_SRC, { type: "geojson", data: fc });
        }
        if (!map.getLayer(CONQUEST_RECENT_NEW_GLOW_LAYER)) {
          map.addLayer({
            id: CONQUEST_RECENT_NEW_GLOW_LAYER,
            type: "line",
            source: CONQUEST_RECENT_NEW_SRC,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { ...CONQUEST_RECENT_NEW_GLOW_PAINT },
          });
        }
        if (!map.getLayer(CONQUEST_RECENT_NEW_LAYER)) {
          map.addLayer({
            id: CONQUEST_RECENT_NEW_LAYER,
            type: "line",
            source: CONQUEST_RECENT_NEW_SRC,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { ...CONQUEST_RECENT_NEW_PAINT },
          });
        }
        applyConquestEmphasis(map, conquestEmphasisRef.current, {
          displayMode: conquestDisplayModeRef.current,
        });
      } catch {
        /* noop */
      }
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
  }, [mapLoaded, conquestRecentNewRoad]);

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
      applyConquestEmphasis(map, conquestEmphasisRef.current, {
        displayMode: conquestDisplayModeRef.current,
      });
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

  /** Self-location — 화면 고정 px dot. rAF(sampleLiveLngLat) 가 위치를 소유하면 React liveLngLat(raw HUD)로 덮어쓰지 않는다. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (liveLngLat) {
      if (!selfLocationMarkerRef.current) {
        const mounted = mountSelfLocationMarker(map, liveLngLat);
        selfLocationMarkerRef.current = mounted.marker;
        selfLocationBearingRef.current = mounted.bearingEl;
      } else if (!sampleLiveLngLat) {
        // sample 경로가 없으면(비주행) prop 좌표로 갱신.
        selfLocationMarkerRef.current.setLngLat(liveLngLat);
      }
    } else {
      selfLocationMarkerRef.current?.remove();
      selfLocationMarkerRef.current = null;
      selfLocationBearingRef.current = null;
      selfLocationGeoBearingRef.current = null;
    }
  }, [liveLngLat, mapLoaded, sampleLiveLngLat]);

  /** 본인·동행 라이더: rAF 로 위치·방향·페달 갱신 (동행 motion 은 PeerMotionRegistry) */
  useEffect(() => {
    if (!mapLoaded) return;
    let lastTs = performance.now();
    const stepPacersForFrame = (
      dtSec: number,
      showSprites: boolean,
      epochMs: number,
    ): PeerDomGJFeature[] => {
      const motionNow = liveRiderMotionRef.current;
      const session = motionNow?.sessionStatus ?? null;
      const prevSession = pacerPrevStatusRef.current;
      pacerPrevStatusRef.current = session;
      const geomNow = routeGeometryRef.current;
      const enabled = pacerEnabledRef.current === true;
      const solo = !getPeerMotionRegistry().hasActivePeers();
      const eligible =
        enabled && (session === "running" || session === "paused") && geomNow != null && solo;
      // 표시 시계를 건드리는 샘플러라 페이서가 그려질 때만 부른다.
      const distM = eligible ? (sampleLiveDistMRef.current?.(epochMs) ?? null) : null;
      const showPacers = eligible && distM != null;
      if (!showPacers) {
        pacerWorldRef.current = null;
      } else if (
        pacerWorldRef.current == null ||
        (session === "running" && prevSession !== "running" && prevSession !== "paused")
      ) {
        pacerWorldRef.current = createPacerWorld(Date.now() >>> 0, { staggerEntry: true });
      }
      const world = pacerWorldRef.current;
      const features: PeerDomGJFeature[] = [];
      if (
        showPacers &&
        world &&
        geomNow &&
        distM != null &&
        (session === "running" || session === "paused")
      ) {
        const selfSpeedMps =
          session === "paused" ? 0 : Math.max(0, (motionNow?.speedKmh ?? 0) / 3.6);
        stepPacerWorld(world, {
          dtSec,
          selfSpeedMps,
          status: session === "paused" ? "paused" : "running",
        });
        if (showSprites) {
          const routeLen = lineStringLengthMeters(geomNow);
          for (const p of enteredPacers(world)) {
            const along = resolvePacerDistM(distM, p.gapM, routeLen);
            const at = smoothedRoutePoint(geomNow, along, RIDER_CURVE_HALF_SPAN_M, routeLen);
            if (!at) continue;
            // 차선은 둥근 곡선의 진행 방향 기준. 모델 yaw 는 아래 smoother 출력.
            const hdg =
              smoothedCurveHeadingAtRouteDistanceMeters(geomNow, along, RIDER_CURVE_HALF_SPAN_M, routeLen) ?? 0;
            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: offsetLngLatLateral(at, hdg, p.laneM) },
              properties: {
                id: p.id,
                label: "페이서",
                phaseRev: p.phaseRev,
                hdg,
                speedMps: pacerSpeedMps(selfSpeedMps, p),
                pathDistM: along,
              },
            });
          }
        }
      }
      if (import.meta.env.DEV) {
        const tw = window as Window & { __rtwPacerTrace?: unknown[] };
        if (Array.isArray(tw.__rtwPacerTrace) && tw.__rtwPacerTrace.length < 4000) {
          tw.__rtwPacerTrace.push({
            t: performance.now(),
            dt: dtSec,
            selfDist: distM,
            self: liveLngLatRef.current,
            gaps: world ? world.pacers.map((p) => p.gapM) : [],
            relV: world ? world.pacers.map((p) => p.relVMps) : [],
            spd: motionNow?.speedKmh ?? null,
            show: showPacers,
            pts: features.map((f) => f.geometry.coordinates),
            hdg: features.map((f) => f.properties.hdg),
          });
        }
      }
      pacerDiagRef.current = {
        enabled,
        visible: showPacers && showSprites && features.length > 0,
        count: features.length,
        gaps: showPacers && world ? enteredPacers(world).map((p) => p.gapM) : [],
      };
      return features;
    };
    const tickBody = (now: number) => {
      const tickClock = openFrameBreakdownTick();
      try {
      noteRafFrame(now);
      const map = mapRef.current;
      // isStyleLoaded() 는 위성+3D terrain 에서 영구 false 가능 → 동행 스프라이트 영영 차단.
      if (!map?.style) return;
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      // Date.now() 와 같은 epoch 축. 표시 시계·거리 캐시·동행 step 이 이 값 하나를 쓴다.
      const epochMs = performance.timeOrigin + now;

      const sampleFn = sampleLiveLngLatRef.current;
      const sampled = sampleFn?.(epochMs) ?? liveLngLatRef.current;
      const prevForBearing = prevLiveForBearingRef.current;
      if (sampled) {
        const routeForDisplay = routeGeometryRef.current;
        const distForDisplay = routeForDisplay ? (sampleLiveDistMRef.current?.(epochMs) ?? null) : null;
        const displayLl =
          routeForDisplay && distForDisplay != null
            ? (smoothedRoutePoint(routeForDisplay, distForDisplay, RIDER_CURVE_HALF_SPAN_M) ?? sampled)
            : sampled;
        liveLngLatRef.current = displayLl;
        if (liveMarkerRef.current && !RIDER_PROTOTYPE_IS_3D) {
          setMarkerLngLatIfChanged(liveMarkerRef.current, displayLl);
        }
        if (selfLocationMarkerRef.current) {
          setMarkerLngLatIfChanged(selfLocationMarkerRef.current, displayLl);
        }
        syncLiveSelfRiderVisual(
          displayLl,
          liveRiderMotionRef.current,
          routeGeometryRef.current,
          prevLiveForBearingRef,
          liveMarkerFlipRef,
          liveMarkerImgRef,
          liveMarkerPedalSpriteRef,
          prefersReducedMotionRef.current,
        );
        tickClock?.mark("self");
        // 종료 hold·비주행: follow tick 금지 — App followMode 복원(left 등)이 카메라를 덮지 않게.
        const session = liveRiderMotionRef.current?.sessionStatus;
        const rideSessionLive = session === "running" || session === "paused";
        if (rideSessionLive && !holdCameraAfterRideEndRef.current) {
          tickRideCameraFollow(map, displayLl, {
            followMode: followModeRef.current,
            mapZoom: mapZoomRef.current,
            rideCameraDistanceM: rideCameraDistanceMRef.current,
            lockBaseHeading: lockBaseHeadingRef.current,
            activeQuickCamera: activeQuickCameraRef.current,
            spanFloorMode: rideCameraSpanFloorModeRef.current,
            sessionStatus: session,
            routeGeometry: routeGeometryRef.current,
            prevLiveRef: prevLiveRef,
            smooth: cameraSmoothRef.current,
            suppressUntilMs: suppressCameraFollowUntilRef.current,
            nowMs: now,
          });
        }
        tickClock?.mark("camera");
        if (selfLocationMarkerRef.current) {
          const geoBearingDeg = resolveRiderBearingDeg(
            routeGeometryRef.current,
            displayLl,
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
            displayLl,
            prevForBearing,
          );
          publishRiderScreenDiag(measureRiderScreenDiag(map, displayLl, headingDeg));
        }
      } else if (selfLocationMarkerRef.current && selfLocationGeoBearingRef.current != null) {
        updateSelfLocationMarkerViewportBearing(
          selfLocationBearingRef.current,
          selfLocationGeoBearingRef.current,
          map.getBearing(),
        );
      }
      tickClock?.mark("self");

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
        epochMs,
        { buildFeatures: showPeerSprites, headingHalfSpanM: RIDER_CURVE_HALF_SPAN_M },
      );
      tickClock?.mark("peer");
      const pacerFeatures = stepPacersForFrame(dt, showPeerSprites, epochMs);
      tickClock?.mark("pacer");
      syncPeerDomMarkers(
        map,
        [...(fc.features as PeerDomGJFeature[]), ...pacerFeatures],
        peerDomMarkersRef,
      );
      tickClock?.mark("markers");
      const riderLayerReady =
        RIDER_PROTOTYPE_MODE === "glb"
          ? ensureRiderGlbLayer(map)
          : RIDER_PROTOTYPE_MODE === "preserved"
            ? ensureRiderPreservedLayer(map)
            : false;
      const turnLiveIds: string[] = [];
      let didTurn = false;
      if (RIDER_PROTOTYPE_IS_3D && riderLayerReady) {
        didTurn = true;
        const specs: RiderGlbModelSpec[] = [];
        const live = liveLngLatRef.current;
        let selfPathDistM: number | null = null;
        if (live) {
          const routeNow = routeGeometryRef.current;
          const distM = sampleLiveDistMRef.current?.(epochMs) ?? null;
          selfPathDistM = distM;
          const curveHeading =
            routeNow && distM != null
              ? smoothedCurveHeadingAtRouteDistanceMeters(routeNow, distM, RIDER_CURVE_HALF_SPAN_M)
              : null;
          const targetHeadingDeg =
            curveHeading ??
            resolveRiderBearingDeg(routeNow, live, prevForBearing);
          const motion = liveRiderMotionRef.current;
          const speedNow = motion?.speedKmh ?? 0;
          const selfSpeedMps = Math.max(0, speedNow / 3.6);
          const selfTurn = riderTurnRef.current.update(
            "live-self",
            targetHeadingDeg,
            selfSpeedMps,
            dt,
            curveHeading != null ? RIDER_TURN_HEADING_TAU_ROUTE_S : RIDER_TURN_HEADING_TAU_S,
          );
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
            kind: "self",
            lngLat: live,
            bearingDeg: selfTurn.headingDeg,
            pedalPose: resolveGlbPedalPose(liveCrankPhaseRevRef.current),
            phaseRev: liveCrankPhaseRevRef.current,
            leanDeg: selfTurn.leanDeg,
            speedMps: selfSpeedMps,
          });
          turnLiveIds.push("live-self");
        }
        for (const f of fc.features as PeerDomGJFeature[]) {
          // 연속 위상을 그대로 쓴다 — 종전에는 6단계 `pframe` 을 다시 6으로 나눠
          // 동행의 페달만 계단으로 움직였다(본인 라이더는 연속값).
          const phaseRev = f.properties.phaseRev;
          const stated = f.properties.speedMps;
          let peerSpeed = 0;
          if (typeof stated === "number" && Number.isFinite(stated)) peerSpeed = Math.max(0, stated);
          else if (typeof f.properties.displayDistM === "number" && Number.isFinite(f.properties.displayDistM)) {
            const prevDist = peerTurnDistPrevRef.current.get(f.properties.id);
            peerTurnDistPrevRef.current.set(f.properties.id, f.properties.displayDistM);
            if (prevDist != null && dt > 0) peerSpeed = Math.max(0, (f.properties.displayDistM - prevDist) / dt);
          }
          const peerTurn = riderTurnRef.current.update(
            f.properties.id,
            f.properties.hdg,
            peerSpeed,
            dt,
            RIDER_TURN_HEADING_TAU_ROUTE_S,
          );
          specs.push({
            id: f.properties.id,
            kind: "peer",
            lngLat: f.geometry.coordinates,
            bearingDeg: peerTurn.headingDeg,
            pedalPose: resolveGlbPedalPose(phaseRev),
            phaseRev,
            leanDeg: peerTurn.leanDeg,
            speedMps: peerSpeed,
          });
          turnLiveIds.push(f.properties.id);
        }
        for (const f of pacerFeatures) {
          const phaseRev = f.properties.phaseRev;
          const pacerSpeed = f.properties.speedMps ?? 0;
          const pacerTurn = riderTurnRef.current.update(
            f.properties.id,
            f.properties.hdg,
            pacerSpeed,
            dt,
            RIDER_TURN_HEADING_TAU_ROUTE_S,
          );
          specs.push({
            id: f.properties.id,
            kind: "pacer",
            lngLat: f.geometry.coordinates,
            bearingDeg: pacerTurn.headingDeg,
            pedalPose: resolveGlbPedalPose(phaseRev),
            phaseRev,
            leanDeg: pacerTurn.leanDeg,
            speedMps: pacerSpeed,
          });
          turnLiveIds.push(f.properties.id);
        }
        noteRiderJitterFrame(now, selfPathDistM, fc.features, pacerFeatures);
        tickClock?.mark("spec");
        if (RIDER_PROTOTYPE_MODE === "glb") syncRiderGlbModels(map, specs);
        else syncRiderPreservedModels(map, specs);
        tickClock?.mark("sync");
        const liveLabel = liveRiderNametagRef.current?.trim() ?? "";
        syncGlbLiveNametagMarker(
          map,
          live,
          liveLabel,
          glbLiveNametagMarkerRef,
          glbLiveNametagElRef,
        );
        tickClock?.mark("nametag");
      }
      if (didTurn) {
        riderTurnRef.current.prune(turnLiveIds);
        const liveTurn = new Set(turnLiveIds);
        for (const id of peerTurnDistPrevRef.current.keys()) {
          if (!liveTurn.has(id)) peerTurnDistPrevRef.current.delete(id);
        }
      }
      } finally {
        tickClock?.end();
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
        reprojectGlbNametagMarkers(glbLiveNametagMarkerRef.current, peerDomMarkersRef.current, map);
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
    if (bootFlyTargetRef.current) return;
    if (holdCameraAfterRideEndRef.current) return;
    if (performance.now() < suppressCameraFollowUntilRef.current) return;
    if (Math.abs(map.getZoom() - mapZoom) < 0.05) return;

    const applyPropZoom = () => {
      if (bootFlyTargetRef.current) return;
      if (performance.now() < suppressCameraFollowUntilRef.current) return;
      const m = mapRef.current;
      if (!m || holdCameraAfterRideEndRef.current) return;
      if (Math.abs(m.getZoom() - mapZoom) < 0.05) return;
      cameraSmoothRef.current.zoom = mapZoom;
      suppressCameraFollowUntilRef.current = performance.now() + 600;
      if (mapZoomApplyRafRef.current != null) cancelAnimationFrame(mapZoomApplyRafRef.current);
      mapZoomApplyRafRef.current = requestAnimationFrame(() => {
        mapZoomApplyRafRef.current = null;
        if (bootFlyTargetRef.current) return;
        if (performance.now() < suppressCameraFollowUntilRef.current) return;
        const live = mapRef.current;
        if (!live || holdCameraAfterRideEndRef.current) return;
        if (Math.abs(live.getZoom() - mapZoom) < 0.05) return;
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

  /** 부트 목적지는 이동 전에만 갈아끼운다. 끝난 뒤의 prop 변화는 검색·주행을 덮지 않는다. */
  useEffect(() => {
    if (bootFlyMovedRef.current) return;
    if (!bootFlyTarget) return;
    const [lng, lat] = bootFlyTarget.center;
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(bootFlyTarget.zoom)) return;
    bootFlyTargetRef.current = { center: [lng, lat], zoom: bootFlyTarget.zoom };
  }, [bootFlyTarget]);

  /** 최초 지역은 유지하고, 위치가 결정되면 거리에 맞춰 5초 안에 상승·이동·하강한다. */
  useEffect(() => {
    if (bootFlyMovedRef.current) return;
    const map = mapRef.current;
    const target = bootFlyTargetRef.current;
    if (!map || !mapLoaded || !target || bootFlyHold) return;
    bootFlyTargetRef.current = null;
    bootFlyMovedRef.current = true;
    const center = map.getCenter();
    const sameView =
      Math.abs(center.lng - target.center[0]) < 1e-7 &&
      Math.abs(center.lat - target.center[1]) < 1e-7 &&
      Math.abs(map.getZoom() - target.zoom) < 0.01;
    if (sameView) return;
    if (getReducedMotionSnapshot()) {
      map.jumpTo({ center: target.center, zoom: target.zoom });
      return;
    }
    // HUD의 이전 줌 또는 이미 예약된 rAF가 비행 중간에 카메라를 덮지 않게 한다.
    const flightMs = resolveEntryLocationFlightMs(
      getDistanceMeters([center.lng, center.lat], [target.center[0], target.center[1]]),
    );
    suppressCameraFollowUntilRef.current = performance.now() + flightMs + 100;
    map.flyTo({
      center: target.center,
      zoom: target.zoom,
      duration: flightMs,
      curve: 1.42,
      essential: false,
    });
  }, [mapLoaded, bootFlyHold, bootFlyTarget]);

  const appliedMapZoomStepIdRef = useRef(0);

  /** HUD 줌 ± — 실측 getZoom()+delta (free/topDown 등 mapZoom 상태 경합 회피) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !mapZoomStepRequest) return;
    if (appliedMapZoomStepIdRef.current === mapZoomStepRequest.requestId) return;
    appliedMapZoomStepIdRef.current = mapZoomStepRequest.requestId;
    const next =
      Math.round((map.getZoom() + mapZoomStepRequest.delta) * 10) / 10;
    const clamped = Math.min(
      MAP_ZOOM_SLIDER_MAX,
      Math.max(MAP_GLOBE_MIN_ZOOM, next),
    );
    cameraSmoothRef.current.zoom = clamped;
    suppressCameraFollowUntilRef.current = performance.now() + 600;
    map.zoomTo(clamped, { duration: 0 });
    onMapZoomRef.current?.(Number(clamped.toFixed(1)));
  }, [mapZoomStepRequest, mapLoaded]);

  /** 주행 시작 — fitBounds·zoomend 동기화와 무관하게 후방·줌 21.5 즉시 스냅 */
  useEffect(() => {
    if (!rideFollowCameraNonce || !mapLoaded) return;
    const map = mapRef.current;
    if (!map) return;

    const target = liveLngLatRef.current ?? startLngLatRef.current;
    if (!target) return;

    const rideMode = RIDE_FOLLOW_CAMERA_MODE;
    holdCameraAfterRideEndRef.current = false;
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
        padding: RIDE_FOLLOW_NO_PADDING,
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

    if (!bootFlyMovedRef.current) {
      bootFlyTargetRef.current = null;
      bootFlyMovedRef.current = true;
    }
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
    // mapcut 측정 스위치 — 쿼리 있을 때만(없으면 내부에서 아무 호출도 없다).
    try {
      applyMapCutToMap(map);
    } catch {
      /* lab 스위치 */
    }
  }, [enable3D, mapLoaded]);

  /**
   * mapcut 측정 스위치 — 스타일 재로드마다 재적용. 생성 effect 의 `style.load`
   * 핸들러(apply3DState 등)보다 나중에 등록되므로, 되살아난 지형·건물을 덮는다.
   * 쿼리가 없으면 내부에서 아무 호출도 없이 반환한다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (getMapCutKeys().length === 0) return;
    try {
      applyMapCutToMap(map);
    } catch {
      /* lab 스위치 */
    }
    const reapply = () => {
      try {
        applyMapCutToMap(map);
      } catch {
        /* lab 스위치 */
      }
    };
    map.on("style.load", reapply);
    return () => {
      map.off("style.load", reapply);
    };
  }, [mapLoaded]);

  /**
   * 주행 중 가까운 카메라 글자 숨김 (Chief 결정 A) — 주행 상태·줌 변화에만 반응.
   * 상태가 바뀔 때만 setLayoutProperty 를 호출한다(컨트롤러가 보장).
   * mapcut effect 보다 뒤에 등록되므로 style.load 에서는 mapcut 적용 뒤에 덮는다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const controller = getRideLabelsController();
    const sync = () => {
      try {
        controller.update(map, { riding: rideActive, zoom: map.getZoom() });
      } catch {
        /* 글자 스위치 실패가 주행 지도를 막지 않는다 */
      }
    };
    sync();
    map.on("zoom", sync);
    map.on("zoomend", sync);
    const onStyleLoad = () => {
      try {
        controller.reapply(map);
      } catch {
        /* 글자 스위치 */
      }
    };
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("zoom", sync);
      map.off("zoomend", sync);
      map.off("style.load", onStyleLoad);
    };
  }, [mapLoaded, rideActive]);

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

  return (
    <div ref={mapShellRef} className="map-view-shell">
      <div ref={containerRef} className="map-view" role="presentation" />
      <div
        ref={routePickHintRef}
        className="map-view__route-pick-hint"
        hidden
        aria-live="polite"
      >
        지도를 길게 눌러 위치 선택
      </div>
      <div ref={routePickDockLayerRef} className="map-view__pick-dock-layer" />
      <RouteElevationOverlay
        routeGeometry={routeGeometry}
        liveLngLat={liveLngLat}
        routeElevationProfile={routeElevationProfile}
      />
    </div>
  );
}
