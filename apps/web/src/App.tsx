import { startTransition, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { CourseSharedPresence } from "./components/CourseSharedPresence";
import type { MapPeerMarker } from "./components/MapView";
import { SignUpNicknameCard } from "./components/SignUpNicknameCard";
import { RideRoutePanel, type FollowMode } from "./components/RideRoutePanel";
import { PublicRouteRequestModal } from "./components/PublicRouteRequestModal";
import { useTrailSession } from "./hooks/useTrailSession";
import { useLiveLocationPublishSession } from "./hooks/useLiveLocationPublishSession";
import { useGlobalLivePresence } from "./hooks/useGlobalLivePresence";
import { useDocumentVisibility } from "./hooks/useDocumentVisibility";
import {
  formatCourseActivityHudLine,
  invalidateLiveCourseActivityIdsCache,
} from "./lib/firestoreCourseActivity";
import { AppMapStage, useAppMapOverlays } from "./features/map-overlays";
import { DebugMapStage } from "./features/map-overlays/DebugMapStage";
import type { MapViewportBounds } from "./lib/activityWorldLod";
import { MAP_ZOOM_WORLD_ACTIVITY_MAX, MAP_PEER_SPRITE_MIN_ZOOM } from "./lib/rideSyncPolicy";
import { AuthGateCard, AuthGoogleMark } from "./components/AuthGateCard";
import { GuestEntryCard } from "./components/GuestEntryCard";
import { allowUnauthMapDev } from "./lib/authGatePolicy";
import { readGuestEntryAccepted } from "./lib/appSessionKeys";
import { useUserTier } from "./hooks/useUserTier";
import { RideSummarySheet } from "./components/RideSummarySheet";
import { MenuPanel } from "./components/MenuPanel";
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
} from "./lib/firestoreTrailInstance";
import { formatTrailDisplayNumber, resolveTrailDisplayLabel } from "./lib/trailDisplayNumber";
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
import { deleteCoursePresence } from "./lib/firestoreCoursePresence";
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

  const { routeTokenBalance, routeTokenLoading } = useRouteTokenBalance(user, configured);

  const [mapStyle, setMapStyle] = useState(MAP_STYLE_OPTIONS[3].value);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapViewportSpanKm, setMapViewportSpanKm] = useState<number | null>(null);
  /** 전역 livePresence publish — idle 시 지도 중심(주행 중에는 liveForMap 우선) */
  const [mapViewportCenterLngLat, setMapViewportCenterLngLat] = useState<LngLat>([127.035, 37.505]);
  /** Activity World LOD — 제스처 중 실제 줌·span (HUD `mapZoom` 과 분리) */
  const [mapLodZoom, setMapLodZoom] = useState(12);
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
  const [followMode, setFollowMode] = useState<FollowMode>("keep");
  const [enable3D, setEnable3D] = useState(true);
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
    mapViewSheetOpen,
    userInfoSheetOpen,
    rideSettingsSheetOpen,
    setMenuOpen,
    setMapViewSheetOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    openMenuPanel,
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
  const activeOfficialCourseIdRef = useRef<string | null>(null);
  activeOfficialCourseIdRef.current = activeOfficialCourseId;
  const [coursePeerMarkers, setCoursePeerMarkers] = useState<MapPeerMarker[]>([]);
  /** 입문 허브 동행에서 계산된 내 네임태그(없으면 단독 주행용 표시로 대체) */
  const [liveRiderNametag, setLiveRiderNametag] = useState<string | null>(null);
  /** 로그인(게스트 포함) 세션 동안 Trailhead presence·관전 항상 on — Trailhead 진입·이탈 토글 없음 */
  const trailheadSessionActive = Boolean(configured && user);
  const pageVisible = useDocumentVisibility();
  const [trailVisibilityBusy, setTrailVisibilityBusy] = useState(false);
  const [trailStartBusy, setTrailStartBusy] = useState(false);
  /** 이번 주행에서 호스트로 연 Trail — 종료 시 close */
  const hostTrailIdRef = useRef<string | null>(null);

  const trailSession = useTrailSession({
    user: user ?? undefined,
    trailId,
    enabled: trailheadSessionActive,
    pageVisible,
  });

  const sanitizedTrailId = sanitizeTrailId(trailId);
  const onDedicatedTrail = sanitizedTrailId !== DEFAULT_TRAIL_ID;

  const { meta: currentTrailMeta, reload: reloadCurrentTrailMeta } = useTrailInstanceMeta(
    sanitizedTrailId,
    Boolean(configured && user && onDedicatedTrail),
  );

  const openTrailsQuery = useOpenTrails({
    enabled: Boolean(configured && user && trailheadSessionActive && menuOpen),
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
    invalidateLiveCourseActivityIdsCache();
    reloadCourseActivityRef.current({ forceInvalidate: false });
    setActivityMapRefreshNonce((n) => n + 1);
  }, []);
  const onRidePersistedToFirestore = useCallback((courseId: string | null) => {
    if (courseId?.trim()) {
      applyRideCompletedOptimisticRef.current();
      invalidateLiveCourseActivityIdsCache();
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

  activeCourseIdRef.current = basicActiveHubCourseId ?? activeOfficialCourseId;

  const trackedCourseId = basicActiveHubCourseId ?? activeOfficialCourseId;
  const isRideSessionActive = rideStatus === "running" || rideStatus === "paused";

  const trailDisplayLabels = useMemo(
    () => resolveTrailDisplayLabel(sanitizedTrailId, currentTrailMeta),
    [sanitizedTrailId, currentTrailMeta],
  );
  const debugMapPhase = getMapDebugPhase();
  const debugMapIsolationActive =
    debugMapPhase === "A" || debugMapPhase === "B" || debugMapPhase === "C";

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
    trackedCourseId,
    publishedPublicCourses,
    openTrails: openTrailsQuery.rows,
    trailRoomLabel: trailDisplayLabels.room,
    activityMapRefreshNonce,
    debugIsolation: debugMapIsolationActive,
  });

  const {
    activityWorldRaw,
    getActivityWorldPinLabel,
    trailSpectatorDots: spectatorDots,
    trailSpectatorRoutes: spectatorRouteGeometries,
    courseActivity,
    reloadCourseActivity,
    applyRideCompletedOptimistic,
    courseActivityByCourseId,
    worldHudLines,
    lodDebugPanelProps,
  } = mapOverlays;

  reloadCourseActivityRef.current = (options) => {
    void reloadCourseActivity(options);
  };
  applyRideCompletedOptimisticRef.current = applyRideCompletedOptimistic;

  /** 퍼블릭 코스 ID — MENU 없이도 Activity World 카탈로그에 포함(주행 미참여 관전) */
  useEffect(() => {
    if (!configured || !user || !pageVisible) return;
    void refreshPublishedPublicCourseCatalog();
  }, [configured, user, pageVisible, refreshPublishedPublicCourseCatalog]);

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

  const onCoursePeersChange = useCallback((next: MapPeerMarker[]) => {
    setCoursePeerMarkers(next);
  }, []);

  /** 입문 허브·퍼블릭 등 공식 코스 동행 presence — coursePresence + global livePresence */
  const sharedPresenceCourseId = basicActiveHubCourseId ?? activeOfficialCourseId ?? null;

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
    const base = (liveRiderNametag ?? selfRiderNametagFallback)?.trim();
    const riding = rideStatus === "running" || rideStatus === "paused";
    if (!riding) return base || null;
    const room = trailDisplayLabels.room;
    return base ? `${room} · ${base}` : room;
  }, [liveRiderNametag, selfRiderNametagFallback, rideStatus, trailDisplayLabels.room]);

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

  /** 비로그인 상태에서는 사용자 시트 액션(Trailhead/로그아웃)이 없으므로 시트를 닫음 */
  useEffect(() => {
    if (!user) setUserInfoSheetOpen(false);
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sub = params.get("subscription");
    if (!sub) return;
    if (sub === "success") {
      setSubscriptionFlash("구독이 완료되었습니다. 플랜이 곧 반영됩니다.");
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
    startTransition(() => setCoursePeerMarkers([]));
  }, [sharedPresenceCourseId]);

  useEffect(() => {
    if (!sharedPresenceCourseId) setLiveRiderNametag(null);
  }, [sharedPresenceCourseId]);

  const avgSpeedLabel = useMemo(() => {
    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    if (elapsedSec <= 0) return "0.0";
    const avg =
      (rideMetrics.virtualDistanceMeters / 1000) / (elapsedSec / 3600);
    return avg.toFixed(1);
  }, [rideMetrics.accumulatedMs, rideMetrics.virtualDistanceMeters]);

  const returnToTrailhead = useCallback(() => {
    const tid = DEFAULT_TRAIL_ID;
    setTrailDraft(tid);
    setTrailId(tid);
    replaceTrailInUrl(tid);
    hostTrailIdRef.current = null;
  }, [setTrailDraft, setTrailId]);

  const goTrailheadAndCloseMenu = useCallback(() => {
    returnToTrailhead();
    setMenuOpen(false);
  }, [returnToTrailhead]);

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
    (nextTrailId: string) => {
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
        const gate = canUserJoinTrail(meta, user);
        if (!gate.ok) {
          setRouteSummary(gate.message);
          return;
        }
        if (meta.courseId) {
          await loadCourseRouteForTrailJoin(meta.courseId);
        }
        hostTrailIdRef.current = null;
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
      const gate = canUserJoinTrail(meta, user);
      if (!gate.ok) {
        setRouteSummary(gate.message);
        returnToTrailhead();
        return;
      }
      if (meta.courseId) {
        await loadCourseRouteForTrailJoin(meta.courseId);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trailId 전환 시 1회만 검증·경로 로드
  }, [sanitizedTrailId, user?.uid, configured, rideStatus]);

  function handleStartRide() {
    if (!routeGeometry || rideStatus !== "idle" || !user || !configured || trailStartBusy) return;
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
          const existing = await fetchTrailInstance(currentTid);
          if (!existing) {
            setError("선택한 Trail을 찾을 수 없습니다.");
            return;
          }
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
          void touchTrailInstanceActivity(currentTid);
          const num = formatTrailDisplayNumber(existing.displayNumber);
          setRouteSummary(
            `Trail ${num} 합류 · ${existing.regionLabel?.trim() || "같은 Trail에서 주행"}`,
          );
          resetArrivalGate();
          resetRide();
          setRideStatus("running");
          return;
        }

        const visibility = resolveNewTrailVisibility(courseId);
        const trail = await createTrailInstance({
          hostUid: user.uid,
          courseId: courseId ?? null,
          regionLabel,
          distanceKm: routeDistanceMeters > 0 ? routeDistanceMeters / 1000 : null,
          visibility,
        });
        hostTrailIdRef.current = trail.id;
        const prev = sanitizeTrailId(trailId);
        if (prev !== trail.id) {
          await deleteTrailPresence(user.uid, prev).catch(() => {});
        }
        setTrailId(trail.id);
        setTrailDraft(trail.id);
        replaceTrailInUrl(trail.id);
        resetArrivalGate();
        resetRide();
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
    const endedTrailId = sanitizeTrailId(trailId);
    const uid = user?.uid ?? null;
    const wasHostTrail = hostTrailIdRef.current === endedTrailId;
    handleEndRide();
    void (async () => {
      if (uid && wasHostTrail && endedTrailId !== DEFAULT_TRAIL_ID) {
        await closeTrailInstance(endedTrailId).catch(() => {});
      }
      returnToTrailhead();
    })();
  }, [trailId, user?.uid, handleEndRide, returnToTrailhead]);

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
          await deleteCoursePresence(user.uid, hid).catch(() => {
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

  const globalPresencePublishLngLat = useMemo(
    (): LngLat => liveForMap ?? mapViewportCenterLngLat,
    [liveForMap, mapViewportCenterLngLat],
  );

  const activeCourseIdForGlobalPresence =
    basicActiveHubCourseId ?? activeOfficialCourseId ?? currentTrailMeta?.courseId ?? null;

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
        (basicActiveHubCourseId ?? activeOfficialCourseId ?? currentTrailMeta?.courseId) &&
        Boolean(routeGeometry?.coordinates?.length),
    ),
    pageVisible,
    lngLat: globalPresencePublishLngLat,
    trailId,
    courseId: basicActiveHubCourseId ?? activeOfficialCourseId ?? currentTrailMeta?.courseId ?? null,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
  });

  const { dots: globalPresenceDots } = useGlobalLivePresence({
    user,
    enabled: globalLivePresenceSubscribeEnabled,
  });

  const peerMarkersForMap = useMemo(() => {
    if (mapZoom <= MAP_PEER_SPRITE_MIN_ZOOM) return [];
    return coursePeerMarkers;
  }, [mapZoom, coursePeerMarkers]);

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

  const worldActivityHint = useMemo(() => {
    if (mapZoom > MAP_ZOOM_WORLD_ACTIVITY_MAX || !worldHudLines) return null;
    return worldHudLines;
  }, [mapZoom, worldHudLines]);

  const mapHudRidePresence = useMemo(() => {
    if (!configured || !user) return null;
    const courseTitle = sharedPresenceCourseId
      ? (sharedPresenceCourseTitle?.trim() || "공식 경로")
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
    const tid = sanitizeTrailId(trailId);
    return {
      trailheadEnabled: true,
      trailId: tid,
      trailDisplayLabel: trailDisplayLabels.short,
      trailRoomLabel: trailDisplayLabels.room,
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
    trailDisplayLabels,
    currentTrailMeta,
    trailSession.rows,
    trailSession.error,
    sharedPresenceCourseId,
    sharedPresenceCourseTitle,
    coursePeerMarkers,
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
              pinState: {
                start: Boolean(startLngLat),
                end: Boolean(endLngLat),
                waypointCount: routeWaypoints.length,
              },
              routeBrief,
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
              showSetupRouteHint: stage === "setup" && !bJourneyHintDismissedSession,
              onDismissSetupRouteHint: dismissBJourneyHint,
              ridePresence: mapHudRidePresence,
              worldActivityHint,
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
            mapView={{
              accessToken: MAPBOX_TOKEN || undefined,
              routeElevationProfile: rideElevationProfile,
              routeGeometry,
              startLngLat,
              endLngLat,
              routeWaypoints,
              liveLngLat: liveForMap,
              liveRiderMotion:
                rideStatus === "idle"
                  ? null
                  : {
                      sessionStatus: rideStatus,
                      speedKmh,
                      crankRpmFromSensor: bleCrankRpm.crankRpm,
                    },
              liveRiderNametag: resolvedLiveRiderNametag,
              peerMarkers: peerMarkersForMap,
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
            }}
            lodDebug={lodDebugPanelProps}
            mapHud={{
              stage,
              onOpenMenu: openMenuPanel,
              menuOpen,
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
              pinState: {
                start: Boolean(startLngLat),
                end: Boolean(endLngLat),
                waypointCount: routeWaypoints.length,
              },
              routeBrief,
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
              showSetupRouteHint: stage === "setup" && !bJourneyHintDismissedSession,
              onDismissSetupRouteHint: dismissBJourneyHint,
              ridePresence: mapHudRidePresence,
              worldActivityHint,
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
        <TrailHubPanel
          user={user}
          activeTrailId={sanitizedTrailId}
          currentTrail={currentTrailMeta}
          openTrails={openTrailsQuery.rows}
          openTrailsLoading={openTrailsQuery.loading}
          openTrailsError={openTrailsQuery.error}
          onGoTrailhead={goTrailheadAndCloseMenu}
          onJoinTrail={joinTrailAndCloseMenu}
          onSetVisibility={handleSetTrailVisibility}
          visibilityBusy={trailVisibilityBusy}
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
          authGuest={userTier.isGuest}
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
        <CourseSharedPresence
          user={user}
          courseId={sharedPresenceCourseId}
          trailId={trailId}
          title={sharedPresenceCourseTitle}
          isRiding={rideStatus === "running"}
          rideSessionActive={rideStatus === "running" || rideStatus === "paused"}
          onPeersChange={onCoursePeersChange}
          onLiveRiderNametagChange={setLiveRiderNametag}
        />
      ) : null}
    </div>
  );
}
