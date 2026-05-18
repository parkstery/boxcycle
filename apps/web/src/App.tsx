import { startTransition, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { CourseSharedPresence } from "./components/CourseSharedPresence";
import { TrailheadPresence } from "./components/TrailheadPresence";
import { MapView, type MapPeerMarker } from "./components/MapView";
import { SignUpNicknameCard } from "./components/SignUpNicknameCard";
import { RideRoutePanel, type FollowMode } from "./components/RideRoutePanel";
import { PublicRouteRequestModal } from "./components/PublicRouteRequestModal";
import { MapHud } from "./components/maphud/MapHud";
import { useTrailSession } from "./hooks/useTrailSession";
import { useTrailLiveCourseRidePublisher } from "./hooks/useTrailLiveCourseRidePublisher";
import { useTrailLiveCourseRideSpectatorOverlay } from "./hooks/useTrailLiveCourseRideSpectatorOverlay";
import { useCourseActivity } from "./hooks/useCourseActivity";
import { useCourseActivityMapOverlay } from "./hooks/useCourseActivityMapOverlay";
import { usePublishedCoursesActivityMapOverlay } from "./hooks/usePublishedCoursesActivityMapOverlay";
import { useDocumentVisibility } from "./hooks/useDocumentVisibility";
import {
  formatActivityWorldPinPopup,
  formatCourseActivityHudLine,
} from "./lib/firestoreCourseActivity";
import { fetchWorldPresenceSummary, formatWorldPresenceHudLine } from "./lib/firestoreWorldPresence";
import { fetchWorldActivityGlobal, formatWorldActivityHudLine, mergeWorldHudLines } from "./lib/firestoreWorldActivity";
import {
  mergeActivityWorldDots,
  resolveActivityWorldDisplay,
  type MapViewportBounds,
} from "./lib/activityWorldLod";
import { MAP_ZOOM_WORLD_ACTIVITY_MAX, WORLD_PRESENCE_POLL_MS } from "./lib/rideSyncPolicy";
import { AuthGateCard, AuthGoogleMark } from "./components/AuthGateCard";
import { RideSummarySheet } from "./components/RideSummarySheet";
import { MenuPanel } from "./components/MenuPanel";
import { MenuPlaceSearch } from "./components/MenuPlaceSearch";
import { TrailSwitcher } from "./components/TrailSwitcher";
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
  getBasicHubCoursePayload,
} from "./lib/firestoreCourses";
import { deleteCoursePresence } from "./lib/firestoreCoursePresence";
import {
  DEFAULT_TRAIL_ID,
  deleteTrailPresence,
  isTrailMemberActive,
  sanitizeTrailId,
} from "./lib/firestoreTrail";
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
import { useOfficialCoursesHub } from "./hooks/useOfficialCoursesHub";
import { usePublicRouteReviewMeta } from "./hooks/usePublicRouteReviewMeta";
import { useSavedRoutesWorkspace } from "./hooks/useSavedRoutesWorkspace";
import { useRideEndAndPersistence } from "./hooks/useRideEndAndPersistence";
import {
  B_JOURNEY_HINT_SESSION_KEY,
  MAP_STYLE_OPTIONS,
  readBJourneyHintDismissedSession,
} from "./lib/appSessionKeys";
import { formatElapsedFromMs } from "./lib/rideFormat";
import { useBleCrankRpm } from "./hooks/useBleCrankRpm";
import { useRideMapillaryStreet } from "./hooks/useRideMapillaryStreet";
import { MAPILLARY_CLIENT_TOKEN, mapillaryTokenConfigured } from "./lib/mapillaryToken";
import type { CoverageOverlayMode } from "./lib/coverageOverlayMode";
import { formatDuration, type RouteProfile } from "./services/mapboxDirections";
import "./App.css";

const MapillaryRideViewer = lazy(async () => {
  const m = await import("./components/MapillaryRideViewer");
  return { default: m.MapillaryRideViewer };
});

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";

