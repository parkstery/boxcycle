import { startTransition, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { PublicationSharedPresence } from "./components/PublicationSharedPresence";
import { peerHudLabels, type PeerHudEntry } from "./lib/peerHud";
import { SignUpNicknameCard } from "./components/SignUpNicknameCard";
import { RideRoutePanel, type FollowMode } from "./components/RideRoutePanel";
import { PublicRouteRequestModal } from "./components/PublicRouteRequestModal";
import { useTrailSession } from "./hooks/useTrailSession";
import { useLiveLocationPublishSession } from "./hooks/useLiveLocationPublishSession";
import { useGlobalLivePresence } from "./hooks/useGlobalLivePresence";
import { useDocumentVisibility } from "./hooks/useDocumentVisibility";
import {
  formatRouteActivityHudLine,
  invalidateLiveRouteActivityIdsCache,
  invalidateRouteActivityCache,
} from "./lib/firestoreRouteActivity";
import { AppMapStage, useAppMapOverlays } from "./features/map-overlays";
import { RouteDock, useRouteDockStops, type RouteDockStop, type RouteDockStopId } from "./components/route-dock";
import { DebugMapStage } from "./features/map-overlays/DebugMapStage";
import type { MapViewportBounds } from "./lib/activityWorldLod";
import { armPostRideActivityWatch } from "./lib/activityWorldPollSignals";
import {
  DEFAULT_FOLLOW_MODE,
  DEFAULT_MAP_ENABLE_3D,
  DEFAULT_MAP_ZOOM,
  RIDE_FOLLOW_CAMERA_MODE,
  RIDE_START_ZOOM,
} from "./lib/mapGlobeView";
import { rideDistanceAlongRoute } from "./lib/liveLocationSnapshot";
import { AuthGateCard, AuthGoogleMark } from "./components/AuthGateCard";
import { GuestEntryCard } from "./components/GuestEntryCard";
import { allowUnauthMapDev } from "./lib/authGatePolicy";
import { readGuestEntryAccepted } from "./lib/appSessionKeys";
import { useUserTier } from "./hooks/useUserTier";
import { RideSummarySheet } from "./components/RideSummarySheet";
import { MenuPanel } from "./components/MenuPanel";
import { PlaceSearchPanel } from "./components/PlaceSearchPanel";
import { MenuPlaceSearch } from "./components/MenuPlaceSearch";
import { TrailHubPanel } from "./components/TrailHubPanel";
import { useOpenTrails } from "./hooks/useOpenTrails";
import { useTrailInstanceMeta } from "./hooks/useTrailInstanceMeta";
import {
  buildTrailRegionLabel,
  closeTrailInstance,
  createTrailInstance,
  fetchTrailInstance,
  setTrailVisibility,
  touchTrailInstanceActivity,
  withResolvedTrailPublicationId,
  type TrailInstance,
} from "./lib/firestoreTrailInstance";
import { fetchOpenTrailListingPublicationId } from "./lib/firestoreOpenTrailListings";
import { formatTrailDisplayNumber, resolveTrailDisplayLabel } from "./lib/trailDisplayNumber";
import {
  readTrailDisplayNumberCache,
  rememberTrailDisplayNumber,
} from "./lib/trailDisplayNumberCache";
import { RotateOverlay } from "./components/RotateOverlay";
import { MapViewSheet } from "./components/MapViewSheet";
import { UserInfoSheet } from "./components/UserInfoSheet";
import { RideSettingsSheet } from "./components/RideSettingsSheet";
import { useRideUiStage } from "./hooks/useRideUiStage";
import {
  useRideArrivalAutoEnd,
  useRideCoachingMedia,
  useRideFeedbackPreferences,
} from "./features/ride-feedback";
import { isFirebaseConfigured } from "./lib/firebase";
import {
  BASIC_SHARED_HUB_IDS,
  BASIC_SHARED_HUB_SUMMARIES,
  ensureBasicCoursesSeeded,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "./lib/firestoreCourses";
import { deletePublicationSessionMember } from "./lib/firestorePublicationSessionPresence";
import { deleteGlobalLivePresence } from "./lib/firestoreGlobalLivePresence";
import {
  DEFAULT_TRAIL_ID,
  deleteTrailPresence,
  isTrailMemberActive,
  sanitizeTrailId,
} from "./lib/firestoreTrail";
import { canUserJoinTrail, resolveNewTrailVisibility } from "./lib/trailAccessPolicy";
import { replaceTrailInUrl } from "./lib/trailUrl";
import type { LngLat } from "./lib/geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "./lib/routeWaypoints";
import { lockRouteWorkspaceDuringRide } from "./lib/routeWorkspaceLock";
import type { PublishedPublicCourseSummary } from "./lib/firestoreCourses";
import {
  resolvePublishedRouteLink,
  type PublishedRouteLink,
  type RouteRideEntry,
} from "./lib/routePublicationResolve";
import type { SavedRoute } from "./lib/firestoreSavedRoutes";
import { SAVED_ROUTE_NAME_MAX } from "./lib/firestoreSavedRoutes";
import { useAppAuth } from "./hooks/useAppAuth";
import { useRouteTokenBalance } from "./hooks/useRouteTokenBalance";
import { useAppTrail } from "./hooks/useAppTrail";
import { useRoutePlanning } from "./hooks/useRoutePlanning";
import { useRecentRideSessions } from "./hooks/useRecentRideSessions";
import { usePublicationCatalogHub } from "./hooks/usePublicationCatalogHub";
import { usePublicRouteReviewMeta } from "./hooks/usePublicRouteReviewMeta";
import { useSavedRoutesWorkspace } from "./hooks/useSavedRoutesWorkspace";
import { useRideEndAndPersistence } from "./hooks/useRideEndAndPersistence";
import {
  DEFAULT_MAP_STYLE,
  MAP_STYLE_OPTIONS,
} from "./lib/appSessionKeys";
import { formatElapsedFromMs } from "./lib/rideFormat";
import { useBleCrankRpm } from "./hooks/useBleCrankRpm";
import { useConquest } from "./hooks/useConquest";
import { useLiveConquestPaint } from "./hooks/useLiveConquestPaint";
import { conquestCellIdsAround } from "./lib/conquestTiles";
import { ROUTE_COMPLETION_RATIO_THRESHOLD, resumeOffsetMetersFrom } from "./lib/rideRecordPolicy";
import { fetchOpenMeteoCurrentWeather, formatLiveWeatherHudLine, parseWeatherOverride, type LiveWeather } from "./lib/openMeteoWeather";
import { WeatherOverlay } from "./components/weather/WeatherOverlay";
import { useRideMapillaryStreet } from "./hooks/useRideMapillaryStreet";
import { MAPILLARY_CLIENT_TOKEN, mapillaryTokenConfigured } from "./lib/mapillaryToken";
import type { CoverageOverlayMode } from "./lib/coverageOverlayMode";
import { type RouteProfile } from "./services/mapboxDirections";
import { FUNCTIONS_REGION, MAPBOX_TOKEN } from "./app/env";
import { useAppSheetNavigation } from "./app/useAppSheetNavigation";
import { getMapDebugPhase } from "./lib/mapDebugPhase";
import "./App.css";

const MapillaryRideViewer = lazy(async () => {
  const m = await import("./components/MapillaryRideViewer");
  return { default: m.MapillaryRideViewer };
});

export default function App() {
  const {
    trailId,
    setTrailId,
    setTrailDraft,
  } = useAppTrail();
  const configured = isFirebaseConfigured();
  const {
    user,
    busy,
    error,
    fsSync,
    authInitialized,
    authSigningIn,
    userSignedOut,
    beginAuthenticatedSession,
    handleGoogleSignIn,
    handleCompleteNickname,
    completeFirebaseSignOut,
    setError,
    setBusy,
  } = useAppAuth(configured);

  const userTier = useUserTier(user, configured);

  const { routeTokenBalance } = useRouteTokenBalance(user, configured);
  /** Conquest(정복) — 요약 구독 + 내 도로 셀 + 「내 도로망」 궤적. 쓰기는 CF 전용. */
  const {
    summary: conquestSummary,
    cellIds: conquestCellIds,
    traces: conquestTraces,
  } = useConquest(user, configured);
  /** 주행 시작 시점 정복 스냅샷 — 주행 요약 「새 도로 +N km」 델타 계산용 */
  const [conquestBaseline, setConquestBaseline] = useState<{ meters: number } | null>(null);

  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [rideFollowCameraNonce, setRideFollowCameraNonce] = useState(0);
  const [rideJoinBurstNonce, setRideJoinBurstNonce] = useState(0);
  const [mapViewportSpanKm, setMapViewportSpanKm] = useState<number | null>(null);
  /** 전역 livePresence publish — idle 시 지도 중심(주행 중에는 liveForMap 우선) */
  const [mapViewportCenterLngLat, setMapViewportCenterLngLat] = useState<LngLat>([127.035, 37.505]);
  /** Activity World LOD — 제스처 중 실제 줌·span (HUD `mapZoom` 과 분리) */
  const [mapLodZoom, setMapLodZoom] = useState(DEFAULT_MAP_ZOOM);
  const [mapLodSpanKm, setMapLodSpanKm] = useState<number | null>(null);

  const onMapViewport = useCallback((viewport: MapViewportBounds, spanKm: number) => {
    setMapViewportSpanKm(spanKm);
    const centerLng = (viewport.west + viewport.east) / 2;
    const centerLat = (viewport.south + viewport.north) / 2;
    if (Number.isFinite(centerLng) && Number.isFinite(centerLat)) {
      setMapViewportCenterLngLat([centerLng, centerLat]);
    }
  }, []);
  const onMapLodViewport = useCallback((spanKm: number, zoom: number) => {
    setMapLodSpanKm(spanKm);
    setMapLodZoom(zoom);
  }, []);
  const [followMode, setFollowMode] = useState<FollowMode>(DEFAULT_FOLLOW_MODE);
  const [enable3D, setEnable3D] = useState(DEFAULT_MAP_ENABLE_3D);
  const followModeSnapshotRef = useRef(followMode);
  const mapZoomSnapshotRef = useRef(mapZoom);
  followModeSnapshotRef.current = followMode;
  mapZoomSnapshotRef.current = mapZoom;
  const rideCameraRestoreRef = useRef<{ follow: FollowMode; zoom: number } | null>(null);
  const [speedKmh, setSpeedKmh] = useState(5);
  const {
    rideTtsEnabled,
    setRideTtsEnabled,
    rideBgmEnabled,
    setRideBgmEnabled,
    rideCoachingBannerVisible,
    setRideCoachingBannerVisible,
  } = useRideFeedbackPreferences();
  const {
    menuOpen,
    placeSearchOpen,
    mapViewSheetOpen,
    userInfoSheetOpen,
    rideSettingsSheetOpen,
    setMenuOpen,
    setPlaceSearchOpen,
    setMapViewSheetOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    openMenuPanel,
    openPlaceSearchPanel,
    openMapViewPanel,
    openUserInfoPanel,
    openRideSettingsPanel,
  } = useAppSheetNavigation();
  const [externalCameraJump, setExternalCameraJump] = useState<{
    lngLat: LngLat;
    zoom?: number;
    requestId: number;
    /** Mapbox [west,south,east,north] — 있으면 지도가 `fitBounds` 로 도시 프레이밍 */
    bbox?: [number, number, number, number] | null;
  } | null>(null);
  /** 메뉴 장소 검색으로 이동한 위치(지도 마커) */
  const [placeSearchMarkerLngLat, setPlaceSearchMarkerLngLat] = useState<LngLat | null>(null);
  const cameraJumpSeqRef = useRef(0);
  /** MENU 최초 오픈 시에만 퍼블릭 카탈로그·심사 메타 Firestore 로드(세션당 uid 1회) */
  const menuFirestorePrimedUidRef = useRef<string | null>(null);
  const [subscriptionFlash, setSubscriptionFlash] = useState<string | null>(null);
  const [idleHintDismissed, setIdleHintDismissed] = useState(false);
  const [summarySheetVisible, setSummarySheetVisible] = useState(false);
  const [coverageOverlayMode, setCoverageOverlayMode] = useState<CoverageOverlayMode>("off");
  /** 미완료 쿼터 초과 유도 — 안내 배너 문구와 「내 경로」 탭 오픈 신호(nonce) */
  const [savedQuotaNotice, setSavedQuotaNotice] = useState<string | null>(null);
  const [openSavedTabNonce, setOpenSavedTabNonce] = useState(0);
  /** 이어 달리기(§9.5.5 단위7) — 마지막으로 로드한 저장 경로 id(재개 후보). 렌더 중 ref 읽기 회피용 state */
  const [resumeCandidateId, setResumeCandidateId] = useState<string | null>(null);
  /**
   * 이번 세션의 경로상 시작 오프셋(m) — HUD 거리는 누적(virtualDistance)으로 두고
   * 평속·칼로리·종료 요약 거리는 세션 실주행(누적 − offset) 기준으로 파생하기 위한 state.
   */
  const [sessionStartOffsetMeters, setSessionStartOffsetMeters] = useState(0);

  const {
    publicRouteRequestModalRoute,
    setPublicRouteRequestModalRoute,
    isPublicRouteReviewer,
    pendingPublicRouteIds,
    publicRouteReviewQueueCount,
    refreshPublicRouteMeta,
    handleSubmitPublicRouteRequest,
  } = usePublicRouteReviewMeta({ configured, user });

  /** 지도에 올라온 경로가 공식 코스(입문 허브·퍼블릭 등)에서 온 경우 — 맞춤 「경로 생성」 비활성에 사용 */
  const [activeOfficialCourseId, setActiveOfficialCourseId] = useState<string | null>(null);
  const activeOfficialCourseIdRef = useRef<string | null>(null);
  activeOfficialCourseIdRef.current = activeOfficialCourseId;
  const [coursePeerHud, setCoursePeerHud] = useState<PeerHudEntry[]>([]);
  /** 입문 허브 동행에서 계산된 내 네임태그(없으면 단독 주행용 표시로 대체) */
  const [liveRiderNametag, setLiveRiderNametag] = useState<string | null>(null);
  /** 로그인(게스트 포함) 세션 동안 Trailhead presence·관전 항상 on — Trailhead 진입·이탈 토글 없음 */
  const trailheadSessionActive = Boolean(configured && user);
  const pageVisible = useDocumentVisibility();
  const [trailVisibilityBusy, setTrailVisibilityBusy] = useState(false);
  const [trailStartBusy, setTrailStartBusy] = useState(false);
  /** 이번 주행에서 호스트로 연 Trail — 종료 시 close */
  const hostTrailIdRef = useRef<string | null>(null);
  /** Trail 생성·MENU 합류 직후 `displayNumber` 즉시 표시 — `useTrailInstanceMeta` fetch 전 */
  const [trailMetaSeed, setTrailMetaSeed] = useState<TrailInstance | null>(null);
  /** 주행 세션 동안 MENU·표시용 Trail id (Trailhead UI 전환과 무관하게 유지) */
  const [ridingTrailId, setRidingTrailId] = useState<string | null>(null);

  const sanitizedTrailId = sanitizeTrailId(trailId);
  const onDedicatedTrail = sanitizedTrailId !== DEFAULT_TRAIL_ID;

  useEffect(() => {
    if (trailMetaSeed) {
      rememberTrailDisplayNumber(trailMetaSeed.id, trailMetaSeed.displayNumber);
    }
  }, [trailMetaSeed]);

  useEffect(() => {
    if (trailMetaSeed && trailMetaSeed.id !== sanitizedTrailId) {
      if (ridingTrailId && trailMetaSeed.id === ridingTrailId) {
        return;
      }
      setTrailMetaSeed(null);
    }
  }, [sanitizedTrailId, trailMetaSeed, ridingTrailId]);

  const { meta: currentTrailMetaRaw, reload: reloadCurrentTrailMeta } = useTrailInstanceMeta(
    sanitizedTrailId,
    Boolean(configured && user && onDedicatedTrail),
    trailMetaSeed,
  );

  const [trailListingPublicationId, setTrailListingPublicationId] = useState<string | null>(null);
  useEffect(() => {
    if (!configured || sanitizedTrailId === DEFAULT_TRAIL_ID) {
      setTrailListingPublicationId(null);
      return;
    }
    let cancelled = false;
    void fetchOpenTrailListingPublicationId(sanitizedTrailId)
      .then((id) => {
        if (!cancelled) setTrailListingPublicationId(id);
      })
      .catch(() => {
        if (!cancelled) setTrailListingPublicationId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, sanitizedTrailId]);

  const currentTrailMeta = useMemo(() => {
    if (!currentTrailMetaRaw) return null;
    return withResolvedTrailPublicationId(currentTrailMetaRaw, trailListingPublicationId);
  }, [currentTrailMetaRaw, trailListingPublicationId]);

  /** leaveBasicHub 등에서 최신 주행 종료 로직을 호출하기 위한 ref */
  const handleEndRideRef = useRef<() => void>(() => {});
  /** 주행 종료 시 `rides.publicationId` — `useOfficialCoursesHub` 이후 매 렌더 갱신 */
  const activePublicationIdRef = useRef<string | null>(null);
  /** `useSavedRoutesWorkspace` 가 주입 — `useRoutePlanning` 보다 아래에서 대입 */
  const clearSavedRouteArtifactsRef = useRef<() => void>(() => {});
  const rideEntryRef = useRef<RouteRideEntry | null>(null);
  const publishedCatalogRef = useRef<readonly PublishedPublicCourseSummary[]>([]);
  const resolvePublishedLinkForSavedRouteRef = useRef<
    ((route: SavedRoute) => Promise<PublishedRouteLink | null>) | null
  >(null);

  const enterBasicHubArtifactsRef = useRef<() => void>(() => {});
  enterBasicHubArtifactsRef.current = () => {
    clearSavedRouteArtifactsRef.current();
  };

  const clearRouteArtifactsRef = useRef<() => void>(() => {});
  const onRouteDirectionsErrorRef = useRef<() => void>(() => {});
  clearRouteArtifactsRef.current = () => {
    clearSavedRouteArtifactsRef.current();
    setActiveOfficialCourseId(null);
    setPlaceSearchMarkerLngLat(null);
  };
  onRouteDirectionsErrorRef.current = () => {
    setActiveOfficialCourseId(null);
  };

  const {
    startLngLat,
    setStartLngLat,
    endLngLat,
    setEndLngLat,
    routeWaypoints,
    setRouteWaypoints,
    profile,
    setProfile,
    routeGeometry,
    setRouteGeometry,
    routeDistanceMeters,
    setRouteDistanceMeters,
    routeDurationSec,
    setRouteDurationSec,
    routeSummary,
    setRouteSummary,
    routeLoading,
    rideStatus,
    setRideStatus,
    rideMetrics,
    resetRide,
    syncLiveFromDistance,
    sampleLiveLngLat,
    startOffsetMetersRef,
    startLabel,
    endLabel,
    startPlaceLabel,
    endPlaceLabel,
    waypointLabelsForPanel,
    clearRoutePins,
    applyRouteProfileFromMapPopup: applyRouteProfileForMapLocked,
  } = useRoutePlanning({
    user,
    speedKmh,
    mapboxAccessToken: MAPBOX_TOKEN,
    functionsRegion: FUNCTIONS_REGION,
    clearRouteArtifactsRef,
    onRouteDirectionsErrorRef,
  });

  /** 주행 시작 — 후방 추적·최대 줌 / 종료 시 이전 카메라 설정 복원 */
  useEffect(() => {
    if (rideStatus === "running") {
      if (!rideCameraRestoreRef.current) {
        rideCameraRestoreRef.current = {
          follow: followModeSnapshotRef.current,
          zoom: mapZoomSnapshotRef.current,
        };
        setFollowMode(RIDE_FOLLOW_CAMERA_MODE);
        setEnable3D(false);
        setMapZoom(RIDE_START_ZOOM);
        setMapStyle(DEFAULT_MAP_STYLE);
        setRideFollowCameraNonce((n) => n + 1);
        setRideJoinBurstNonce((n) => n + 1);
      }
      return;
    }
    if (rideStatus === "idle" && rideCameraRestoreRef.current) {
      const { follow, zoom } = rideCameraRestoreRef.current;
      rideCameraRestoreRef.current = null;
      setFollowMode(follow);
      setMapZoom(zoom);
    }
  }, [rideStatus]);

  const { recentSessions, setRecentSessions, reloadRecentSessionsFromLocalStorage } =
    useRecentRideSessions({
      configured,
      user,
      trailId: trailId,
      profile,
    });

  const savedRoutesWorkspace = useSavedRoutesWorkspace({
    configured,
    user,
    rideStatus,
    routeGeometry,
    startLngLat,
    endLngLat,
    routeWaypoints,
    profile,
    routeDistanceMeters,
    routeDurationSec,
    setRouteSummary,
    setStartLngLat,
    setEndLngLat,
    setRouteWaypoints,
    setProfile,
    setRouteGeometry,
    setRouteDistanceMeters,
    setRouteDurationSec,
    resetRide,
    setActiveOfficialCourseId,
    setPlaceSearchMarkerLngLat,
    resolvePublishedLinkForSavedRouteRef,
    onSavedRouteRideEntry: (route) => {
      rideEntryRef.current = "owner_library";
      setResumeCandidateId(route.id);
    },
  });
  clearSavedRouteArtifactsRef.current = () => {
    savedRoutesWorkspace.clearLoadedRouteAndAdhoc();
    setResumeCandidateId(null);
  };

  const {
    savedRoutes,
    setSavedRoutes,
    savedRoutesLoading,
    loadedSavedRouteIdRef,
    loadedSavedRouteNameRef,
    loadedSavedRouteProgressRef,
    lastEndedWasAdhoc,
    setLastEndedWasAdhoc,
    handleSaveCurrentRoute,
    handleSaveAdhocAsUserRoute,
    handleLoadSavedRoute,
    handleRenameSavedRoute,
    handleDeleteSavedRoute,
  } = savedRoutesWorkspace;

  /**
   * 미완료(진행 중) 경로 슬롯이 가득 차 저장이 막혔을 때 공통 처리 —
   * 저장 UI 대신 MENU 를 열고 「내 경로」 대기 탭으로 유도하며 안내 배너를 띄운다.
   */
  const handleIncompleteQuotaBlocked = useCallback(
    (message: string) => {
      setSummarySheetVisible(false);
      setSavedQuotaNotice(message);
      setMenuOpen(true);
      setOpenSavedTabNonce((n) => n + 1);
    },
    [setMenuOpen],
  );

  const reloadCourseActivityRef = useRef<
    (options?: { forceInvalidate?: boolean }) => void
  >(() => {});
  const applyRideCompletedOptimisticRef = useRef<() => void>(() => {});
  const [activityMapRefreshNonce, setActivityMapRefreshNonce] = useState(0);
  const onRideEndedWithPublication = useCallback((_publicationId: string) => {
    armPostRideActivityWatch();
    applyRideCompletedOptimisticRef.current();
    invalidateLiveRouteActivityIdsCache();
    reloadCourseActivityRef.current({ forceInvalidate: true });
    setActivityMapRefreshNonce((n) => n + 1);
  }, []);
  const onRidePersistedToFirestore = useCallback((publicationId: string | null) => {
    if (publicationId?.trim()) {
      armPostRideActivityWatch();
      applyRideCompletedOptimisticRef.current();
      invalidateLiveRouteActivityIdsCache();
      setActivityMapRefreshNonce((n) => n + 1);
      const bumpSoft = () => reloadCourseActivityRef.current({ forceInvalidate: false });
      bumpSoft();
      for (const ms of [2_000, 5_000]) {
        window.setTimeout(bumpSoft, ms);
      }
      window.setTimeout(() => reloadCourseActivityRef.current(), 12_000);
      return;
    }
    setRouteSummary(
      "주행 기록을 저장했습니다.",
    );
  }, [setRouteSummary]);

  /**
   * Conquest Trust Tier — 세션 중 케이던스>0 누적 초.
   * null = 센서 신호를 한 번도 못 봄(T0 no-sensor). 주행 시작 시 리셋.
   */
  const pedalActiveSecRef = useRef<number | null>(null);

  /** Conquest — 주행 중 실시간 「새 도로」 카운터(낙관) */
  const { liveNewMeters: conquestLiveMeters } = useLiveConquestPaint({
    riding: rideStatus === "running" || rideStatus === "paused",
    routeGeometry,
    traveledMeters: rideMetrics.virtualDistanceMeters,
    serverCellIds: conquestCellIds,
  });

  const { handleEndRide } = useRideEndAndPersistence({
    mapboxAccessToken: MAPBOX_TOKEN,
    configured,
    user,
    trailId,
    publicationIdRef: activePublicationIdRef,
    profile,
    rideStatus,
    setRideStatus,
    rideMetrics,
    routeGeometry,
    routeDistanceMeters,
    routeDurationSec,
    routeWaypoints,
    startLngLat,
    endLngLat,
    startPlaceLabel,
    endPlaceLabel,
    loadedSavedRouteIdRef,
    loadedSavedRouteNameRef,
    startOffsetMetersRef,
    loadedSavedRouteProgressRef,
    rideEntryRef,
    pedalActiveSecRef,
    publishedCatalogRef,
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    onRideEndedWithPublication,
    onRidePersistedToFirestore,
  });

  const {
    publishedPublicCourses,
    publishedPublicCoursesLoading,
    publishedPublicCoursesError,
    refreshPublishedPublicCourseCatalog,
    publishedPublicSavedRouteIds,
    publishedPublicRouteFingerprints,
    basicActiveHubCourseId,
    setBasicActiveHubCourseId,
    basicStartLoading,
    basicStartHubJoined,
    enterBasicHub,
    leaveBasicHub,
  } = usePublicationCatalogHub({
    configured,
    user,
    routeGeometry,
    rideStatus,
    handleEndRideRef,
    setRouteGeometry,
    setStartLngLat,
    setEndLngLat,
    setRouteWaypoints,
    setProfile,
    setRouteDistanceMeters,
    setRouteDurationSec,
    setRouteSummary,
    resetRide,
    setActiveOfficialCourseId,
    setPlaceSearchMarkerLngLat,
    enterBasicHubArtifactsRef,
    activeOfficialCourseIdRef,
    savedRoutes,
    pendingPublicRouteIds,
    onPublicCatalogRideEntry: () => {
      rideEntryRef.current = "public_catalog";
    },
  });

  publishedCatalogRef.current = publishedPublicCourses;
  resolvePublishedLinkForSavedRouteRef.current = async (route) => {
    if (!configured) return null;
    return resolvePublishedRouteLink({
      savedRouteId: route.id,
      geometry: route.geometry,
      profile: route.profile,
      catalogHints: publishedCatalogRef.current,
    });
  };

  activePublicationIdRef.current = basicActiveHubCourseId ?? activeOfficialCourseId;

  const trackedPublicationId = basicActiveHubCourseId ?? activeOfficialCourseId;
  const isRideSessionActive = rideStatus === "running" || rideStatus === "paused";

  useEffect(() => {
    if (!isRideSessionActive || ridingTrailId) return;
    const tid = sanitizeTrailId(trailId);
    if (tid !== DEFAULT_TRAIL_ID) {
      setRidingTrailId(tid);
    }
  }, [isRideSessionActive, ridingTrailId, trailId]);

  const openTrailsQuery = useOpenTrails({
    /** Trailhead 세션 — 주행 중 Trail listing 만 */
    enabled: Boolean(configured && user && trailheadSessionActive),
  });

  /** HUD·네임태그·TrailHub — fetch 전 seed·공개 목록으로 `displayNumber` 보강 */
  const trailMetaForDisplay = useMemo((): TrailInstance | null => {
    if (currentTrailMeta) return currentTrailMeta;
    if (trailMetaSeed?.id === sanitizedTrailId) return trailMetaSeed;
    const fromListing = openTrailsQuery.rows.find((t) => t.id === sanitizedTrailId);
    return fromListing ?? null;
  }, [currentTrailMeta, trailMetaSeed, sanitizedTrailId, openTrailsQuery.rows]);

  useEffect(() => {
    for (const t of openTrailsQuery.rows) {
      rememberTrailDisplayNumber(t.id, t.displayNumber);
    }
  }, [openTrailsQuery.rows]);

  const menuTrailSanitizedId = useMemo(() => {
    if (isRideSessionActive && ridingTrailId) {
      return sanitizeTrailId(ridingTrailId);
    }
    return sanitizedTrailId;
  }, [isRideSessionActive, ridingTrailId, sanitizedTrailId]);

  // presence(접속자) 는 실제 주행 중인 Trail 기준으로 upsert·구독해야 한다.
  // 주행 중 네비(trailId)가 다른 Trail 을 가리켜도, 나는 menuTrailSanitizedId 에만 접속으로 표시돼야
  // "참여하지도 않은 Trail 에 접속자로 뜨는" 오염이 사라진다.
  const presenceTrailId = menuTrailSanitizedId;
  const trailSession = useTrailSession({
    user: user ?? undefined,
    trailId: presenceTrailId,
    enabled: trailheadSessionActive,
    pageVisible,
  });

  const menuTrailIdForFetch =
    menuTrailSanitizedId !== DEFAULT_TRAIL_ID ? menuTrailSanitizedId : DEFAULT_TRAIL_ID;
  const { meta: menuTrailFetchedMeta } = useTrailInstanceMeta(
    menuTrailIdForFetch,
    Boolean(
      configured &&
        user &&
        menuTrailIdForFetch !== DEFAULT_TRAIL_ID &&
        (menuOpen || isRideSessionActive),
    ),
    trailMetaSeed?.id === menuTrailIdForFetch ? trailMetaSeed : null,
  );

  const menuTrailMetaForDisplay = useMemo((): TrailInstance | null => {
    const tid = menuTrailSanitizedId;
    if (tid === DEFAULT_TRAIL_ID) return null;
    if (menuTrailFetchedMeta?.id === tid) return menuTrailFetchedMeta;
    if (currentTrailMeta?.id === tid) return currentTrailMeta;
    if (trailMetaSeed?.id === tid) return trailMetaSeed;
    const fromListing = openTrailsQuery.rows.find((t) => t.id === tid);
    if (fromListing) return fromListing;
    const cached = readTrailDisplayNumberCache(tid);
    if (cached == null) return null;
    return {
      id: tid,
      hostUid: "",
      displayNumber: cached,
      publicationId: null,
      regionLabel: null,
      distanceKm: null,
      visibility: "open",
      status: "open",
      createdAtMs: null,
      lastActivityAtMs: null,
    };
  }, [
    menuTrailSanitizedId,
    menuTrailFetchedMeta,
    currentTrailMeta,
    trailMetaSeed,
    openTrailsQuery.rows,
  ]);

  const trailDisplayLabels = useMemo(
    () => resolveTrailDisplayLabel(sanitizedTrailId, trailMetaForDisplay),
    [sanitizedTrailId, trailMetaForDisplay],
  );
  const debugMapPhase = getMapDebugPhase();
  const debugMapIsolationActive =
    debugMapPhase === "A" || debugMapPhase === "B" || debugMapPhase === "C";

  const coursePeerHudIds = useMemo(
    () => coursePeerHud.map((p) => p.id),
    [coursePeerHud],
  );

  const mapOverlays = useAppMapOverlays({
    configured,
    user,
    pageVisible,
    trailId,
    sanitizedTrailId,
    currentTrailMeta,
    trailheadSessionActive,
    rideStatus,
    mapZoom,
    mapLodZoom,
    mapViewportSpanKm,
    mapLodSpanKm,
    routeGeometry,
    trackedPublicationId,
    publishedPublicCourses,
    openTrails: openTrailsQuery.rows,
    trailLabel: trailDisplayLabels.label,
    coursePeerHudIds,
    activityMapRefreshNonce,
    debugIsolation: debugMapIsolationActive,
  });

  const {
    activityWorldRaw,
    getActivityWorldPinLabel,
    trailSpectatorDots: spectatorDots,
    trailSpectatorRoutes: spectatorRouteGeometries,
    trailLivePublicationIds,
    courseActivity,
    reloadCourseActivity,
    applyRideCompletedOptimistic,
    publicationActivityByPublicationId,
    lodDebugPanelProps,
  } = mapOverlays;

  reloadCourseActivityRef.current = (options) => {
    void reloadCourseActivity(options);
  };
  applyRideCompletedOptimisticRef.current = applyRideCompletedOptimistic;

  /**
   * peer 완주 갭 해소 — 라이브 spectator 라인은 완주 즉시 사라지는데 heat(red dot) 폴링은
   * 최대 수 분 뒤라 경로가 잠깐 증발한다. peer publication 이탈을 감지해 CF 반영 시차(2.5s·7s)를
   * 두고 heat 를 재조회한다(본인 주행의 onRideEndedWithPublication 대응).
   */
  const prevTrailLivePublicationIdsRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const prev = prevTrailLivePublicationIdsRef.current;
    const next = new Set(trailLivePublicationIds);
    const departed: string[] = [];
    for (const id of prev) {
      if (!next.has(id)) departed.push(id);
    }
    prevTrailLivePublicationIdsRef.current = next;
    if (departed.length === 0) return;
    invalidateRouteActivityCache(departed);
    const bump = () => {
      invalidateLiveRouteActivityIdsCache();
      reloadCourseActivityRef.current({ forceInvalidate: false });
      setActivityMapRefreshNonce((n) => n + 1);
    };
    // 타이머는 취소하지 않는다 — 새 이탈로 effect 가 재실행돼도 예약된 재조회는 유효(멱등)
    window.setTimeout(bump, 2_500);
    window.setTimeout(bump, 7_000);
  }, [trailLivePublicationIds]);

  /** 퍼블릭 코스 ID — 로그인 없이도 published 목록 로드(Rules: status=published 공개 읽기) */
  useEffect(() => {
    if (!configured || !pageVisible) return;
    void refreshPublishedPublicCourseCatalog();
  }, [configured, pageVisible, refreshPublishedPublicCourseCatalog]);

  useEffect(() => {
    if (!configured || !menuOpen) return;
    if (!user) {
      menuFirestorePrimedUidRef.current = null;
      return;
    }
    if (menuFirestorePrimedUidRef.current === user.uid) return;
    menuFirestorePrimedUidRef.current = user.uid;
    void refreshPublicRouteMeta();
  }, [configured, menuOpen, user, refreshPublicRouteMeta, refreshPublishedPublicCourseCatalog]);

  const onPublicRouteReviewQueueChanged = useCallback(() => {
    void refreshPublicRouteMeta();
    void refreshPublishedPublicCourseCatalog();
  }, [refreshPublicRouteMeta, refreshPublishedPublicCourseCatalog]);

  const onRefreshPublishedPublicCourses = useCallback(() => {
    void refreshPublishedPublicCourseCatalog();
  }, [refreshPublishedPublicCourseCatalog]);

  const onCoursePeerHudChange = useCallback((next: PeerHudEntry[]) => {
    setCoursePeerHud(next);
  }, []);

  const sharedRidePublicationId =
    basicActiveHubCourseId ?? activeOfficialCourseId ?? currentTrailMeta?.publicationId ?? null;

  // 동행 세션은 오직 입문 허브(basicActiveHubCourseId) 만 cross-Trail 커뮤니티로 공유한다.
  // 그 외(퍼블릭·공식 코스, 개인 주행) 는 모두 Trail 단위로 격리 → 같은 Trail 의 호스트·합류자는
  // 동일 scope 로 서로 보이고, 서로 다른 Trail(각자 개인 주행) 은 섞이지 않는다.
  // (activeOfficialCourseId 는 호스트만 갖고 합류자는 없어 scope 가 어긋나므로 기준에서 제외.)
  const sharedRideIsExplicitCourse = basicActiveHubCourseId != null;

  /** 입문 허브·퍼블릭 등 공식 코스 동행 presence — publish·필터 publicationId 와 동일 기준 */
  const sharedPresenceCourseId = sharedRidePublicationId;

  const sharedPresenceCourseTitle = useMemo(() => {
    if (!sharedPresenceCourseId) return undefined;
    if ((BASIC_SHARED_HUB_IDS as readonly string[]).includes(sharedPresenceCourseId)) {
      return getBasicHubCoursePayload(sharedPresenceCourseId).title;
    }
    return (
      publishedPublicCourses.find((c) => c.id === sharedPresenceCourseId)?.title ?? "공식 경로"
    );
  }, [sharedPresenceCourseId, publishedPublicCourses]);

  const selfRiderNametagFallback = useMemo(() => {
    if (!user) return null;
    if (sharedPresenceCourseId) return null;
    if (user.isAnonymous) return "guest";
    return user.displayName?.trim() || user.email?.trim() || "Rider";
  }, [user, sharedPresenceCourseId]);

  const resolvedLiveRiderNametag = useMemo(() => {
    return (liveRiderNametag ?? selfRiderNametagFallback)?.trim() || null;
  }, [liveRiderNametag, selfRiderNametagFallback]);

  const bleCrankRpm = useBleCrankRpm({ sessionActive: rideStatus !== "idle" });

  /** Conquest — 주행(running) 중 1초 간격으로 케이던스>0 시간 누적(§3.2 검증된 페달링) */
  const crankRpmForConquestRef = useRef<number | null>(null);
  useEffect(() => {
    crankRpmForConquestRef.current = bleCrankRpm.crankRpm;
  }, [bleCrankRpm.crankRpm]);
  const conquestSummaryRef = useRef(conquestSummary);
  useEffect(() => {
    conquestSummaryRef.current = conquestSummary;
  }, [conquestSummary]);
  const prevRideStatusRef = useRef(rideStatus);
  useEffect(() => {
    if (prevRideStatusRef.current === "idle" && rideStatus === "running") {
      // 새 세션 시작 — 센서 신호를 보기 전까지는 null(T0) 유지
      pedalActiveSecRef.current = null;
      // 주행 요약 「새 도로 +N km」 델타 기준점
      setConquestBaseline({
        meters: conquestSummaryRef.current?.totalMeters ?? 0,
      });
    }
    prevRideStatusRef.current = rideStatus;
    if (rideStatus !== "running") return;
    const timer = setInterval(() => {
      const rpm = crankRpmForConquestRef.current;
      if (rpm == null) return;
      if (pedalActiveSecRef.current == null) pedalActiveSecRef.current = 0;
      if (rpm > 0) pedalActiveSecRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [rideStatus]);

  /** Conquest — 핀 팝업 도로 상태 한 줄(내가 달린 도로인지, 로컬 판정 — 서버 읽기 없음) */
  const conquestCellIdSetRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    conquestCellIdSetRef.current = new Set(conquestCellIds ?? []);
  }, [conquestCellIds]);
  const handleLookupPioneer = useCallback(
    async (lngLat: LngLat): Promise<string | null> => {
      if (!configured || !user) return null;
      const owned = conquestCellIdSetRef.current;
      // 클릭 오차·도로 폭 관용 — 셀 + 8방 이웃 중 하나라도 내 도로면 인정
      const mine = conquestCellIdsAround(lngLat).some((id) => owned.has(id));
      return mine ? "🏴 내가 달린 도로" : null;
    },
    [configured, user],
  );

  /** 「내 도로망」 렌더용 geometry 배열 */
  const conquestTraceGeometries = useMemo(
    () => (conquestTraces ? conquestTraces.map((t) => t.geometry) : null),
    [conquestTraces],
  );

  /** 주행 요약 「새 도로 +N km」 — CF 집계 완료 시 반응형 갱신 */
  const conquestSummaryLine = useMemo(() => {
    if (!conquestSummary || !conquestBaseline) return null;
    const newMeters = Math.max(0, conquestSummary.totalMeters - conquestBaseline.meters);
    if (newMeters < 50) return null; // 50m 미만은 「+0.0km」 — 미표시(0 미표시 원칙)
    return `새 도로 +${(newMeters / 1000).toFixed(newMeters < 10000 ? 1 : 0)}km`;
  }, [conquestSummary, conquestBaseline]);

  /** 라이브 어스 — 주행 지역의 현재 날씨·밤낮(Open-Meteo). 세션 중 30분 간격 갱신. */
  const [liveWeatherHint, setLiveWeatherHint] = useState<string | null>(null);
  /** 화면 날씨 비주얼(밤 틴트·비·눈·안개…) 용 원본 데이터. */
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null);
  /** 개발용 — URL `?weather=rain` 등으로 비주얼 강제(실제 데이터 무관). 출시 전 무해(파라미터 없으면 null). */
  const weatherOverride = useMemo(
    () => parseWeatherOverride(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  useEffect(() => {
    if (rideStatus === "idle") {
      setLiveWeatherHint(null);
      setLiveWeather(null);
      return;
    }
    const at = startLngLat ?? endLngLat;
    if (!at) return;
    const ac = new AbortController();
    const load = async () => {
      const w = await fetchOpenMeteoCurrentWeather(at, ac.signal);
      if (w && !ac.signal.aborted) {
        setLiveWeatherHint(formatLiveWeatherHudLine(w));
        setLiveWeather(w);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30 * 60 * 1000);
    return () => {
      ac.abort();
      clearInterval(timer);
    };
  }, [rideStatus, startLngLat, endLngLat]);

  const bleCadencePanel = useMemo(() => {
    if (!bleCrankRpm.capable) return undefined;
    return {
      uiState: bleCrankRpm.uiState,
      crankRpm: bleCrankRpm.crankRpm,
      deviceLabel: bleCrankRpm.deviceLabel,
      errorMessage: bleCrankRpm.errorMessage,
      onConnect: () => void bleCrankRpm.connect(),
      onDisconnect: bleCrankRpm.disconnect,
    };
  }, [
    bleCrankRpm.capable,
    bleCrankRpm.uiState,
    bleCrankRpm.crankRpm,
    bleCrankRpm.deviceLabel,
    bleCrankRpm.errorMessage,
    bleCrankRpm.connect,
    bleCrankRpm.disconnect,
  ]);

  const { coachData, rideElevationProfile, rideBgmCatalogConfigured } = useRideCoachingMedia({
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
    sessionStatus: rideStatus,
    speedKmh,
    rideTtsEnabled,
    rideBgmEnabled,
  });
  const rideElevationProfileLoading = rideElevationProfile.loading;
  const { arrivalToastTick, resetArrivalToast, resetArrivalGate } = useRideArrivalAutoEnd({
    rideStatus,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
    endRideRef: handleEndRideRef,
  });

  /** 비로그인 상태에서는 사용자 시트 액션(Trailhead/로그아웃)이 없으므로 시트를 닫음 */
  useEffect(() => {
    if (!user) setUserInfoSheetOpen(false);
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sub = params.get("subscription");
    if (!sub) return;
    if (sub === "success") {
      setSubscriptionFlash("구독 완료 — 곧 반영됩니다");
      setUserInfoSheetOpen(true);
    } else if (sub === "cancel") {
      setSubscriptionFlash("결제가 취소되었습니다.");
    }
    params.delete("subscription");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  useEffect(() => {
    if (!configured || !user) return;
    void ensureBasicCoursesSeeded(user.uid).catch(() => {
      // 기본 코스 시드 실패는 치명적 오류로 다루지 않고 앱 동작을 유지한다.
    });
  }, [configured, user]);

  /** 코스 id 가 바뀌거나 빠질 때마다 비움 — 다른 코스로 바꿀 때 이전 동행 마커가 남지 않게 함 */
  useEffect(() => {
    startTransition(() => setCoursePeerHud([]));
  }, [sharedPresenceCourseId]);

  useEffect(() => {
    if (!sharedPresenceCourseId) setLiveRiderNametag(null);
  }, [sharedPresenceCourseId]);

  const avgSpeedLabel = useMemo(() => {
    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    if (elapsedSec <= 0) return "0.0";
    // 이어 달리기 시 평속은 이번 세션 실주행(누적 − offset) 기준 — 누적으로 나누면 왜곡(§9.5.5 단위7)
    const sessionMeters = Math.max(
      0,
      rideMetrics.virtualDistanceMeters - sessionStartOffsetMeters,
    );
    const avg = (sessionMeters / 1000) / (elapsedSec / 3600);
    return avg.toFixed(1);
  }, [rideMetrics.accumulatedMs, rideMetrics.virtualDistanceMeters, sessionStartOffsetMeters]);

  const returnToTrailhead = useCallback(() => {
    const tid = DEFAULT_TRAIL_ID;
    setTrailDraft(tid);
    setTrailId(tid);
    replaceTrailInUrl(tid);
    hostTrailIdRef.current = null;
    setTrailMetaSeed(null);
  }, [setTrailDraft, setTrailId]);

  const goTrailheadAndCloseMenu = useCallback(() => {
    if (rideStatus === "running" || rideStatus === "paused") return;
    returnToTrailhead();
    setMenuOpen(false);
  }, [returnToTrailhead, rideStatus]);

  const loadCourseRouteForTrailJoin = useCallback(
    async (courseId: string) => {
      if ((BASIC_SHARED_HUB_IDS as readonly string[]).includes(courseId)) {
        await enterBasicHub(courseId);
        return;
      }
      const payload = configured ? await fetchCourseRoutePayload(courseId).catch(() => null) : null;
      if (!payload?.geometry?.coordinates?.length) {
        setRouteSummary(`Trail 코스(${courseId}) 경로를 불러오지 못했습니다.`);
        return;
      }
      const coords = payload.geometry.coordinates;
      resetRide();
      setRouteGeometry(payload.geometry);
      setStartLngLat(coords[0] ?? null);
      setEndLngLat(coords[coords.length - 1] ?? null);
      setRouteWaypoints([]);
      setProfile(payload.profile);
      setRouteDistanceMeters(payload.distanceMeters);
      setRouteDurationSec(payload.durationSec);
      setActiveOfficialCourseId(courseId);
      setBasicActiveHubCourseId(null);
      setPlaceSearchMarkerLngLat(null);
      setRouteSummary(
        `Trail 합류 · ${payload.title} · ${(payload.distanceMeters / 1000).toFixed(2)} km`,
      );
    },
    [
      configured,
      enterBasicHub,
      resetRide,
      setRouteGeometry,
      setStartLngLat,
      setEndLngLat,
      setRouteWaypoints,
      setProfile,
      setRouteDistanceMeters,
      setRouteDurationSec,
      setActiveOfficialCourseId,
      setBasicActiveHubCourseId,
      setPlaceSearchMarkerLngLat,
      setRouteSummary,
    ],
  );

  const joinTrailAndCloseMenu = useCallback(
    (nextTrailId: string, listingPublicationId?: string | null) => {
      if (rideStatus !== "idle") {
        setRouteSummary("주행 중에는 Trail을 바꿀 수 없습니다.");
        return;
      }
      const next = sanitizeTrailId(nextTrailId);
      if (next === DEFAULT_TRAIL_ID) return;
      void (async () => {
        const meta = await fetchTrailInstance(next).catch(() => null);
        if (!meta) {
          setRouteSummary("Trail을 찾을 수 없습니다.");
          return;
        }
        const listingPub =
          listingPublicationId?.trim() ||
          (await fetchOpenTrailListingPublicationId(next).catch(() => null));
        const resolvedMeta = withResolvedTrailPublicationId(meta, listingPub);
        const gate = canUserJoinTrail(resolvedMeta, user);
        if (!gate.ok) {
          setRouteSummary(gate.message);
          return;
        }
        if (resolvedMeta.publicationId) {
          await loadCourseRouteForTrailJoin(resolvedMeta.publicationId);
        }
        hostTrailIdRef.current = null;
        rememberTrailDisplayNumber(resolvedMeta.id, resolvedMeta.displayNumber);
        setTrailMetaSeed(resolvedMeta);
        setTrailDraft(next);
        setTrailId(next);
        replaceTrailInUrl(next);
        setMenuOpen(false);
      })();
    },
    [rideStatus, setRouteSummary, setTrailDraft, setTrailId, loadCourseRouteForTrailJoin, user],
  );

  const handleSetTrailVisibility = useCallback(
    (visibility: "open" | "private") => {
      if (!currentTrailMeta || !user || currentTrailMeta.hostUid !== user.uid) return;
      setTrailVisibilityBusy(true);
      void setTrailVisibility(currentTrailMeta.id, visibility)
        .then(() => reloadCurrentTrailMeta())
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          setError(message);
        })
        .finally(() => setTrailVisibilityBusy(false));
    },
    [currentTrailMeta, user, reloadCurrentTrailMeta, setError],
  );

  /** URL·북마크로 비공개 Trail 등에 직접 진입한 경우 Trailhead로 되돌림 */
  useEffect(() => {
    if (!configured || !user || rideStatus !== "idle") return;
    const tid = sanitizedTrailId;
    if (tid === DEFAULT_TRAIL_ID) return;
    let cancelled = false;
    void (async () => {
      const meta = await fetchTrailInstance(tid).catch(() => null);
      if (cancelled) return;
      if (!meta) {
        setRouteSummary("Trail을 찾을 수 없습니다.");
        returnToTrailhead();
        return;
      }
      const listingPub = await fetchOpenTrailListingPublicationId(tid).catch(() => null);
      const resolvedMeta = withResolvedTrailPublicationId(meta, listingPub);
      const gate = canUserJoinTrail(resolvedMeta, user);
      if (!gate.ok) {
        setRouteSummary(gate.message);
        returnToTrailhead();
        return;
      }
      if (resolvedMeta.publicationId) {
        await loadCourseRouteForTrailJoin(resolvedMeta.publicationId);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trailId 전환 시 1회만 검증·경로 로드
  }, [sanitizedTrailId, user?.uid, configured, rideStatus]);

  /**
   * 이어 달리기(§9.5.5 단위7) — 로드된 미완주 저장 경로의 재개 후보 진행률(0..1).
   * 후보 id 는 로드 시 state 로 받고(렌더 중 ref 읽기 금지 준수), 진행률·완주 여부는
   * savedRoutes state 에서 파생 — 삭제·완주 격상 시 UI 가 자동 무효화된다.
   */
  const resumeRatio = (() => {
    if (rideStatus !== "idle" || !routeGeometry || !resumeCandidateId) return null;
    const route = savedRoutes.find((r) => r.id === resumeCandidateId);
    if (!route || route.completed === 1) return null;
    const ratio = route.lastProgressRatio;
    return Number.isFinite(ratio) && ratio > 0 && ratio < ROUTE_COMPLETION_RATIO_THRESHOLD
      ? ratio
      : null;
  })();

  function handleStartRide(fromStart?: boolean) {
    if (!routeGeometry || rideStatus !== "idle" || !user || !configured || trailStartBusy) return;
    // MapHud FAB 등 onClick 직결 호출은 이벤트 객체가 첫 인자로 올 수 있어 `=== true` 로만 판정
    const restart = fromStart === true;
    /**
     * 재개 시작 오프셋(m) — 「위치는 누적, 인정은 세션」의 위치 시드(§9.5.5 단위7).
     * 이벤트 핸들러 내부라 ref 검증 허용 — 실제 로드된 경로와 후보가 일치할 때만 시드.
     */
    const rideStartOffsetMeters =
      !restart && resumeRatio != null && loadedSavedRouteIdRef.current === resumeCandidateId
        ? resumeOffsetMetersFrom(resumeRatio, routeDistanceMeters)
        : 0;
    setTrailStartBusy(true);
    const courseId = basicActiveHubCourseId ?? activeOfficialCourseId;
    const courseTitle = courseId
      ? (BASIC_SHARED_HUB_IDS as readonly string[]).includes(courseId)
        ? getBasicHubCoursePayload(courseId).title
        : (publishedPublicCourses.find((c) => c.id === courseId)?.title ?? null)
      : null;
    const regionLabel = buildTrailRegionLabel({
      startPlaceLabel,
      endPlaceLabel,
      courseTitle,
    });
    void (async () => {
      try {
        const currentTid = sanitizeTrailId(trailId);

        /** MENU에서 연 Trail 합류 후 ▶ — 새 Trail 생성하지 않음 */
        if (currentTid !== DEFAULT_TRAIL_ID) {
          const existingRaw = await fetchTrailInstance(currentTid);
          if (!existingRaw) {
            setError("선택한 Trail을 찾을 수 없습니다.");
            return;
          }
          const listingPub = await fetchOpenTrailListingPublicationId(currentTid).catch(() => null);
          const existing = withResolvedTrailPublicationId(existingRaw, listingPub);
          const gate = canUserJoinTrail(existing, user);
          if (!gate.ok) {
            setError(gate.message);
            return;
          }
          if (existing.status !== "open") {
            setError("이 Trail은 종료되었습니다.");
            return;
          }
          hostTrailIdRef.current = existing.hostUid === user.uid ? existing.id : null;
          rememberTrailDisplayNumber(existing.id, existing.displayNumber);
          setTrailMetaSeed(existing);
          void touchTrailInstanceActivity(currentTid);
          const num = formatTrailDisplayNumber(existing.displayNumber);
          setRouteSummary(
            `Trail ${num} 합류 · ${existing.regionLabel?.trim() || "같은 Trail에서 주행"}`,
          );
          resetArrivalGate();
          resetRide(rideStartOffsetMeters);
          setSessionStartOffsetMeters(rideStartOffsetMeters);
          setResumeCandidateId(null); // 재개 후보 소비 — 종료 후 재로드 전까지 재개 UI 미표시
          setRidingTrailId(currentTid);
          setRideStatus("running");
          return;
        }

        const visibility = resolveNewTrailVisibility(courseId);
        const trail = await createTrailInstance({
          hostUid: user.uid,
          publicationId: courseId ?? null,
          regionLabel,
          distanceKm: routeDistanceMeters > 0 ? routeDistanceMeters / 1000 : null,
          visibility,
        });
        hostTrailIdRef.current = trail.id;
        rememberTrailDisplayNumber(trail.id, trail.displayNumber);
        setTrailMetaSeed(trail);
        const prev = sanitizeTrailId(trailId);
        if (prev !== trail.id) {
          await deleteTrailPresence(user.uid, prev).catch(() => {});
        }
        setTrailId(trail.id);
        setTrailDraft(trail.id);
        replaceTrailInUrl(trail.id);
        const num = formatTrailDisplayNumber(trail.displayNumber);
        setRouteSummary(
          `Trail ${num} 개설 · ${trail.regionLabel?.trim() || regionLabel.trim() || "새 Trail"}`,
        );
        reloadCurrentTrailMeta();
        resetArrivalGate();
        resetRide(rideStartOffsetMeters);
        setSessionStartOffsetMeters(rideStartOffsetMeters);
        setResumeCandidateId(null); // 재개 후보 소비 — 종료 후 재로드 전까지 재개 UI 미표시
        setRidingTrailId(trail.id);
        setRideStatus("running");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
      } finally {
        setTrailStartBusy(false);
      }
    })();
  }

  const handleEndRideWithTrailCleanup = useCallback(() => {
    const endedTrailId = sanitizeTrailId(
      ridingTrailId && (rideStatus === "running" || rideStatus === "paused")
        ? ridingTrailId
        : trailId,
    );
    const uid = user?.uid ?? null;
    const wasHostTrail = hostTrailIdRef.current === endedTrailId;
    setRidingTrailId(null);
    handleEndRide();
    void (async () => {
      if (uid && wasHostTrail && endedTrailId !== DEFAULT_TRAIL_ID) {
        await closeTrailInstance(endedTrailId).catch(() => {});
      }
      returnToTrailhead();
    })();
  }, [trailId, ridingTrailId, rideStatus, user?.uid, handleEndRide, returnToTrailhead]);

  useEffect(() => {
    handleEndRideRef.current = handleEndRideWithTrailCleanup;
  }, [handleEndRideWithTrailCleanup]);

  function handlePause() {
    if (rideStatus !== "running") return;
    setRideStatus("paused");
    syncLiveFromDistance();
  }

  function handleResume() {
    if (rideStatus !== "paused") return;
    setRideStatus("running");
  }

  /** 도착 시 결과 시트가 열림. 닫기는 사용자 명시 액션. */
  useEffect(() => {
    if (arrivalToastTick === 0) return;
    setSummarySheetVisible(true);
  }, [arrivalToastTick]);

  /** ad-hoc 저장 안내가 새로 생기면 결과 시트도 함께 노출 */
  useEffect(() => {
    if (lastEndedWasAdhoc) setSummarySheetVisible(true);
  }, [lastEndedWasAdhoc]);

  /** Trailhead·코스 정리 후 Firebase 로그아웃 — 맵·기능 없이 앱 이탈(재진입은 게이트에서) */
  async function handleServiceExit() {
    setError(null);
    setBusy(true);
    try {
      if (rideStatus !== "idle") {
        setRideStatus("idle");
        resetRide();
      }
      if (user) {
        await deleteTrailPresence(user.uid, trailId).catch(() => {
          /* noop */
        });
        await deleteGlobalLivePresence(user.uid).catch(() => {
          /* noop */
        });
        for (const hid of BASIC_SHARED_HUB_IDS) {
          await deletePublicationSessionMember(user.uid, hid).catch(() => {
            /* noop */
          });
        }
      }
      setBasicActiveHubCourseId(null);
      reloadRecentSessionsFromLocalStorage();
      await completeFirebaseSignOut();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  /** 지도·동행 공유: 항상 경로 폴리라인 위의 점만 사용(가상 거리 → 선상 보간). `liveLngLat` 직접 사용 시 경로와 미세 어긋날 수 있음 */
  const liveForMap: LngLat | null = useMemo(() => {
    if (rideStatus === "idle") return null;
    if (!routeGeometry || routeGeometry.coordinates.length < 2) {
      return rideMetrics.liveLngLat ?? null;
    }
    const geoLen = lineStringLengthMeters(routeGeometry);
    if (!Number.isFinite(geoLen) || geoLen <= 0) return rideMetrics.liveLngLat ?? null;
    const d = rideDistanceAlongRoute(
      rideMetrics.virtualDistanceMeters,
      routeDistanceMeters,
      geoLen,
    );
    return getPointOnRouteByDistance(routeGeometry, d);
  }, [
    rideStatus,
    rideMetrics.virtualDistanceMeters,
    rideMetrics.liveLngLat,
    routeGeometry,
    routeDistanceMeters,
  ]);

  const globalPresencePublishLngLat = useMemo(
    (): LngLat => liveForMap ?? mapViewportCenterLngLat,
    [liveForMap, mapViewportCenterLngLat],
  );

  const activeCourseIdForGlobalPresence =
    basicActiveHubCourseId ?? activeOfficialCourseId ?? currentTrailMeta?.publicationId ?? null;

  const debugGlobalPresenceOnMap =
    import.meta.env.DEV &&
    import.meta.env.VITE_DEBUG_GLOBAL_LIVE_PRESENCE_ON_MAP === "true";

  const globalLivePresenceSubscribeEnabled = Boolean(
    configured &&
      user &&
      pageVisible &&
      (debugGlobalPresenceOnMap || Boolean(activeCourseIdForGlobalPresence?.trim())),
  );

  const globalLivePresencePublishEnabled = Boolean(
    configured &&
      user &&
      pageVisible &&
      isRideSessionActive &&
      Boolean(activeCourseIdForGlobalPresence?.trim()),
  );

  useLiveLocationPublishSession({
    user,
    globalEnabled: globalLivePresencePublishEnabled,
    routeEnabled: Boolean(
      trailheadSessionActive &&
        isRideSessionActive &&
        sharedRidePublicationId &&
        Boolean(routeGeometry?.coordinates?.length),
    ),
    pageVisible,
    lngLat: globalPresencePublishLngLat,
    // peer 동기화는 메뉴 네비(trailId)가 아니라 실제 주행 trail(ridingTrailId)에 publish해야
    // 같은 trail의 motion 노드를 공유한다. 주행 중 메뉴가 Trailhead("default")로 가도 어긋나지 않음.
    trailId: menuTrailSanitizedId,
    publicationId: sharedRidePublicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
    speedKmh,
    routeRidePhase: rideStatus === "paused" ? "paused" : "live",
    joinBurstNonce: rideJoinBurstNonce,
  });

  const { dots: globalPresenceDots } = useGlobalLivePresence({
    user,
    enabled: globalLivePresenceSubscribeEnabled,
  });

  const { streetState: rideMapillaryStreet, rideSync: mapillaryRideSync, dismissStreet: dismissMapillaryStreet } =
    useRideMapillaryStreet({
      user,
      accessToken: mapillaryTokenConfigured ? MAPILLARY_CLIENT_TOKEN : null,
      routeGeometry,
      routeTotalMeters: routeDistanceMeters,
      virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
      sessionStatus: rideStatus,
      speedKmh,
      riderLngLat: liveForMap,
    });

  /** Firebase 미설정이거나 인증 준비 완료 후 — Trailhead·입문 코스 UI가 숨겨지지 않도록 메인 워크스페이스 표시 */
  const rideWorkspaceOpen = !configured || (configured && authInitialized);
  void rideWorkspaceOpen;

  // ===== Map-first stage 머신 =====
  const summaryVisible = summarySheetVisible && (arrivalToastTick > 0 || lastEndedWasAdhoc !== null);
  const needsGuestEntry =
    configured &&
    authInitialized &&
    !user &&
    !userSignedOut &&
    !readGuestEntryAccepted();

  const needsAuthCard =
    !configured ||
    !authInitialized ||
    (!allowUnauthMapDev() && !user);
  const needsNicknameCard =
    configured && Boolean(user) && !user!.isAnonymous && fsSync.state === "awaiting_nickname";
  const stage = useRideUiStage({
    needsAuthCard,
    needsNicknameCard,
    rideStatus,
    hasRoute: Boolean(routeGeometry) && routeDistanceMeters > 0,
    hasStartPin: Boolean(startLngLat),
    hasEndPin: Boolean(endLngLat),
    summaryVisible,
  });
  /** 맵 핀·경로 생성 등 — 프로덕션 주행 중에만 맵에서 잠금(좌측 MENU 패널은 항상 사용 가능) */
  const routeMenuLockedForProd = lockRouteWorkspaceDuringRide(rideStatus !== "idle");

  const handleClearPins = useCallback(() => {
    clearRoutePins(routeMenuLockedForProd);
  }, [clearRoutePins, routeMenuLockedForProd]);

  const handleMapRouteProfile = useCallback(
    (p: RouteProfile) => {
      // 토큰 부족(잔액<1)이면 RouteDock·지도 핀 팝업 어느 쪽에서도 생성을 막는다(정책 통일).
      if (routeTokenBalance != null && routeTokenBalance < 1) return;
      applyRouteProfileForMapLocked(routeMenuLockedForProd, p);
    },
    [applyRouteProfileForMapLocked, routeMenuLockedForProd, routeTokenBalance],
  );

  const routeDockStops = useRouteDockStops({
    startLngLat,
    endLngLat,
    routeWaypoints,
    startLabel,
    endLabel,
    waypointLabels: waypointLabelsForPanel,
  });

  const handleRemoveRouteDockStop = useCallback(
    (id: RouteDockStopId) => {
      if (routeMenuLockedForProd) return;
      if (id === "start") setStartLngLat(null);
      else if (id === "end") setEndLngLat(null);
      else {
        const idx = Number(id.replace("wp-", ""));
        if (Number.isFinite(idx)) {
          setRouteWaypoints((prev) => prev.filter((_, i) => i !== idx));
        }
      }
    },
    [routeMenuLockedForProd, setStartLngLat, setEndLngLat, setRouteWaypoints],
  );

  const handleFocusRouteDockStop = useCallback(
    (stop: RouteDockStop) => {
      setFollowMode("free");
      cameraJumpSeqRef.current += 1;
      setExternalCameraJump({
        lngLat: stop.lngLat,
        zoom: Math.max(mapZoom, 15),
        requestId: cameraJumpSeqRef.current,
      });
    },
    [mapZoom],
  );

  const routeDockPanel = (
    <RouteDock
      stage={stage}
      stops={routeDockStops}
      routeLoading={routeLoading}
      speedKmh={speedKmh}
      onSpeedKmh={setSpeedKmh}
      canStartRide={Boolean(routeGeometry) && !routeLoading}
      canSaveRoute={
        Boolean(user) &&
        configured &&
        Boolean(routeGeometry) &&
        routeDistanceMeters > 0 &&
        !routeLoading &&
        !routeMenuLockedForProd
      }
      onSaveCurrentRoute={handleSaveCurrentRoute}
      onStartRide={handleStartRide}
      resumeRatio={resumeRatio}
      onClearRoute={handleClearPins}
      onRemoveStop={handleRemoveRouteDockStop}
      onFocusStop={handleFocusRouteDockStop}
      editLocked={routeMenuLockedForProd}
      onIncompleteQuotaBlocked={handleIncompleteQuotaBlocked}
    />
  );

  // ===== Map-first 핸들러 =====
  function handleMenuPlacePick(lngLat: LngLat, _placeName: string, _bbox: [number, number, number, number] | null) {
    /** `liveForMap` 추적 jumpTo 가 flyTo 를 덮어쓰지 않도록 */
    setFollowMode("free");
    cameraJumpSeqRef.current += 1;
    setExternalCameraJump({
      lngLat,
      /** 검색 위치 이동은 줌 13 고정 — bbox fitBounds 는 줌이 들쭉날쭉해져서 사용하지 않음 */
      bbox: null,
      zoom: 13,
      requestId: cameraJumpSeqRef.current,
    });
    setPlaceSearchMarkerLngLat(lngLat);
    setPlaceSearchOpen(false);
  }

  function handleCloseSummary() {
    setSummarySheetVisible(false);
    resetArrivalToast();
    setLastEndedWasAdhoc(null);
  }

  function handleModifyFromPause() {
    handleEndRide();
    openMenuPanel();
  }

  const elapsedLabel = formatElapsedFromMs(rideMetrics.accumulatedMs);
  /** HUD 거리·종료 요약·기록용 — 이번 세션 실주행 거리(오늘 N km, 재개 시 offset 차감) */
  const sessionDistanceMeters = Math.max(
    0,
    rideMetrics.virtualDistanceMeters - sessionStartOffsetMeters,
  );
  const sessionDistanceKmLabel = (sessionDistanceMeters / 1000).toFixed(2);
  const hudRoutePreview =
    rideStatus === "idle" &&
    Boolean(routeGeometry) &&
    routeDistanceMeters > 0 &&
    !summarySheetVisible;

  const hudMetrics =
    rideStatus !== "idle"
      ? {
          mode: "ride" as const,
          elapsed: elapsedLabel,
          distanceKm: sessionDistanceKmLabel,
          avgKmh: avgSpeedLabel,
          /* 램핑 적용속도는 소수 꼬리가 길다 — HUD 칩엔 정수만 */
          speedKmh: Math.round(rideMetrics.appliedSpeedKmh),
          /* 주행경로 전체거리 — 경로 확정 시에만(0=미확정 → 병기 생략) */
          routeTotalKm:
            routeDistanceMeters > 0 ? (routeDistanceMeters / 1000).toFixed(2) : null,
        }
      : hudRoutePreview
        ? {
            mode: "route-preview" as const,
            elapsed: "00:00",
            distanceKm: (routeDistanceMeters / 1000).toFixed(2),
            avgKmh: "0",
            speedKmh: 0,
          }
        : null;
  const accountInitial = (() => {
    if (!user) return null;
    if (user.isAnonymous) return "G";
    const src = user.displayName?.trim() || user.email?.trim() || "U";
    return src.slice(0, 1).toUpperCase();
  })();
  const accountLabel = (() => {
    if (!user) return "";
    if (user.isAnonymous) return "게스트";
    return user.displayName?.trim() || user.email?.trim() || "Rider";
  })();
  const accountMileageKm = (() => {
    const m = userTier.mileageTotalMeters;
    if (m == null || m <= 0) return null;
    return Math.round(m / 1000);
  })();
  const accountChip =
    user && accountInitial !== null
      ? {
          initial: accountInitial,
          isGuest: user.isAnonymous,
          label: accountLabel,
          mileageKm: accountMileageKm,
        }
      : null;
  const caloriesEstimate = Math.round((sessionDistanceMeters / 1000) * 30);

  const mapHudRidePresence = useMemo(() => {
    if (!configured || !user) return null;
    const courseTitle = sharedPresenceCourseId
      ? (sharedPresenceCourseTitle?.trim() || "공식 경로")
      : null;
    const trailMembers = trailSession.rows.map((r) => ({
      key: r.uid,
      display: r.displayName?.trim() || r.uid.slice(0, 8),
      isSelf: r.uid === user.uid,
      active: isTrailMemberActive(r.lastSeenAtMs),
    }));
    // 동행 블록은 접속(Trail) 블록에 이미 뜬 사람을 다시 보여주지 않는다 — 같은 Trail 에서 코스를
    // 함께 타면 접속·동행 소스가 같은 사람을 잡아 이름이 두 번 나오던 중복 표시를 제거한다.
    const activeTrailMemberUids = new Set(
      trailMembers.filter((m) => m.active).map((m) => m.key),
    );
    const coursePeerNames = peerHudLabels(
      coursePeerHud.filter((p) => !activeTrailMemberUids.has(p.id)),
    );
    const trailError = trailSession.error;
    const courseActivityHudLine = formatRouteActivityHudLine(courseActivity);
    // presence 와 동일한 Trail 기준으로 라벨·Trailhead 판정(주행 중 네비 trailId 와 어긋남 방지).
    const tid = presenceTrailId;
    return {
      trailheadEnabled: true,
      trailId: tid,
      /** 현재 Trailhead에 있는지 — HUD 「Trailhead로」 버튼 노출 판단 */
      onTrailhead: tid === DEFAULT_TRAIL_ID,
      trailDisplayLabel: trailDisplayLabels.short,
      trailLabel: trailDisplayLabels.label,
      trailMembers,
      trailError,
      courseTitle,
      coursePeerNames,
      courseActivityHudLine,
    };
  }, [
    configured,
    user,
    trailId,
    presenceTrailId,
    trailDisplayLabels,
    currentTrailMeta,
    trailSession.rows,
    trailSession.error,
    sharedPresenceCourseId,
    sharedPresenceCourseTitle,
    coursePeerHud,
    courseActivity,
  ]);

  return (
    <div className="app-shell app-shell--map-first">
      <RotateOverlay />

      <div className="app-map-stage">
        {debugMapIsolationActive ? (
          <DebugMapStage
            accessToken={MAPBOX_TOKEN || undefined}
            mapStyle={mapStyle}
            mapZoom={mapZoom}
            onMapZoom={setMapZoom}
            onMapViewport={onMapViewport}
            mapHud={{
              stage,
              onOpenMenu: openMenuPanel,
              menuOpen,
              onOpenPlaceSearch: openPlaceSearchPanel,
              placeSearchOpen,
              account: accountChip,
              onOpenUserInfo: openUserInfoPanel,
              userInfoOpen: userInfoSheetOpen,
              authGateVisualDismissed: needsAuthCard,
              onOpenMapView: openMapViewPanel,
              mapViewOpen: mapViewSheetOpen,
              idleHintMessage: "MENU → 입문 경로",
              coachData,
              coachLineEnabled: rideCoachingBannerVisible,
              metrics: hudMetrics,
              onClearPins: handleClearPins,
              routeError: null,
              canStartRide: Boolean(routeGeometry) && !routeLoading,
              onStartRide: handleStartRide,
              onPauseRide: handlePause,
              onResumeRide: handleResume,
              onEndRide: handleEndRideWithTrailCleanup,
              onResumeFromPause: handleResume,
              onEndFromPause: handleEndRideWithTrailCleanup,
              onModifyFromPause: handleModifyFromPause,
              showIdleHint: stage === "idle" && !idleHintDismissed,
              onDismissIdleHint: () => setIdleHintDismissed(true),
              ridePresence: mapHudRidePresence,
              onGoTrailhead: goTrailheadAndCloseMenu,
              weatherHint: liveWeatherHint,
              conquestLiveMeters,
            }}
          >
            {rideMapillaryStreet && mapillaryRideSync && mapillaryTokenConfigured ? (
              <div className="mapillary-street-floating" aria-label="Mapillary 거리뷰">
                <div className="mapillary-street-floating__head">
                  <span className="mapillary-street-floating__title">Mapillary</span>
                  <button
                    type="button"
                    className="mapillary-street-floating__close"
                    title="Close street view"
                    onClick={dismissMapillaryStreet}
                  >
                    닫기
                  </button>
                </div>
                <div className="mapillary-street-floating__video">
                  <Suspense
                    fallback={<div className="mapillary-street-floating__loading">거리뷰 로드 중…</div>}
                  >
                    <MapillaryRideViewer
                      accessToken={MAPILLARY_CLIENT_TOKEN}
                      imageId={rideMapillaryStreet.imageKey}
                      lookAt={mapillaryRideSync.lookAt}
                      driveHeadingDeg={mapillaryRideSync.driveHeadingDeg}
                      sphericalNavigation={rideMapillaryStreet.isPano}
                    />
                  </Suspense>
                </div>
                <p className="mapillary-street-floating__attr">Imagery © Mapillary contributors</p>
              </div>
            ) : null}
          </DebugMapStage>
        ) : (
          <AppMapStage
            routeDock={routeDockPanel}
            weatherOverlay={<WeatherOverlay weather={weatherOverride ?? liveWeather} />}
            mapView={{
              accessToken: MAPBOX_TOKEN || undefined,
              routeElevationProfile: rideElevationProfile,
              routeGeometry,
              routeDistanceMeters,
              startLngLat,
              endLngLat,
              routeWaypoints,
              liveLngLat: liveForMap,
              sampleLiveLngLat: rideStatus === "idle" ? undefined : sampleLiveLngLat,
              liveRiderMotion:
                rideStatus === "idle"
                  ? null
                  : {
                      sessionStatus: rideStatus,
                      speedKmh: rideMetrics.appliedSpeedKmh,
                      crankRpmFromSensor: bleCrankRpm.crankRpm,
                    },
              liveRiderNametag: resolvedLiveRiderNametag,
              mapStyle,
              mapZoom,
              followMode,
              enable3D,
              onMapZoom: setMapZoom,
              onMapViewport,
              onMapLodViewport,
              coverageOverlayMode,
              mapillaryClientToken: mapillaryTokenConfigured ? MAPILLARY_CLIENT_TOKEN : null,
              routeProfile: profile,
              onRouteProfile: handleMapRouteProfile,
              routeTokenInsufficient: routeTokenBalance != null && routeTokenBalance < 1,
              conquestTraces: conquestTraceGeometries,
              conquestLiveTraveledMeters:
                rideStatus === "running" || rideStatus === "paused"
                  ? rideMetrics.virtualDistanceMeters
                  : null,
              onLookupPioneer: handleLookupPioneer,
              onClearRoute: handleClearPins,
              onSelectPoint: (type, lngLat, waypointSlot) => {
                if (!user || routeMenuLockedForProd) return;
                setActiveOfficialCourseId(null);
                setPlaceSearchMarkerLngLat(null);
                if (type === "start") setStartLngLat(lngLat);
                else if (type === "end") setEndLngLat(lngLat);
                else {
                  const slot = waypointSlot ?? 0;
                  setRouteWaypoints((prev) => {
                    if (slot < prev.length) {
                      return prev.map((p, j) => (j === slot ? lngLat : p));
                    }
                    if (slot === prev.length && prev.length < MAX_ROUTE_WAYPOINTS) {
                      return [...prev, lngLat];
                    }
                    return prev;
                  });
                }
              },
              externalCameraJump,
              placeSearchMarkerLngLat,
              trailSpectatorDots: spectatorDots,
              trailSpectatorRoutes: spectatorRouteGeometries,
              globalPresenceDots: debugGlobalPresenceOnMap ? globalPresenceDots : null,
              activityWorldRaw,
              getActivityWorldPinLabel,
              rideFollowCameraNonce,
            }}
            lodDebug={lodDebugPanelProps}
            mapHud={{
              stage,
              onOpenMenu: openMenuPanel,
              menuOpen,
              onOpenPlaceSearch: openPlaceSearchPanel,
              placeSearchOpen,
              account: accountChip,
              onOpenUserInfo: openUserInfoPanel,
              userInfoOpen: userInfoSheetOpen,
              authGateVisualDismissed: needsAuthCard,
              onOpenMapView: openMapViewPanel,
              mapViewOpen: mapViewSheetOpen,
              idleHintMessage: "MENU → 입문 경로",
              coachData,
              coachLineEnabled: rideCoachingBannerVisible,
              metrics: hudMetrics,
              onClearPins: handleClearPins,
              routeError: null,
              canStartRide: Boolean(routeGeometry) && !routeLoading,
              onStartRide: handleStartRide,
              onPauseRide: handlePause,
              onResumeRide: handleResume,
              onEndRide: handleEndRideWithTrailCleanup,
              onResumeFromPause: handleResume,
              onEndFromPause: handleEndRideWithTrailCleanup,
              onModifyFromPause: handleModifyFromPause,
              showIdleHint: stage === "idle" && !idleHintDismissed,
              onDismissIdleHint: () => setIdleHintDismissed(true),
              ridePresence: mapHudRidePresence,
              onGoTrailhead: goTrailheadAndCloseMenu,
              weatherHint: liveWeatherHint,
              conquestLiveMeters,
            }}
          >
            {rideMapillaryStreet && mapillaryRideSync && mapillaryTokenConfigured ? (
              <div className="mapillary-street-floating" aria-label="Mapillary 거리뷰">
                <div className="mapillary-street-floating__head">
                  <span className="mapillary-street-floating__title">Mapillary</span>
                  <button
                    type="button"
                    className="mapillary-street-floating__close"
                    title="Close street view"
                    onClick={dismissMapillaryStreet}
                  >
                    닫기
                  </button>
                </div>
                <div className="mapillary-street-floating__video">
                  <Suspense
                    fallback={<div className="mapillary-street-floating__loading">거리뷰 로드 중…</div>}
                  >
                    <MapillaryRideViewer
                      accessToken={MAPILLARY_CLIENT_TOKEN}
                      imageId={rideMapillaryStreet.imageKey}
                      lookAt={mapillaryRideSync.lookAt}
                      driveHeadingDeg={mapillaryRideSync.driveHeadingDeg}
                      sphericalNavigation={rideMapillaryStreet.isPano}
                    />
                  </Suspense>
                </div>
                <p className="mapillary-street-floating__attr">Imagery © Mapillary contributors</p>
              </div>
            ) : null}
          </AppMapStage>
        )}
      </div>

      <MenuPanel
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setPlaceSearchMarkerLngLat(null);
        }}
        onOpenSettings={openRideSettingsPanel}
      >
        <div className="menu-panel__section menu-panel__section--trail">
          <span className="menu-panel__section-label">Trail</span>
          <span className="menu-panel__section-hint">참가 · 공개 설정</span>
        </div>
        <TrailHubPanel
          user={user}
          activeTrailId={menuTrailSanitizedId}
          currentTrail={menuTrailMetaForDisplay}
          openTrails={openTrailsQuery.rows}
          openTrailsLoading={openTrailsQuery.loading}
          openTrailsError={openTrailsQuery.error}
          onJoinTrail={joinTrailAndCloseMenu}
          onSetVisibility={handleSetTrailVisibility}
          visibilityBusy={trailVisibilityBusy}
          rideSessionActive={isRideSessionActive}
        />
        <div className="menu-panel__section menu-panel__section--route">
          <span className="menu-panel__section-label">경로</span>
          <span className="menu-panel__section-hint">공식 코스 · 내 경로</span>
        </div>
        <RideRoutePanel
          routeSummary={routeSummary}
          routeLoading={routeLoading}
          basicSharedHubs={BASIC_SHARED_HUB_SUMMARIES}
          basicActiveHubCourseId={basicActiveHubCourseId}
          basicStartLoading={basicStartLoading}
          basicStartHubJoined={basicStartHubJoined}
          officialCourseCatalogAvailable={configured}
          publishedPublicCourses={publishedPublicCourses}
          publishedPublicCoursesLoading={publishedPublicCoursesLoading}
          publishedPublicCoursesError={publishedPublicCoursesError}
          onRefreshPublishedPublicCourses={onRefreshPublishedPublicCourses}
          publicationActivityByPublicationId={publicationActivityByPublicationId}
          authGuest={userTier.isGuest}
          signedIn={Boolean(user)}
          onEnterBasicHub={(courseId) => {
            void enterBasicHub(courseId);
            // 코스(퍼블릭·입문) 선택 즉시 MENU 를 닫아 바로 주행을 시작할 수 있게 한다.
            setMenuOpen(false);
            setPlaceSearchMarkerLngLat(null);
          }}
          onLeaveBasicHub={() => void leaveBasicHub()}
          savedRoutes={savedRoutes}
          savedRoutesLoading={savedRoutesLoading}
          onLoadSavedRoute={(route) => {
            handleLoadSavedRoute(route);
            setMenuOpen(false);
          }}
          onRenameSavedRoute={handleRenameSavedRoute}
          onDeleteSavedRoute={handleDeleteSavedRoute}
          arrivalToastVisible={false}
          adhocSaveAvailable={false}
          onSaveAdhocAsUserRoute={handleSaveAdhocAsUserRoute}
          onDismissAdhocSave={() => setLastEndedWasAdhoc(null)}
          openSavedTabSignal={openSavedTabNonce}
          savedQuotaNotice={savedQuotaNotice}
          onDismissSavedQuotaNotice={() => setSavedQuotaNotice(null)}
          onIncompleteQuotaBlocked={handleIncompleteQuotaBlocked}
          isPublicRouteReviewer={Boolean(configured && user && isPublicRouteReviewer)}
          publicRouteReviewUser={user}
          publicRouteReviewQueueCount={publicRouteReviewQueueCount}
          onPublicRouteReviewQueueChanged={onPublicRouteReviewQueueChanged}
          pendingPublicRouteIds={pendingPublicRouteIds}
          publishedPublicSavedRouteIds={publishedPublicSavedRouteIds}
          publishedPublicRouteFingerprints={publishedPublicRouteFingerprints}
          onOpenPublicRequest={(route) => setPublicRouteRequestModalRoute(route)}
          rideTtsEnabled={rideTtsEnabled}
          onRideTtsEnabled={setRideTtsEnabled}
          rideBgmEnabled={rideBgmEnabled}
          onRideBgmEnabled={setRideBgmEnabled}
          rideCoachingBanner={rideCoachingBannerVisible}
          onRideCoachingBanner={setRideCoachingBannerVisible}
          rideElevationProfileLoading={rideElevationProfileLoading}
          rideBgmCatalogConfigured={rideBgmCatalogConfigured}
          bleCadence={bleCadencePanel}
        />
      </MenuPanel>

      <PlaceSearchPanel
        open={placeSearchOpen}
        onClose={() => setPlaceSearchOpen(false)}
      >
        <MenuPlaceSearch
          accessToken={MAPBOX_TOKEN}
          open={placeSearchOpen}
          onPickPlace={handleMenuPlacePick}
        />
      </PlaceSearchPanel>

      <RideSettingsSheet
        open={rideSettingsSheetOpen}
        onClose={() => setRideSettingsSheetOpen(false)}
        rideTtsEnabled={rideTtsEnabled}
        onRideTtsEnabled={setRideTtsEnabled}
        rideBgmEnabled={rideBgmEnabled}
        onRideBgmEnabled={setRideBgmEnabled}
        rideCoachingBanner={rideCoachingBannerVisible}
        onRideCoachingBanner={setRideCoachingBannerVisible}
        rideBgmCatalogConfigured={rideBgmCatalogConfigured}
        rideElevationProfileLoading={rideElevationProfileLoading}
        bleCadence={bleCadencePanel}
      />

      <MapViewSheet
        open={mapViewSheetOpen}
        onClose={() => setMapViewSheetOpen(false)}
        mapStyle={mapStyle}
        mapStyleOptions={MAP_STYLE_OPTIONS}
        onMapStyle={setMapStyle}
        coverageOverlayMode={coverageOverlayMode}
        onCoverageOverlayMode={setCoverageOverlayMode}
        mapillaryTokenConfigured={mapillaryTokenConfigured}
        enable3D={enable3D}
        onEnable3D={setEnable3D}
        followMode={followMode}
        onFollowMode={setFollowMode}
        mapZoom={mapZoom}
        onMapZoom={setMapZoom}
      />

      <UserInfoSheet
        open={userInfoSheetOpen}
        onClose={() => {
          setUserInfoSheetOpen(false);
          setSubscriptionFlash(null);
        }}
        user={user}
        recentSessions={recentSessions}
        isGuest={Boolean(user?.isAnonymous)}
        tier={userTier.tier}
        subscriptionStatus={userTier.subscriptionStatus}
        isPaid={userTier.isPaid}
        busy={busy}
        subscriptionFlash={subscriptionFlash}
        conquest={conquestSummary}
        mileage={
          userTier.mileageTotalMeters != null
            ? {
                totalMeters: userTier.mileageTotalMeters,
                totalSec: userTier.mileageTotalSec ?? 0,
                rideCount: userTier.mileageRideCount ?? 0,
              }
            : null
        }
        onLinkGoogle={user?.isAnonymous ? () => void handleGoogleSignIn() : undefined}
        onServiceExit={() => void handleServiceExit()}
      />

      <RideSummarySheet
        open={summaryVisible}
        arrivalCompleted={arrivalToastTick > 0}
        elapsedLabel={elapsedLabel}
        distanceKm={sessionDistanceKmLabel}
        avgKmh={avgSpeedLabel}
        caloriesEstimate={caloriesEstimate}
        conquestLine={conquestSummaryLine}
        adhocSaveAvailable={lastEndedWasAdhoc !== null}
        maxNameLength={SAVED_ROUTE_NAME_MAX}
        onSaveAdhoc={async (name, confirmUpdate) => {
          await handleSaveAdhocAsUserRoute(name, confirmUpdate);
          setSummarySheetVisible(false);
          resetArrivalToast();
        }}
        onDismissAdhoc={() => setLastEndedWasAdhoc(null)}
        onClose={handleCloseSummary}
        onIncompleteQuotaBlocked={handleIncompleteQuotaBlocked}
      />

      {publicRouteRequestModalRoute && user ? (
        <PublicRouteRequestModal
          route={publicRouteRequestModalRoute}
          onClose={() => setPublicRouteRequestModalRoute(null)}
          onSubmit={handleSubmitPublicRouteRequest}
        />
      ) : null}

      {needsGuestEntry ? (
        <GuestEntryCard
          busy={busy || authSigningIn}
          error={error}
          onStartGuest={() => void beginAuthenticatedSession()}
          onGoogleSignIn={() => void handleGoogleSignIn()}
        />
      ) : null}

      {stage === "gate" && !needsGuestEntry ? (
        <AuthGateCard>
          {!configured ? (
            <p className="meta tight">Firebase 설정 필요</p>
          ) : !authInitialized || authSigningIn ? (
            <p className="meta tight">연결 중…</p>
          ) : userSignedOut ? (
            <>
              <p className="meta tight">로그아웃되었습니다.</p>
              <div className="auth-actions auth-actions--gate">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void beginAuthenticatedSession()}
                >
                  {busy ? "…" : "다시 시작"}
                </button>
                <button
                  type="button"
                  className="btn secondary auth-gate-google"
                  disabled={busy}
                  title="Sign in with Google"
                  onClick={() => void handleGoogleSignIn()}
                >
                  <AuthGoogleMark />
                  Google
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="meta tight">서비스에 연결할 수 없습니다.</p>
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void beginAuthenticatedSession()}
              >
                {busy ? "…" : "다시 시도"}
              </button>
            </>
          )}
          {error ? <p className="error tight">{error}</p> : null}
        </AuthGateCard>
      ) : null}

      {stage === "gate-nickname" && user ? (
        <AuthGateCard title="닉네임">
          <SignUpNicknameCard busy={busy} onSubmit={handleCompleteNickname} />
          {error ? <p className="error tight">{error}</p> : null}
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            title="Sign out"
            onClick={() => void handleServiceExit()}
          >
            로그아웃
          </button>
        </AuthGateCard>
      ) : null}

      {configured && user && sharedPresenceCourseId ? (
        <PublicationSharedPresence
          user={user}
          publicationId={sharedPresenceCourseId}
          isolateByTrail={!sharedRideIsExplicitCourse}
          trailId={menuTrailSanitizedId}
          title={sharedPresenceCourseTitle}
          routeLenM={
            routeGeometry?.coordinates?.length
              ? lineStringLengthMeters(routeGeometry)
              : 0
          }
          isRiding={rideStatus === "running"}
          rideSessionActive={rideStatus === "running" || rideStatus === "paused"}
          onPeerHudChange={onCoursePeerHudChange}
          onLiveRiderNametagChange={setLiveRiderNametag}
        />
      ) : null}
    </div>
  );
}