export default function App() {
  const {
    trailId,
    setTrailId,
    trailDraft,
    setTrailDraft,
    applyTrailFromDraft: commitTrailFromDraft,
  } = useAppTrail();
  const configured = isFirebaseConfigured();
  const {
    user,
    busy,
    error,
    fsSync,
    authInitialized,
    postSignoutMapSession,
    authSheetOpen,
    setAuthSheetOpen,
    authPickCardHidden,
    setAuthPickCardHidden,
    openSignedOutAuthSheet,
    handleGuestStart,
    handleGoogleSignIn,
    handleCompleteNickname,
    completeFirebaseSignOutKeepMap,
    setError,
    setBusy,
  } = useAppAuth(configured);

  const { routeTokenBalance, routeTokenLoading } = useRouteTokenBalance(user, configured);

  const [mapStyle, setMapStyle] = useState(MAP_STYLE_OPTIONS[3].value);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapViewportSpanKm, setMapViewportSpanKm] = useState<number | null>(null);

  const onMapViewport = useCallback((_viewport: MapViewportBounds, spanKm: number) => {
    setMapViewportSpanKm(spanKm);
  }, []);
  const [followMode, setFollowMode] = useState<FollowMode>("keep");
  const [enable3D, setEnable3D] = useState(true);
  const [speedKmh, setSpeedKmh] = useState(25);
  const {
    rideTtsEnabled,
    setRideTtsEnabled,
    rideBgmEnabled,
    setRideBgmEnabled,
    rideCoachingBannerVisible,
    setRideCoachingBannerVisible,
  } = useRideFeedbackPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [mapViewSheetOpen, setMapViewSheetOpen] = useState(false);
  const [userInfoSheetOpen, setUserInfoSheetOpen] = useState(false);
  const [rideSettingsSheetOpen, setRideSettingsSheetOpen] = useState(false);
  const [idleHintDismissed, setIdleHintDismissed] = useState(false);
  /** B 여정(커스텀 경로): setup 안내 세션 플래그 */
  const [bJourneyHintDismissedSession, setBJourneyHintDismissedSession] = useState(readBJourneyHintDismissedSession);
  const [summarySheetVisible, setSummarySheetVisible] = useState(false);
  const [coverageOverlayMode, setCoverageOverlayMode] = useState<CoverageOverlayMode>("off");

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
  const [coursePeerMarkers, setCoursePeerMarkers] = useState<MapPeerMarker[]>([]);
  /** 입문 허브 동행에서 계산된 내 네임태그(없으면 단독 주행용 표시로 대체) */
  const [liveRiderNametag, setLiveRiderNametag] = useState<string | null>(null);
  /** 로그인(게스트 포함) 세션 동안 Trailhead presence·관전 항상 on — Trailhead 진입·이탈 토글 없음 */
  const trailheadSessionActive = Boolean(configured && user);
  const pageVisible = useDocumentVisibility();
  const [worldHighlightedCourseIds, setWorldHighlightedCourseIds] = useState<string[]>([]);
  const [worldHudLines, setWorldHudLines] = useState<string | null>(null);

  const trailSession = useTrailSession({
    user: user ?? undefined,
    trailId,
    enabled: trailheadSessionActive,
    pageVisible,
  });
  /** leaveBasicHub 등에서 최신 주행 종료 로직을 호출하기 위한 ref */
  const handleEndRideRef = useRef<() => void>(() => {});
  /** 주행 종료 시 `rides.courseId` — `useOfficialCoursesHub` 이후 매 렌더 갱신 */
  const activeCourseIdRef = useRef<string | null>(null);
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
    startLabel,
    endLabel,
    startPlaceLabel,
    endPlaceLabel,
    waypointLabelsForPanel,
    generateRoute,
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

  const { recentSessions, setRecentSessions, reloadRecentSessionsFromLocalStorage } =
    useRecentRideSessions({
      configured,
      user,
      roomId: trailId,
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
    onSavedRouteRideEntry: () => {
      rideEntryRef.current = "owner_library";
    },
  });
  clearSavedRouteArtifactsRef.current = savedRoutesWorkspace.clearLoadedRouteAndAdhoc;

  const {
    savedRoutes,
    setSavedRoutes,
    savedRoutesLoading,
    loadedSavedRouteIdRef,
    loadedSavedRouteNameRef,
    lastEndedWasAdhoc,
    setLastEndedWasAdhoc,
    handleSaveCurrentRoute,
    handleSaveAdhocAsUserRoute,
    handleLoadSavedRoute,
    handleRenameSavedRoute,
    handleDeleteSavedRoute,
  } = savedRoutesWorkspace;

  const reloadCourseActivityRef = useRef<
    (options?: { forceInvalidate?: boolean }) => void
  >(() => {});
  const applyRideCompletedOptimisticRef = useRef<() => void>(() => {});
  const [activityMapRefreshNonce, setActivityMapRefreshNonce] = useState(0);
  const onRideEndedWithCourse = useCallback((_courseId: string) => {
    applyRideCompletedOptimisticRef.current();
    reloadCourseActivityRef.current({ forceInvalidate: false });
    setActivityMapRefreshNonce((n) => n + 1);
  }, []);
  const onRidePersistedToFirestore = useCallback((courseId: string | null) => {
    if (courseId?.trim()) {
      applyRideCompletedOptimisticRef.current();
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
      "주행 기록은 저장되었습니다. 지도 빨간 주행 흔적은 입문·퍼블릭 등 공식 코스 주행에만 표시됩니다.",
    );
  }, [setRouteSummary]);

  const { handleEndRide } = useRideEndAndPersistence({
    mapboxAccessToken: MAPBOX_TOKEN,
    configured,
    user,
    roomId: trailId,
    courseIdRef: activeCourseIdRef,
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
    rideEntryRef,
    publishedCatalogRef,
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    onRideEndedWithCourse,
    onRidePersistedToFirestore,
  });
  handleEndRideRef.current = handleEndRide;

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
  } = useOfficialCoursesHub({
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

  activeCourseIdRef.current = basicActiveHubCourseId ?? activeOfficialCourseId;

  const trackedCourseId = basicActiveHubCourseId ?? activeOfficialCourseId;
  const courseActivityEnabled = Boolean(configured && user && trackedCourseId && pageVisible);

  const {
    activity: courseActivity,
    reload: reloadCourseActivity,
    applyRideCompletedOptimistic,
  } = useCourseActivity({
    configured,
    user,
    courseId: trackedCourseId,
    enabled: courseActivityEnabled,
  });
  reloadCourseActivityRef.current = (options) => {
    void reloadCourseActivity(options);
  };
  applyRideCompletedOptimisticRef.current = applyRideCompletedOptimistic;

  const {
    pulseRoutes: activeCoursePulseRoutes,
    heatRoutes: activeCourseHeatRoutes,
    pulseDots: activeCoursePulseDots,
    heatDots: activeCourseHeatDots,
  } = useCourseActivityMapOverlay({
    activity: courseActivity,
    routeGeometry,
    mapZoom,
  });

  const catalogCourseIds = useMemo(() => {
    const ids = new Set<string>(BASIC_SHARED_HUB_IDS as readonly string[]);
    for (const c of publishedPublicCourses) ids.add(c.id);
    for (const id of worldHighlightedCourseIds) ids.add(id);
    return [...ids];
  }, [publishedPublicCourses, worldHighlightedCourseIds]);

  const catalogActivityEnabled = Boolean(
    configured && user && pageVisible && catalogCourseIds.length > 0,
  );

  const {
    pulseRoutes: catalogPulseRoutes,
    heatRoutes: catalogHeatRoutes,
    pulseDots: catalogPulseDots,
    heatDots: catalogHeatDots,
    activityByCourseId: courseActivityByCourseId,
    overlayStats: catalogActivityOverlayStats,
  } = usePublishedCoursesActivityMapOverlay({
    courseIds: catalogCourseIds,
    excludeCourseId: trackedCourseId,
    mapZoom,
    enabled: catalogActivityEnabled,
    refreshNonce: activityMapRefreshNonce,
  });

  const catalogHeatForMerge = useMemo(() => {
    const tracked = trackedCourseId?.trim() ?? "";
    const activeCoversTracked =
      Boolean(tracked) &&
      (activeCourseHeatDots.length > 0 ||
        activeCourseHeatRoutes.length > 0 ||
        activeCoursePulseDots.length > 0 ||
        activeCoursePulseRoutes.length > 0);
    if (!activeCoversTracked) {
      return { heatRoutes: catalogHeatRoutes, heatDots: catalogHeatDots };
    }
    return {
      heatRoutes: catalogHeatRoutes.filter((r) => r.courseId !== tracked),
      heatDots: catalogHeatDots.filter((d) => d.courseId !== tracked),
    };
  }, [
    trackedCourseId,
    catalogHeatRoutes,
    catalogHeatDots,
    activeCourseHeatDots,
    activeCourseHeatRoutes,
    activeCoursePulseDots,
    activeCoursePulseRoutes,
  ]);

  const activityWorldRaw = useMemo(
    () => ({
      pulseRoutes: [...activeCoursePulseRoutes, ...catalogPulseRoutes],
      heatRoutes: [...activeCourseHeatRoutes, ...catalogHeatForMerge.heatRoutes],
      pulseDots: mergeActivityWorldDots(activeCoursePulseDots, catalogPulseDots),
      heatDots: mergeActivityWorldDots(activeCourseHeatDots, catalogHeatForMerge.heatDots),
    }),
    [
      activeCoursePulseRoutes,
      catalogPulseRoutes,
      activeCourseHeatRoutes,
      catalogHeatForMerge,
      activeCoursePulseDots,
      catalogPulseDots,
      activeCourseHeatDots,
    ],
  );

  const activityWorldDisplay = useMemo(
    () =>
      resolveActivityWorldDisplay({
        mapZoom,
        spanKm: mapViewportSpanKm,
        pulseDotCount: activityWorldRaw.pulseDots.length,
        heatDotCount: activityWorldRaw.heatDots.length,
        pulseLineCount: activityWorldRaw.pulseRoutes.length,
        heatLineCount: activityWorldRaw.heatRoutes.length,
      }),
    [mapZoom, mapViewportSpanKm, activityWorldRaw],
  );

  const activityPulseRoutes = useMemo(
    () => (activityWorldDisplay.showLines ? activityWorldRaw.pulseRoutes : []),
    [activityWorldDisplay.showLines, activityWorldRaw.pulseRoutes],
  );
  const activityHeatRoutes = useMemo(
    () => (activityWorldDisplay.showLines ? activityWorldRaw.heatRoutes : []),
    [activityWorldDisplay.showLines, activityWorldRaw.heatRoutes],
  );
  const activityPulseDots = useMemo(
    () => (activityWorldDisplay.showDots ? activityWorldRaw.pulseDots : []),
    [activityWorldDisplay.showDots, activityWorldRaw.pulseDots],
  );
  const activityHeatDots = useMemo(
    () => (activityWorldDisplay.showDots ? activityWorldRaw.heatDots : []),
    [activityWorldDisplay.showDots, activityWorldRaw.heatDots],
  );

  const getActivityWorldPinLabel = useCallback(
    (courseId: string, kind: "pulse" | "heat") => {
      const id = courseId.trim();
      const row =
        id && id === trackedCourseId?.trim()
          ? courseActivity
          : courseActivityByCourseId.get(id) ?? null;
      return formatActivityWorldPinPopup(row, kind);
    },
    [trackedCourseId, courseActivity, courseActivityByCourseId],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[ActivityWorld]", {
      zoom: mapZoom,
      spanKm: mapViewportSpanKm,
      display: activityWorldDisplay,
      raw: {
        pulseDots: activityWorldRaw.pulseDots.length,
        heatDots: activityWorldRaw.heatDots.length,
        pulseLines: activityWorldRaw.pulseRoutes.length,
        heatLines: activityWorldRaw.heatRoutes.length,
      },
      heatPool: {
        live: catalogActivityOverlayStats.liveCandidates,
        heat: catalogActivityOverlayStats.heatCandidates,
      },
      render: {
        pulseDots: activityPulseDots.length,
        pulseLines: activityPulseRoutes.length,
      },
      catalog: catalogActivityOverlayStats,
      catalogEnabled: catalogActivityEnabled,
    });
  }, [
    mapZoom,
    mapViewportSpanKm,
    activityWorldDisplay,
    activityWorldRaw,
    activityPulseDots.length,
    activityPulseRoutes.length,
    catalogActivityOverlayStats,
    catalogActivityEnabled,
  ]);

  useEffect(() => {
    if (!configured || !menuOpen) return;
    void refreshPublishedPublicCourseCatalog();
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

  const onCoursePeersChange = useCallback((next: MapPeerMarker[]) => {
    setCoursePeerMarkers(next);
  }, []);

  const selfRiderNametagFallback = useMemo(() => {
    if (!user) return null;
    if (basicActiveHubCourseId) return null;
    if (user.isAnonymous) return "guest";
    return user.displayName?.trim() || user.email?.trim() || "Rider";
  }, [user, basicActiveHubCourseId]);

  const resolvedLiveRiderNametag = liveRiderNametag ?? selfRiderNametagFallback;

  const bleCrankRpm = useBleCrankRpm({ sessionActive: rideStatus !== "idle" });

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

  const coursePeerIdsForTrailSpectator = useMemo(
    () => new Set(coursePeerMarkers.map((p) => p.id)),
    [coursePeerMarkers],
  );

  /**
   * 같은 Trail(`trailId`) 주행자 위치 — idle·주행·일시정지 모두 `liveCourseRides` 구독.
   * 다른 Trail 은 애초에 구독하지 않음. 동일 코스 동행 스프라이트는 `excludePeerIds`로 dots 중복 제거.
   * 코스 단위 “살아 있음”은 `activityPulseRoutes` / `activityHeatRoutes`(aggregate)가 담당.
   */
  const trailSpectatorOverlayEnabled = Boolean(
    trailheadSessionActive &&
      (rideStatus === "idle" || rideStatus === "running" || rideStatus === "paused") &&
      pageVisible,
  );

  const { spectatorDots, spectatorRouteGeometries } = useTrailLiveCourseRideSpectatorOverlay({
    user,
    trailId,
    enabled: trailSpectatorOverlayEnabled,
    mapZoom,
    excludePeerIds: coursePeerIdsForTrailSpectator,
  });

  useTrailLiveCourseRidePublisher({
    user,
    enabled: Boolean(
      trailheadSessionActive &&
        (rideStatus === "running" || rideStatus === "paused") &&
        (basicActiveHubCourseId ?? activeOfficialCourseId) &&
        Boolean(routeGeometry?.coordinates?.length),
    ),
    pageVisible,
    trailId,
    courseId: basicActiveHubCourseId ?? activeOfficialCourseId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
  });

  /** `highlightedCourses` — Activity World 카탈로그(줌·Trail 무관). HUD 텍스트만 줌 ≤9 */
  useEffect(() => {
    if (!configured || !user || !pageVisible) {
      setWorldHudLines(null);
      setWorldHighlightedCourseIds([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void (async () => {
        const [presence, worldActivity] = await Promise.all([
          fetchWorldPresenceSummary(),
          fetchWorldActivityGlobal(),
        ]);
        if (cancelled) return;
        setWorldHighlightedCourseIds(worldActivity?.highlightedCourses ?? []);
        setWorldHudLines(
          mergeWorldHudLines(
            formatWorldPresenceHudLine(presence.regions),
            formatWorldActivityHudLine(worldActivity),
          ),
        );
      })();
    };
    load();
    const id = window.setInterval(load, WORLD_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [configured, user, pageVisible]);

  /** 비로그인 상태에서는 사용자 시트 액션(Trailhead/로그아웃)이 없으므로 시트를 닫음 */
  useEffect(() => {
    if (!user) setUserInfoSheetOpen(false);
  }, [user]);

  useEffect(() => {
    if (!configured || !user) return;
    void ensureBasicCoursesSeeded(user.uid).catch(() => {
      // 기본 코스 시드 실패는 치명적 오류로 다루지 않고 앱 동작을 유지한다.
    });
  }, [configured, user]);

  /** 허브 코스 id 가 바뀌거나 빠질 때마다 비움 — 다른 입문 코스로 바꿀 때 이전 동행 마커가 남지 않게 함 */
  useEffect(() => {
    startTransition(() => setCoursePeerMarkers([]));
  }, [basicActiveHubCourseId]);

  useEffect(() => {
    if (!basicActiveHubCourseId) setLiveRiderNametag(null);
  }, [basicActiveHubCourseId]);

  const avgSpeedLabel = useMemo(() => {
    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    if (elapsedSec <= 0) return "0.0";
    const avg =
      (rideMetrics.virtualDistanceMeters / 1000) / (elapsedSec / 3600);
    return avg.toFixed(1);
  }, [rideMetrics.accumulatedMs, rideMetrics.virtualDistanceMeters]);

  /** URL·MENU Trail 전환 후 메뉴 닫고 지도에 집중(지명 선택과 동일한 습관) */
  const applyTrailFromDraftAndCloseMenu = useCallback(() => {
    commitTrailFromDraft();
    setMenuOpen(false);
  }, [commitTrailFromDraft]);

  const goTrailheadAndCloseMenu = useCallback(() => {
    const tid = DEFAULT_TRAIL_ID;
    setTrailDraft(tid);
    setTrailId(tid);
    replaceTrailInUrl(tid);
    setMenuOpen(false);
  }, [setTrailDraft, setTrailId]);

  function handleStartRide() {
    if (!routeGeometry || rideStatus !== "idle") return;
    resetArrivalGate();
    resetRide();
    setRideStatus("running");
  }

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

  /** Trailhead·코스 정리 후 Firebase 로그아웃 — 맵은 유지하고 우측 상단「로그인」으로 재인증(게스트·Google 공통) */
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
        for (const hid of BASIC_SHARED_HUB_IDS) {
          await deleteCoursePresence(user.uid, hid).catch(() => {
            /* noop */
          });
        }
      }
      setBasicActiveHubCourseId(null);
      reloadRecentSessionsFromLocalStorage();
      await completeFirebaseSignOutKeepMap();
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
    const routeCap = routeDistanceMeters > 0 ? routeDistanceMeters : geoLen;
    const d = Math.min(
      Math.max(0, rideMetrics.virtualDistanceMeters),
      routeCap,
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

  const { streetState: rideMapillaryStreet, rideSync: mapillaryRideSync, dismissStreet: dismissMapillaryStreet } =
    useRideMapillaryStreet({
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
  const needsAuthCard =
    !configured || (configured && authInitialized && !user && !postSignoutMapSession);
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
    (p: RouteProfile) => applyRouteProfileForMapLocked(routeMenuLockedForProd, p),
    [applyRouteProfileForMapLocked, routeMenuLockedForProd],
  );

  const dismissBJourneyHint = useCallback(() => {
    try {
      sessionStorage.setItem(B_JOURNEY_HINT_SESSION_KEY, "1");
    } catch {
      /* noop */
    }
    setBJourneyHintDismissedSession(true);
  }, []);

  const openMenuPanel = useCallback(() => {
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setMenuOpen(true);
  }, []);

  const openMapViewPanel = useCallback(() => {
    setMenuOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setMapViewSheetOpen((v) => !v);
  }, []);

  const openUserInfoPanel = useCallback(() => {
    setMenuOpen(false);
    setMapViewSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setUserInfoSheetOpen((v) => !v);
  }, []);

  const openRideSettingsPanel = useCallback(() => {
    setMenuOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(true);
  }, []);

  useEffect(() => {
    if (!needsAuthCard) setAuthPickCardHidden(false);
  }, [needsAuthCard]);

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
    setMenuOpen(false);
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
  const distanceKmLabel = (rideMetrics.virtualDistanceMeters / 1000).toFixed(2);
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
          distanceKm: distanceKmLabel,
          avgKmh: avgSpeedLabel,
          speedKmh,
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
  const accountChip =
    user && accountInitial !== null
      ? {
          initial: accountInitial,
          isGuest: user.isAnonymous,
        }
      : null;
  const routeBrief =
    routeGeometry && routeDistanceMeters > 0
      ? {
          distanceKm: (routeDistanceMeters / 1000).toFixed(2),
          durationLabel: formatDuration(routeDurationSec),
        }
      : null;
  const caloriesEstimate = Math.round((rideMetrics.virtualDistanceMeters / 1000) * 30);

  const courseLiveProgressRatio = useMemo(() => {
    if (routeDistanceMeters <= 0) return null;
    return Math.max(0, Math.min(1, rideMetrics.virtualDistanceMeters / routeDistanceMeters));
  }, [routeDistanceMeters, rideMetrics.virtualDistanceMeters]);

  const worldActivityHint = useMemo(() => {
    if (mapZoom > MAP_ZOOM_WORLD_ACTIVITY_MAX || !worldHudLines) return null;
    return worldHudLines;
  }, [mapZoom, worldHudLines]);

  const mapHudRidePresence = useMemo(() => {
    if (!configured || !user) return null;
    const courseTitle = basicActiveHubCourseId
      ? getBasicHubCoursePayload(basicActiveHubCourseId).title.trim() || "입문 코스"
      : null;
    const coursePeerNames = coursePeerMarkers
      .map((p) => (p.label ?? "동행").trim())
      .filter((n) => n.length > 0);
    const trailMembers = trailSession.rows.map((r) => ({
      key: r.uid,
      display: r.displayName?.trim() || r.uid.slice(0, 8),
      isSelf: r.uid === user.uid,
      active: isTrailMemberActive(r.lastSeenAtMs),
    }));
    const trailError = trailSession.error;
    const courseActivityHudLine = formatCourseActivityHudLine(courseActivity);
    return {
      trailheadEnabled: true,
      trailId: sanitizeTrailId(trailId),
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
    trailSession.rows,
    trailSession.error,
    basicActiveHubCourseId,
    coursePeerMarkers,
    courseActivity,
  ]);

  return (
    <div className="app-shell app-shell--map-first">
      <RotateOverlay />

      <div className="app-map-stage">
        <MapView
          accessToken={MAPBOX_TOKEN || undefined}
          routeElevationProfile={rideElevationProfile}
          routeGeometry={routeGeometry}
          startLngLat={startLngLat}
          endLngLat={endLngLat}
          routeWaypoints={routeWaypoints}
          liveLngLat={liveForMap}
          liveRiderMotion={
            rideStatus === "idle"
              ? null
              : {
                  sessionStatus: rideStatus,
                  speedKmh,
                  crankRpmFromSensor: bleCrankRpm.crankRpm,
                }
          }
          liveRiderNametag={resolvedLiveRiderNametag}
          peerMarkers={coursePeerMarkers}
          mapStyle={mapStyle}
          mapZoom={mapZoom}
          followMode={followMode}
          enable3D={enable3D}
          onMapZoom={setMapZoom}
          onMapViewport={onMapViewport}
          coverageOverlayMode={coverageOverlayMode}
          mapillaryClientToken={mapillaryTokenConfigured ? MAPILLARY_CLIENT_TOKEN : null}
          routeProfile={profile}
          onRouteProfile={handleMapRouteProfile}
          onClearRoute={handleClearPins}
          onSelectPoint={(type, lngLat, waypointSlot) => {
            if (routeMenuLockedForProd) return;
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
          }}
          externalCameraJump={externalCameraJump}
          placeSearchMarkerLngLat={placeSearchMarkerLngLat}
          trailSpectatorDots={spectatorDots}
          trailSpectatorRoutes={spectatorRouteGeometries}
          activityPulseRoutes={activityPulseRoutes}
          activityHeatRoutes={activityHeatRoutes}
          activityPulseDots={activityPulseDots}
          activityHeatDots={activityHeatDots}
          getActivityWorldPinLabel={getActivityWorldPinLabel}
        />

        {import.meta.env.DEV && import.meta.env.VITE_SHOW_ACTIVITY_LOD_DEBUG === "true" ? (
          <pre
            className="activity-world-lod-debug"
            aria-hidden
          >{`LOD ${activityWorldDisplay.label} | z ${mapZoom.toFixed(1)} span ${
            mapViewportSpanKm != null ? `${mapViewportSpanKm.toFixed(0)}km` : "—"
          }
dots ${activityWorldRaw.pulseDots.length}+${activityWorldRaw.heatDots.length} → ${
            activityPulseDots.length
          } | lines ${activityWorldRaw.pulseRoutes.length} → ${activityPulseRoutes.length}
heat ${catalogActivityOverlayStats.heatCandidates} live ${catalogActivityOverlayStats.liveCandidates}
geom ${catalogActivityOverlayStats.geometryReady}/${catalogActivityOverlayStats.activityRows} bounds ${catalogActivityOverlayStats.boundsReady}`}</pre>
        ) : null}

        <MapHud
          stage={stage}
          onOpenMenu={openMenuPanel}
          menuOpen={menuOpen}
          account={accountChip}
          onOpenUserInfo={openUserInfoPanel}
          userInfoOpen={userInfoSheetOpen}
          onOpenSignedOutAuth={
            configured && authInitialized && !user ? openSignedOutAuthSheet : undefined
          }
          authGateVisualDismissed={authPickCardHidden}
          onOpenMapView={openMapViewPanel}
          mapViewOpen={mapViewSheetOpen}
          idleHintMessage="입문: MENU → 입문 코스 → 주행 시작"
          coachData={coachData}
          coachLineEnabled={rideCoachingBannerVisible}
          metrics={hudMetrics}
          pinState={{
            start: Boolean(startLngLat),
            end: Boolean(endLngLat),
            waypointCount: routeWaypoints.length,
          }}
          routeBrief={routeBrief}
          onClearPins={handleClearPins}
          routeError={null}
          canStartRide={Boolean(routeGeometry) && !routeLoading}
          onStartRide={handleStartRide}
          onPauseRide={handlePause}
          onResumeRide={handleResume}
          onEndRide={handleEndRide}
          onResumeFromPause={handleResume}
          onEndFromPause={handleEndRide}
          onModifyFromPause={handleModifyFromPause}
          showIdleHint={stage === "idle" && !idleHintDismissed}
          onDismissIdleHint={() => setIdleHintDismissed(true)}
          showSetupRouteHint={stage === "setup" && !bJourneyHintDismissedSession}
          onDismissSetupRouteHint={dismissBJourneyHint}
          ridePresence={mapHudRidePresence}
          worldActivityHint={worldActivityHint}
        />

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
      </div>

      <MenuPanel
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setPlaceSearchMarkerLngLat(null);
        }}
        onOpenSettings={openRideSettingsPanel}
      >
        <TrailSwitcher
          trailDraft={trailDraft}
          onDraftChange={setTrailDraft}
          activeTrailId={sanitizeTrailId(trailId)}
          onApply={applyTrailFromDraftAndCloseMenu}
          onGoTrailhead={goTrailheadAndCloseMenu}
        />
        <MenuPlaceSearch
          accessToken={MAPBOX_TOKEN}
          menuOpen={menuOpen}
          onPickPlace={handleMenuPlacePick}
        />
        <RideRoutePanel
          startLabel={startLabel}
          endLabel={endLabel}
          waypointLabels={waypointLabelsForPanel}
          profile={profile}
          onProfile={setProfile}
          routeSummary={routeSummary}
          routeLoading={routeLoading}
          onGenerateRoute={() => void generateRoute()}
          officialCourseActive={activeOfficialCourseId !== null}
          hasRoute={Boolean(routeGeometry)}
          canStartRide={Boolean(routeGeometry) && !routeLoading}
          onStartRide={() => {
            handleStartRide();
            setMenuOpen(false);
          }}
          speedKmh={speedKmh}
          onSpeedKmh={setSpeedKmh}
          sessionStatus={rideStatus}
          basicSharedHubs={BASIC_SHARED_HUB_SUMMARIES}
          basicActiveHubCourseId={basicActiveHubCourseId}
          basicStartLoading={basicStartLoading}
          basicStartHubJoined={basicStartHubJoined}
          officialCourseCatalogAvailable={configured}
          publishedPublicCourses={publishedPublicCourses}
          publishedPublicCoursesLoading={publishedPublicCoursesLoading}
          publishedPublicCoursesError={publishedPublicCoursesError}
          onRefreshPublishedPublicCourses={onRefreshPublishedPublicCourses}
          courseActivityByCourseId={courseActivityByCourseId}
          authGuest={Boolean(user?.isAnonymous)}
          signedIn={Boolean(user)}
          onEnterBasicHub={(courseId) => {
            void enterBasicHub(courseId);
          }}
          onLeaveBasicHub={() => void leaveBasicHub()}
          savedRoutes={savedRoutes}
          savedRoutesLoading={savedRoutesLoading}
          onSaveCurrentRoute={handleSaveCurrentRoute}
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
          routeTokenBalance={routeTokenBalance}
          routeTokenLoading={routeTokenLoading}
        />
      </MenuPanel>

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
        onClose={() => setUserInfoSheetOpen(false)}
        user={user}
        recentSessions={recentSessions}
        isGuest={Boolean(user?.isAnonymous)}
        busy={busy}
        onLinkGoogle={user?.isAnonymous ? () => void handleGoogleSignIn() : undefined}
        onServiceExit={() => void handleServiceExit()}
      />

      <RideSummarySheet
        open={summaryVisible}
        arrivalCompleted={arrivalToastTick > 0}
        elapsedLabel={elapsedLabel}
        distanceKm={distanceKmLabel}
        avgKmh={avgSpeedLabel}
        caloriesEstimate={caloriesEstimate}
        adhocSaveAvailable={lastEndedWasAdhoc !== null}
        maxNameLength={SAVED_ROUTE_NAME_MAX}
        onSaveAdhoc={async (name) => {
          await handleSaveAdhocAsUserRoute(name);
          setSummarySheetVisible(false);
          resetArrivalToast();
        }}
        onDismissAdhoc={() => setLastEndedWasAdhoc(null)}
        onClose={handleCloseSummary}
      />

      {publicRouteRequestModalRoute && user ? (
        <PublicRouteRequestModal
          route={publicRouteRequestModalRoute}
          onClose={() => setPublicRouteRequestModalRoute(null)}
          onSubmit={handleSubmitPublicRouteRequest}
        />
      ) : null}

      {stage === "gate" && !authPickCardHidden ? (
        <AuthGateCard>
          {!configured ? (
            <p className="meta tight">Firebase 설정 필요</p>
          ) : !authInitialized ? (
            <p className="meta tight">연결 중…</p>
          ) : (
            <div className="auth-actions auth-actions--gate">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                title="Continue as guest"
                onClick={() => void handleGuestStart()}
              >
                {busy ? "…" : "게스트"}
              </button>
              <button
                type="button"
                className="btn primary auth-gate-google"
                title="Sign in with Google"
                onClick={() => void handleGoogleSignIn()}
              >
                <AuthGoogleMark />
                Google
              </button>
            </div>
          )}
          {error ? <p className="error tight">{error}</p> : null}
        </AuthGateCard>
      ) : null}

      {authSheetOpen && configured && authInitialized && !user ? (
        <AuthGateCard
          title="로그인"
          onDismiss={() => setAuthSheetOpen(false)}
        >
          <div className="auth-actions auth-actions--gate">
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              title="Continue as guest"
              onClick={() => void handleGuestStart()}
            >
              {busy ? "…" : "게스트"}
            </button>
            <button
              type="button"
              className="btn primary auth-gate-google"
              title="Sign in with Google"
              onClick={() => void handleGoogleSignIn()}
            >
              <AuthGoogleMark />
              Google
            </button>
          </div>
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

      {configured && user && basicActiveHubCourseId ? (
        <CourseSharedPresence
          user={user}
          courseId={basicActiveHubCourseId}
          title={getBasicHubCoursePayload(basicActiveHubCourseId).title}
          isRiding={rideStatus === "running"}
          rideSessionActive={rideStatus === "running" || rideStatus === "paused"}
          progressRatio={courseLiveProgressRatio}
          myLiveLngLat={liveForMap}
          onPeersChange={onCoursePeersChange}
          onLiveRiderNametagChange={setLiveRiderNametag}
        />
      ) : null}

      {configured && user ? (
        <TrailheadPresence user={user} trailId={trailId} rows={trailSession.rows} error={trailSession.error} />
      ) : null}
    </div>
  );
}
