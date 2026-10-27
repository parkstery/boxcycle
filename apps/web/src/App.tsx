import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PublicationSharedPresence } from "./components/PublicationSharedPresence";
import { peerHudLabels, type PeerHudEntry } from "./lib/peerMotion/peerHud";
import { SignUpNicknameCard } from "./components/auth/SignUpNicknameCard";
import { ProfileEditSheet } from "./components/ProfileEditSheet";
import { RideRoutePanel } from "./components/ride/RideRoutePanel";
import type { FollowMode } from "./lib/map/mapGlobeView";
import { PublicRouteRequestModal } from "./components/PublicRouteRequestModal";
import { useTrailSession } from "./hooks/useTrailSession";
import { useLiveLocationPublishSession } from "./hooks/useLiveLocationPublishSession";
import { useGlobalLivePresence } from "./hooks/useGlobalLivePresence";
import { useDocumentVisibility } from "./hooks/useDocumentVisibility";
import {
  formatRouteActivityHudLine,
  invalidateLiveRouteActivityIdsCache,
  invalidateRouteActivityCache,
} from "./lib/activity/repo/firestoreRouteActivity";
import { AppMapStage, RouteMinimap, useAppMapOverlays } from "./features/map-overlays";
import { resolveOpenTrailsListenerEnabled } from "./features/map-overlays/listenerScopePolicy";
import { RouteDock, useRouteDockStops, type RouteDockStop, type RouteDockStopId } from "./components/route-dock";
import { RideControlBar } from "./components/ride/RideControlBar";
import { armPostRideActivityWatch } from "./lib/activity/activityWorldPollSignals";
import {
  MAP_GLOBE_MIN_ZOOM,
  MAP_ZOOM_SLIDER_MAX,
  RIDE_START_ZOOM,
  RIDE_CAMERA_DISTANCE_MIN_M,
} from "./lib/map/mapGlobeView";
import {
  nextRideUserZoomInDistanceM,
  nextRideUserZoomOutDistanceM,
} from "./lib/camera/rideUserZoom";

import { rideDistanceAlongRoute } from "./lib/ride/liveLocationSnapshot";
import { AuthGateCard } from "./components/auth/AuthGateCard";
import { AuthSessionGate } from "./components/auth/AuthSessionGate";
import { AppIntroScreen } from "./components/auth/AppIntroScreen";
import { GuestEntryCard } from "./components/auth/GuestEntryCard";
import { allowUnauthMapDev } from "./lib/identity/authGatePolicy";
import {
  clearStartScreenNotice,
  readGuestEntryAccepted,
  readStartScreenNotice,
} from "./lib/storage/appSessionKeys";
import { startGuestActivityWatch } from "./lib/identity/guestActivity";
import { postGuestActivity } from "./lib/identity/repo/guestLifecycleApi";
import { useUserTier } from "./hooks/useUserTier";
import { useRideStartPulseKey } from "./hooks/useRideStartPulseKey";
import { RideSummarySheet } from "./components/ride/RideSummarySheet";
import { LeaderboardGlanceChip, LeaderboardGlancePanel } from "./components/leaderboard/LeaderboardGlance";
import { buildGlanceLiveRows } from "./components/leaderboard/leaderboardGlanceSnapshot";
import { computeRideRankChangeLine } from "./components/leaderboard/leaderboardLiveRank";
import { useLeaderboardGlance } from "./hooks/useLeaderboardGlance";
import { NextRideCard } from "./components/ride";
import { resolveNextRideView } from "./lib/ride/nextRideTarget";
import type { NextRideTarget } from "./lib/ride/nextRideTarget";
import { useRideResumeSlot } from "./hooks/useRideResumeSlot";
import {
  filterProgressAppliedEventsForUid,
  peekNextProgressAppliedEvent,
  resolveAdhocSaveSlotAcquireAction,
  resolveResumeSlotSwitchAction,
  resolveRideEndSlotAction,
  shouldMarkSlotOpProcessed,
  type ProgressAppliedSlotEvent,
} from "./lib/ride/rideResumeSlotPolicy";
import type { RideEndResult } from "./lib/ride/rideEndResult";
import { buildRideStoryFacts, composeRideEndStory } from "./lib/ride/rideStory";
import { readPreviousRideStoryKind, rememberRideStoryKind } from "./lib/ride/rideStoryMemory";
import type { OnSavedRouteProgressApplied } from "./lib/ride/rideEndPersistence";
import { MenuPanel } from "./components/MenuPanel";
import { MapBottomLeftStack } from "./features/map-overlays/MapBottomLeftStack";
import { PlaceSearchPanel } from "./components/PlaceSearchPanel";
import { MenuPlaceSearch } from "./components/MenuPlaceSearch";
import { TrailHubPanel } from "./components/trail/TrailHubPanel";
import { useOpenTrails } from "./hooks/useOpenTrails";
import { useTrailInstanceMeta } from "./hooks/useTrailInstanceMeta";
import {
  localFirstRegionLabel,
  makeLocalFirstRegion,
  readLocalFirstRegion,
  writeLocalFirstRegion,
  type LocalFirstRegion,
} from "./lib/geo/localFirstRegion";
import { EntryLocationDialog } from "./components/auth/EntryLocationDialog";
import { useEntryLocation } from "./hooks/useEntryLocation";
import { MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM } from "./lib/map/mapBootCenter";
import {
  buildTrailRegionLabel,
  createTrailInstance,
  fetchTrailInstance,
  setTrailVisibility,
  touchTrailInstanceActivity,
  withResolvedTrailPublicationId,
  type TrailInstance,
} from "./lib/trail/repo/firestoreTrailInstance";
import {
  fetchOpenTrailListingPublicationId,
  refreshOpenTrailListingFromTrail,
} from "./lib/trail/repo/firestoreOpenTrailListings";
import { formatTrailDisplayNumber, resolveTrailDisplayLabel } from "./lib/trail/trailDisplayNumber";
import {
  readTrailDisplayNumberCache,
  rememberTrailDisplayNumber,
} from "./lib/trail/trailDisplayNumberCache";
import { RotateOverlay } from "./components/RotateOverlay";
import { DevLabPanels } from "./components/devLabs/DevLabPanels";
import { MapViewSheet } from "./components/map/MapViewSheet";
import { EdgePanelHandle } from "./components/ui/EdgePanelHandle";
import { UserInfoSheet } from "./components/UserInfoSheet";
import { AdminDashboardSheet } from "./components/admin/AdminDashboardSheet";
import { LeaderboardSheet } from "./components/leaderboard/LeaderboardSheet";
import { RideSettingsSheet } from "./components/ride/RideSettingsSheet";
import { RouteClearBlockedDialog } from "./components/ride/RouteClearBlockedDialog";
import { isRouteClearBlockedByRide } from "./lib/route/routeClearGuard";
import { useCalorieProfile } from "./hooks/useCalorieProfile";
import { usePacerPreference } from "./hooks/usePacerPreference";
import {
  clampActiveSecForCalories,
  estimateGrossKcal,
  resolveMet,
  type CalorieSessionSnapshot,
} from "./lib/ride/caloriesEstimate";
import { useRideUiStage } from "./hooks/useRideUiStage";
import {
  useRideArrivalAutoEnd,
  useRideCoachingMedia,
  useRideFeedbackPreferences,
} from "./features/ride-feedback";
import { isFirebaseConfigured } from "./lib/firebase/app";
import {
  BASIC_SHARED_HUB_IDS,
  BASIC_SHARED_HUB_SUMMARIES,
  ensureBasicCoursesSeeded,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "./lib/route/repo/firestoreCourses";
import { deletePublicationSessionMember } from "./lib/ride/repo/firestorePublicationSessionPresence";
import { deleteGlobalLivePresence } from "./lib/ride/repo/firestoreGlobalLivePresence";
import {
  DEFAULT_TRAIL_ID,
  deleteTrailPresence,
  isTrailMemberActive,
  sanitizeTrailId,
} from "./lib/trail/repo/firestoreTrail";
import { canUserJoinTrail, resolveNewTrailVisibility } from "./lib/trail/trailAccessPolicy";
import { replaceTrailInUrl } from "./lib/trail/trailUrl";
import type { LngLat, LineStringGeometry } from "./lib/geo/geo";
import { boundsFromLineCoordinates, getPointOnRouteByDistance, lineStringLengthMeters } from "./lib/geo/geo";
import { MAX_ROUTE_WAYPOINTS } from "./lib/geo/routeWaypoints";
import { lockRouteWorkspaceDuringRide } from "./lib/route/routeWorkspaceLock";
import { resolveRideContinuationSetup } from "./lib/ride/rideContinuationSetup";
import type { PublishedPublicCourseSummary } from "./lib/route/repo/firestoreCourses";
import {
  publicationDisplayTitle,
} from "./lib/route/publicationDisplay";
import {
  resolvePublishedRouteLink,
  type PublishedRouteLink,
  type RouteRideEntry,
} from "./lib/route/routePublicationResolve";
import type { SavedRoute } from "./lib/route/repo/firestoreSavedRoutes";
import { SAVED_ROUTE_NAME_MAX } from "./lib/route/repo/firestoreSavedRoutes";
import { useAppAuth } from "./hooks/useAppAuth";
import { useRouteTokenBalance } from "./hooks/useRouteTokenBalance";
import {
  isRouteTokenGenerateMetered,
  useRouteTokenGenerateCostBase,
} from "./lib/account/routeTokenEconomyClient";
import { useAppTrail } from "./hooks/useAppTrail";
import { useRoutePlanning } from "./hooks/useRoutePlanning";
import { useScreenWakeLock } from "./hooks/useScreenWakeLock";
import { useRecentRideSessions } from "./hooks/useRecentRideSessions";
import { usePublicationCatalogHub } from "./hooks/usePublicationCatalogHub";
import { usePublicRouteReviewMeta } from "./hooks/usePublicRouteReviewMeta";
import { useSavedRoutesWorkspace } from "./hooks/useSavedRoutesWorkspace";
import { useRideEndAndPersistence } from "./hooks/useRideEndAndPersistence";
import { useRecentRoadDisplay } from "./hooks/useRecentRoadDisplay";
import { computeConquestOverviewFrame } from "./lib/conquest/conquestOverviewFrame";
import type { ConquestDisplayMode } from "./components/map/routeConquestLayers";
import { useDistanceAutoRoute } from "./hooks/useDistanceAutoRoute";
import {
  DEFAULT_MAP_STYLE,
  MAP_STYLE_SATELLITE,
  mapStyleHudShortLabel,
  nextOutdoorsSatelliteMapStyle,
} from "./lib/map/rtwMapConfig";
import { isRideInputReady } from "./lib/sensor/cadenceSensorUi";
import { CadenceSensorSheet } from "./components/sensor";
import { useConquest } from "./hooks/useConquest";
import { useLiveConquestPaint, shouldShowAlreadyOwnedHint } from "./hooks/useLiveConquestPaint";
import { ROUTE_COMPLETION_RATIO_THRESHOLD, resumeOffsetMetersFrom } from "./lib/ride/rideRecordPolicy";
import type { CoverageOverlayMode } from "./lib/activity/coverageOverlayMode";
import { type RouteProfile } from "./services/mapboxDirections";
import { FUNCTIONS_REGION, MAPBOX_TOKEN } from "./app/env";
import { useAppSheetNavigation } from "./app/useAppSheetNavigation";
import { useAppMapCameraState } from "./app/useAppMapCameraState";
import { useAppRideInputReadiness } from "./app/useAppRideInputReadiness";
import { computeAppHudValues } from "./app/appHudValues";
import { getMapDebugPhase } from "./lib/debug/mapDebugPhase";
import {
  type Camera1Mode,
  CAMERA1_AERIAL_DISTANCE_M,
  nextCamera1Mode,
  resolveCamera1EnterMapStyle,
  resolveCamera1ExitMapStyle,
} from "./lib/camera/camera1Mode";
import {
  getQuickCameraProductTune,
  isQuickCameraOutdoorsOnly,
  QUICK_CAMERA_FALLBACK_DISTANCE_M,
} from "./lib/camera/quickCameraProductTune";
import "./App.css";
import { memberNeedsNickname, presenceRiderDisplayName, selfRiderDisplayName } from "./lib/identity/riderName";

/**
 * WO-260528 디버그 지도 스테이지 — 주소 스위치(map debug phase A/B/C)로 켜질 때만 불러온다.
 * 정적 import 를 쓰면 운영 기본 청크에 debug 화면이 함께 들어간다 → 동적 import 로 분리.
 */
const DebugMapStage = lazy(() =>
  import(/* webpackChunkName: "debug-map-stage" */ "./features/map-overlays/DebugMapStage").then((m) => ({
    default: m.DebugMapStage,
  })),
);

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
    authOffline,
    authExpiryKind,
    beginAuthenticatedSession,
    handleGoogleSignIn,
    retryAuthRestore,
    requestNicknameEntry,
    handleCompleteNickname,
    handleChangeNickname,
    endAppUse,
    appUseEnded,
    setError,
    setBusy,
  } = useAppAuth(configured);

  const userTier = useUserTier(user, configured);

  const { routeTokenBalance } = useRouteTokenBalance(user, configured);
  const routeTokenGenerateCostBase = useRouteTokenGenerateCostBase();
  const routeTokenMetered = isRouteTokenGenerateMetered(routeTokenGenerateCostBase);
  const routeTokenInsufficient =
    routeTokenMetered && routeTokenBalance != null && routeTokenBalance < 1;
  /** Conquest(정복) — 요약 구독 + 내 도로 셀 + 「내 도로망」 궤적. 쓰기는 CF 전용. */
  const {
    summary: conquestSummary,
    cellIds: conquestCellIds,
    traces: conquestTraces,
    recentNewRoad,
  } = useConquest(user, configured);

  const {
    mapStyle,
    setMapStyle,
    mapZoom,
    setMapZoom,
    rideCameraDistanceM,
    setRideCameraDistanceM,
    rideFollowCameraNonce,
    setRideFollowCameraNonce,
    rideJoinBurstNonce,
    setRideJoinBurstNonce,
    mapViewportSpanKm,
    mapViewportCenterLngLat,
    mapLodZoom,
    mapLodSpanKm,
    onMapViewport,
    onMapLodViewport,
    followMode,
    setFollowMode,
    activeQuickCamera,
    setActiveQuickCamera,
    camera1Mode,
    setCamera1Mode,
    camera1StyleBeforeEnterRef,
    camera1UserToggledStyleRef,
    lockBaseHeading,
    setLockBaseHeading,
    rideCameraSpanFloorMode,
    setRideCameraSpanFloorMode,
    mapZoomStepRequest,
    setMapZoomStepRequest,
    mapZoomStepSeqRef,
    enable3D,
    setEnable3D,
    followModeSnapshotRef,
    mapZoomSnapshotRef,
    rideCameraRestoreRef,
  } = useAppMapCameraState();
  const {
    manualSpeedKmh,
    setManualSpeedKmh,
    rideInputMode,
    bleCrankRpm,
    switchRideInputToManual,
    switchRideInputToCadence,
    rideInputReadiness,
    rideTargetSpeedKmh,
  } = useAppRideInputReadiness();
  const rideInputReady = isRideInputReady(rideInputReadiness);
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
    cadenceSensorSheetOpen,
    adminDashboardSheetOpen,
    leaderboardSheetOpen,
    setMenuOpen,
    setPlaceSearchOpen,
    setMapViewSheetOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    setCadenceSensorSheetOpen,
    setAdminDashboardSheetOpen,
    setLeaderboardSheetOpen,
    openMenuPanel,
    openPlaceSearchPanel,
    openMapViewPanel,
    openUserInfoPanel,
    openRideSettingsPanel,
    openCadenceSensorPanel,
    openAdminDashboardPanel,
    openLeaderboardPanel,
  } = useAppSheetNavigation();
  const [menuReveal, setMenuReveal] = useState<number | null>(null);
  const [mapViewReveal, setMapViewReveal] = useState<number | null>(null);
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
  const [summarySheetVisible, setSummarySheetVisible] = useState(false);
  const [coverageOverlayMode, setCoverageOverlayMode] = useState<CoverageOverlayMode>("off");
  const [conquestDisplayMode, setConquestDisplayMode] = useState<ConquestDisplayMode>("all");
  /** 미완료 쿼터 초과 유도 — 안내 배너 문구와 「내 경로」 탭 오픈 신호(nonce) */
  const [savedQuotaNotice, setSavedQuotaNotice] = useState<string | null>(null);
  const [openSavedTabNonce, setOpenSavedTabNonce] = useState(0);
  /** 퍼블릭 등록 취소 시 「내 경로」 창 복귀용 nonce — 대기 필터 강제 없음(2026-10-06 Chief). */
  const [reopenSavedNonce, setReopenSavedNonce] = useState(0);
  /** 이어 달리기(§9.5.5 단위7) — 마지막으로 로드한 저장 경로 id(재개 후보). 렌더 중 ref 읽기 회피용 state */
  const [resumeCandidateId, setResumeCandidateId] = useState<string | null>(null);
  /**
   * 이번 세션의 경로상 시작 오프셋(m) — HUD 는 오늘(세션) 거리와 누적 위치·진행률을 함께 표시하고,
   * 평속·칼로리·종료 요약·Claim 은 세션 실주행(누적 − offset) 기준으로 파생하기 위한 state.
   */
  const [sessionStartOffsetMeters, setSessionStartOffsetMeters] = useState(0);
  /**
   * 종료 결과(RIDE-CONTINUE-1 §3.5) — 폐기되지 않은 모든 유효 Ride 가 채운다.
   * 결과 시트 노출 조건이자 「다음 출발점」 안내의 근거.
   */
  const [lastRideResult, setLastRideResult] = useState<RideEndResult | null>(null);
  /**
   * 이번 앱 세션에서 숨긴 「다음 주행」 카드의 Ride id — 새 Ride 는 id 가 달라 자동으로 다시 뜬다(§4.3-6).
   * Ride·SavedRoute 를 삭제하지 않는다.
   */
  const [nextRideDismissedRideId, setNextRideDismissedRideId] = useState<string | null>(null);
  /**
   * 지명 검색 결과 목적지 — menu(기존) vs localFirst(Recognition 카드).
   * 패널을 여는 쪽이 설정하고, pick/close 때 menu 로 되돌린다.
   */
  const placeSearchIntentRef = useRef<"menu" | "localFirst">("menu");
  /** Local First 지역 — 클라이언트 + localStorage. 새 Firestore 없음(LF-1). */
  const [localFirstRegion, setLocalFirstRegion] = useState<LocalFirstRegion | null>(() =>
    readLocalFirstRegion(),
  );
  /**
   * 지역 선택 1회당 카메라 점프 1회 — at 키로 가드.
   * 저장돼 있던 지역은 이번 진입 위치 선택을 덮지 않도록 이미 처리한 것으로 둔다.
   * 이후 검색·지역 선택은 새 at 로 그대로 점프한다.
   */
  const localFirstFramedAtRef = useRef<string | null>(localFirstRegion?.at ?? null);
  /** anchor 이어 달리기 — Start 가 sessionEndLngLat 에 고정된 상태(null=일반 자동 Route) */
  const anchorFixedStartRef = useRef<LngLat | null>(null);
  const routePickOpenSeqRef = useRef(0);
  const [routePickOpenRequest, setRoutePickOpenRequest] = useState<{
    lngLat: LngLat;
    requestId: number;
  } | null>(null);

  const {
    publicRouteRequestModalRoute,
    setPublicRouteRequestModalRoute,
    pendingPublicRouteIds,
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
  /** 주행 종료 시 `rides.publicationId` — publication 카탈로그 해소 이후 매 렌더 갱신 */
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
    routeSetupToken,
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
    sampleLiveDistM,
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
    rideTargetSpeedKmh,
    mapboxAccessToken: MAPBOX_TOKEN,
    functionsRegion: FUNCTIONS_REGION,
    clearRouteArtifactsRef,
    onRouteDirectionsErrorRef,
  });
  const leaderboardGlance = useLeaderboardGlance(user, rideStatus !== "idle");
  const sessionPedalQualifiedRef = useRef(false);
  // 주행·일시정지 동안 폰 화면이 꺼지지 않게(10-23)
  useScreenWakeLock(rideStatus !== "idle");

  /** 주행 시작 — 후방 추적·최대 줌 / 종료 시 이전 카메라 설정 복원 */
  useEffect(() => {
    if (rideStatus === "running") {
      if (!rideCameraRestoreRef.current) {
        rideCameraRestoreRef.current = {
          follow: followModeSnapshotRef.current,
          zoom: mapZoomSnapshotRef.current,
        };
        setEnable3D(false);
        setMapZoom(RIDE_START_ZOOM);
        /*
         * 2026-10-06 Chief: 주행 시작 기본 카메라 = 퀵 카메라 1번 500m(aerial500).
         * 1번 진입 규칙(bad185c)대로 위성 지도, 진입 직전 스타일은 기본 지도로 기억해 두고
         * 종료(idle) 때 사용자가 주행 중 스타일을 직접 바꾸지 않았으면 되돌린다.
         */
        camera1StyleBeforeEnterRef.current = DEFAULT_MAP_STYLE;
        camera1UserToggledStyleRef.current = false;
        setMapStyle(MAP_STYLE_SATELLITE);
        setActiveQuickCamera(1);
        setCamera1Mode("aerial500");
        setLockBaseHeading(null);
        setFollowMode("aerial");
        setRideCameraDistanceM(CAMERA1_AERIAL_DISTANCE_M.aerial500);
        setRideCameraSpanFloorMode("preset");
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
      // 주행 시작 때 들어간 퀵 카메라 1번을 놓는다 — 위성은 사용자가 바꾸지 않았으면 원래 지도로
      if (camera1StyleBeforeEnterRef.current != null) {
        if (!camera1UserToggledStyleRef.current) {
          setMapStyle(camera1StyleBeforeEnterRef.current);
        }
        camera1StyleBeforeEnterRef.current = null;
        camera1UserToggledStyleRef.current = false;
      }
      setActiveQuickCamera(null);
    }
  }, [rideStatus, camera1StyleBeforeEnterRef, camera1UserToggledStyleRef, followModeSnapshotRef, mapZoomSnapshotRef, rideCameraRestoreRef, setActiveQuickCamera, setCamera1Mode, setEnable3D, setFollowMode, setLockBaseHeading, setMapStyle, setMapZoom, setRideCameraDistanceM, setRideCameraSpanFloorMode, setRideFollowCameraNonce, setRideJoinBurstNonce]);

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
    savedRoutesLoaded,
    loadedSavedRouteIdRef,
    loadedSavedRouteNameRef,
    loadedSavedRouteProgressRef,
    lastEndedWasAdhoc,
    setLastEndedWasAdhoc,
    handleSaveAdhocAsUserRoute,
    handleLoadSavedRoute,
    handleRenameSavedRoute,
    handleDeleteSavedRoute,
  } = savedRoutesWorkspace;

  // 단일 이어달리기 슬롯
  const rideResumeSlot = useRideResumeSlot({
    configured,
    user,
    savedRoutes,
    savedRoutesLoaded,
    savedRoutesLoading,
    recentSessions,
  });

  // 경로 삭제 후 슬롯 강제 해제(삭제 전 clear는 유효 미완주로 거부됨)
  const handleDeleteSavedRouteWithSlotClear = useCallback(
    async (route: SavedRoute) => {
      await handleDeleteSavedRoute(route);
      await rideResumeSlot.clearIfActive(route.id, { force: true });
    },
    [handleDeleteSavedRoute, rideResumeSlot.clearIfActive],
  );

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
   * 칼로리 실제 활동초와 동일 신호(pause·수동 가상속도는 미산정).
   */
  const pedalActiveSecRef = useRef<number | null>(null);
  const calorieSessionSnapshotRef = useRef<CalorieSessionSnapshot | null>(null);
  const calorieSignalGapRef = useRef(false);
  const { profile: calorieProfile, setWeightKg: setCalorieWeightKg, setIntensityId: setCalorieIntensityId } =
    useCalorieProfile(user);
  const { enabled: pacerEnabled, setEnabled: setPacerEnabled } = usePacerPreference(user);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  /** uid 切替 시 이전 계정 활동초·스냅샷이 남지 않게 렌더 중 ref 정렬 */
  const calorieUidRef = useRef(user?.uid ?? null);
  if (calorieUidRef.current !== (user?.uid ?? null)) {
    calorieUidRef.current = user?.uid ?? null;
    pedalActiveSecRef.current = null;
    calorieSignalGapRef.current = false;
    if (rideStatus === "running") {
      calorieSessionSnapshotRef.current = {
        weightKg: calorieProfile.weightKg,
        intensityId: calorieProfile.intensityId,
        met: resolveMet(calorieProfile.intensityId),
      };
    } else {
      calorieSessionSnapshotRef.current = null;
    }
  }

  /** Conquest — 주행 중 실시간 「새 도로」 카운터(낙관) */
  const { liveNewMeters: conquestLiveMeters } = useLiveConquestPaint({
    riding: rideStatus === "running" || rideStatus === "paused",
    routeGeometry,
    traveledMeters: rideMetrics.virtualDistanceMeters,
    fromMeters: sessionStartOffsetMeters,
    serverCellIds: conquestCellIds,
  });

  const {
    geometry: recentNewRoadGeometry,
    onResult: handleRecentConquestResult,
    onTimeout: handleRecentConquestTimeout,
  } = useRecentRoadDisplay({
    uid: userSignedOut ? null : user?.uid ?? null,
    active: rideStatus === "running" || rideStatus === "paused",
    persisted: recentNewRoad,
    cellIds: conquestCellIds,
    route: routeGeometry,
    traveled: rideMetrics.virtualDistanceMeters,
    from: sessionStartOffsetMeters,
    ended: lastRideResult,
  });
  /**
   * 「이미 내 도로」 힌트 — +0.00 고정 + 세션 ≥ 10m 일 때 true.
   * sessionDistanceMeters 는 아래에서 계산되므로 여기서는 직접 파생.
   */
  const conquestAllOwnedHint = shouldShowAlreadyOwnedHint(
    conquestLiveMeters,
    Math.max(0, rideMetrics.virtualDistanceMeters - sessionStartOffsetMeters),
  );

  /**
   * progress 실제 저장 성공 이벤트 큐 — `lastRideResult` UI 와 분리.
   * 결과창을 닫아 result 가 null 이 되어도 슬롯 확보/해제가 누락되지 않는다.
   */
  const pendingProgressAppliedRef = useRef<ProgressAppliedSlotEvent[]>([]);
  const [progressAppliedSeq, setProgressAppliedSeq] = useState(0);
  const onSavedRouteProgressApplied = useCallback<OnSavedRouteProgressApplied>((event) => {
    pendingProgressAppliedRef.current = [...pendingProgressAppliedRef.current, event];
    setProgressAppliedSeq((n) => n + 1);
  }, []);

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
    calorieSessionSnapshotRef,
    calorieSignalGapRef,
    publishedCatalogRef,
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    setLastRideResult,
    onRideEndedWithPublication,
    onRidePersistedToFirestore,
    onSavedRouteProgressApplied,
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
  /**
   * 내 위치·접속 신호를 **보내는** 쪽의 가시성. 주행 중이면 창을 가려도 계속 보낸다 —
   * 끊으면 동행 화면에서 내가 멈춘 사람이 되어 뒤로 밀리다, 돌아오는 순간 앞으로 튀었다
   * (2026-10-08 Chief). 받는 쪽(구독)은 그대로 `pageVisible` 을 따른다.
   */
  const publishVisible = pageVisible || isRideSessionActive;

  useEffect(() => {
    if (!isRideSessionActive || ridingTrailId) return;
    const tid = sanitizeTrailId(trailId);
    if (tid !== DEFAULT_TRAIL_ID) {
      setRidingTrailId(tid);
    }
  }, [isRideSessionActive, ridingTrailId, trailId]);

  const openTrailsQuery = useOpenTrails({
    /** Trailhead idle 또는 주행 중 메뉴 열림 — 주행+메뉴닫힘이면 listing/CG 해제 */
    enabled: resolveOpenTrailsListenerEnabled({
      configured,
      hasUser: Boolean(user),
      trailheadSessionActive,
      isRideSessionActive,
      menuOpen,
    }),
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
    pageVisible: publishVisible,
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

  const onRefreshPublishedPublicCourses = useCallback(() => {
    void refreshPublishedPublicCourseCatalog({ force: true });
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
    const pub = publishedPublicCourses.find((c) => c.id === sharedPresenceCourseId);
    return pub ? publicationDisplayTitle(pub) : "퍼블릭 경로";
  }, [sharedPresenceCourseId, publishedPublicCourses]);

  const selfRiderNametagFallback = useMemo(() => {
    if (!user) return null;
    if (sharedPresenceCourseId) return null;
    return selfRiderDisplayName(user);
  }, [user, sharedPresenceCourseId]);

  const resolvedLiveRiderNametag = useMemo(() => {
    return (liveRiderNametag ?? selfRiderNametagFallback)?.trim() || null;
  }, [liveRiderNametag, selfRiderNametagFallback]);

  /** Conquest — 주행(running) 중 1초 간격으로 케이던스>0 시간 누적(§3.2 검증된 페달링) */
  const crankRpmForConquestRef = useRef<number | null>(null);
  useEffect(() => {
    crankRpmForConquestRef.current = bleCrankRpm.crankRpm;
  }, [bleCrankRpm.crankRpm]);
  const prevRideStatusRef = useRef(rideStatus);
  useEffect(() => {
    if (
      (prevRideStatusRef.current === "running" || prevRideStatusRef.current === "paused") &&
      rideStatus === "idle"
    ) {
      sessionPedalQualifiedRef.current = pedalActiveSecRef.current != null;
    }
    if (prevRideStatusRef.current === "idle" && rideStatus === "running") {
      // 새 세션 시작 — 센서 신호를 보기 전까지는 null(T0) 유지
      pedalActiveSecRef.current = null;
      calorieSignalGapRef.current = false;
      // 체중·MET 스냅샷 고정(중간 설정 변경은 다음 주행부터)
      calorieSessionSnapshotRef.current = {
        weightKg: calorieProfile.weightKg,
        intensityId: calorieProfile.intensityId,
        met: resolveMet(calorieProfile.intensityId),
      };
    }
    prevRideStatusRef.current = rideStatus;
    if (rideStatus !== "running") return;
    const timer = setInterval(() => {
      const rpm = crankRpmForConquestRef.current;
      if (rpm == null) {
        // 연결 전 구간도 이후 센서가 연결되면 일부 구간만 산정한 것으로 표시한다.
        calorieSignalGapRef.current = true;
        return;
      }
      if (pedalActiveSecRef.current == null) pedalActiveSecRef.current = 0;
      if (rpm > 0) pedalActiveSecRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [rideStatus]);

  /*
   * (2026-09-28 Chief) 핀 팝업의 「🏴 내가 달린 도로」 한 줄을 제거했다.
   * 폐기된 v1 셀 단위 Pioneer(Conquest §3.4 에서 구간 챌린지로 대체)의 잔해로, 이름만
   * `lookupPioneer` 였을 뿐 개척자를 읽지 않고 내 conquest 셀을 로컬 대조하기만 했다.
   * 경로를 만드는 화면에서 아무 선택도 바꾸지 않고, 같은 사실은 지도의 마젠타
   * 「내 도로망」 궤적이 이미 보여 준다.
   */

  /** 「내 도로망」 렌더용 geometry 배열 */
  const conquestTraceGeometries = useMemo(
    () => (conquestTraces ? conquestTraces.map((t) => t.geometry) : null),
    [conquestTraces],
  );

  /** 내 도로망 보기 — 전체/최근 geometry를 지도 중심과 함께 전환한다. */
  const pendingConquestOverviewRef = useRef<ConquestDisplayMode | null>(null);
  const focusConquestView = useCallback(
    (mode: ConquestDisplayMode) => {
      setConquestDisplayMode(mode);
      const geometries =
        mode === "recent"
          ? recentNewRoadGeometry
          : [...(conquestTraceGeometries ?? []), ...recentNewRoadGeometry];
      const frame = computeConquestOverviewFrame(geometries);
      if (!frame) {
        pendingConquestOverviewRef.current = mode;
        return;
      }
      pendingConquestOverviewRef.current = null;

      cameraJumpSeqRef.current += 1;
      setFollowMode("free");
      setActiveQuickCamera(null);
      setLockBaseHeading(null);
      setExternalCameraJump({
        lngLat: frame.center,
        bbox: frame.bbox,
        requestId: cameraJumpSeqRef.current,
      });
    },
    [conquestTraceGeometries, recentNewRoadGeometry, setActiveQuickCamera, setFollowMode, setLockBaseHeading],
  );

  useEffect(() => {
    if (!pendingConquestOverviewRef.current) return;
    if (!conquestTraceGeometries?.length && recentNewRoadGeometry.length === 0) return;
    const mode = pendingConquestOverviewRef.current;
    focusConquestView(mode);
  }, [conquestTraceGeometries, recentNewRoadGeometry, focusConquestView]);

  const { coachData, rideElevationProfile, rideBgmCatalogConfigured } = useRideCoachingMedia({
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
    sessionStatus: rideStatus,
    // 코칭은 「현재 실제 움직임」이 기준 — 목표가 아니라 램핑 적용 속도
    speedKmh: rideMetrics.appliedSpeedKmh,
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
  // hook이 ownerUid+ready 가드된 active만 반환. loading 중엔 null.
  const resumeSlotActiveRouteId = rideResumeSlot.activeRouteId;

  const resumeRatio = (() => {
    if (rideStatus !== "idle" || !routeGeometry || !resumeCandidateId) return null;
    // 슬롯 ready + 활성 경로와 일치할 때만 이어달리기 오프셋 표시
    if (resumeSlotActiveRouteId !== resumeCandidateId) return null;
    const route = savedRoutes.find((r) => r.id === resumeCandidateId);
    if (!route || route.completed === 1) return null;
    const ratio = route.lastProgressRatio;
    return Number.isFinite(ratio) && ratio > 0 && ratio < ROUTE_COMPLETION_RATIO_THRESHOLD
      ? ratio
      : null;
  })();

  function handleStartRide(fromStart?: boolean) {
    if (!routeGeometry || rideStatus !== "idle" || !user || !configured || trailStartBusy) return;
    // 이름 없는 라이더는 달리지 않는다 — 닉네임 카드부터(가입 카드를 건너뛴 경로의 마지막 확인)
    if (memberNeedsNickname(user)) {
      requestNicknameEntry();
      return;
    }
    // 주행 입력 준비(센서 확인 또는 명시적 체험 속도 선택)가 끝나기 전에는 시작하지 않는다.
    if (!rideInputReady) return;
    /**
     * 슬롯 로딩 중 Go → offset 0으로 시작하면 재개 A를 처음부터로 오인한다.
     * 재개 후보가 로드된 상태면 준비될 때까지 대기.
     */
    const restartEarly = fromStart === true;
    if (
      !restartEarly &&
      resumeCandidateId &&
      loadedSavedRouteIdRef.current === resumeCandidateId &&
      rideResumeSlot.status !== "ready"
    ) {
      setRouteSummary("이어달리기 준비 중");
      return;
    }
    /*
     * 주행이 시작되면 거리 기반 자동 End 선택을 끝낸다(2026-09-18 Chief).
     * 종전에는 `armDirectionPick` 이 주행 중 **새 요청만 거절**했을 뿐, 이미 떠 있던 목표
     * 거리 원·방향 클릭 임시 표시·세션은 그대로 남았다.
     * effect 가 아니라 여기서 부른다 — 주행 시작은 상태에서 파생되는 값이 아니라 사용자
     * 행동이고, effect 안 동기 setState 는 연쇄 렌더를 부른다(react-hooks/set-state-in-effect).
     * 「거리」를 끌 때와 **같은 정리**(`disarm`)를 쓴다. 팝업·도크 닫기는 그 표면을 소유한
     * MapView 가 `rideActive` 로 받아 처리한다.
     */
    disarm();
    // MapHud FAB 등 onClick 직결 호출은 이벤트 객체가 첫 인자로 올 수 있어 `=== true` 로만 판정
    const restart = fromStart === true;
    /**
     * 재개 시작 오프셋(m) — 「위치는 누적, 인정은 세션」의 위치 시드(§9.5.5 단위7).
     * 이벤트 핸들러 내부라 ref 검증 허용 — 실제 로드된 경로와 후보가 일치할 때만 시드.
     */
    // Codex -04 Fix: F2 adapter (NO scaling - routeDistanceMeters offset = geometry offset in meters)
    const rideStartOffsetMeters =
      !restart && resumeRatio != null && loadedSavedRouteIdRef.current === resumeCandidateId && routeGeometry
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
          setLastRideResult(null);
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
        setLastRideResult(null);
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
    setRidingTrailId(null);
    handleEndRide();
    void (async () => {
      /*
       * 2026-09-27: 종전에는 **개설자일 때만** `closeTrailInstance()` 를 불러 Trail 을
       * `status: "closed"` 로 바꾸고 목록에서 지웠다. 되돌리는 코드가 앱에도 서버에도
       * 없어서 개설자는 **자기 Trail 에 영원히 못 돌아갔다**(참여자는 멀쩡했다 — 목록에
       * 남아 있어 번호를 다시 누르면 합류됐다).
       *
       * 그 「닫기」는 앞뒤도 맞지 않았다. Trail 이 닫히는 경우는 앱 전체에서 그 한 곳뿐이라,
       * 참여자만 남아 있다가 전부 나간 Trail 은 열린 채 남았다. 개설자의 Stop 만 예외였다.
       *
       * 이제 **누가 나가든 같다** — 목록을 다시 계산할 뿐이다. 「지금 달리는 사람이
       * 있는가」로 목록에 남길지 지울지는 `refreshOpenTrailListingFromTrail` 이 이미 정한다.
       * 그래서 남은 사람이 있으면 Trail 이 유지되고(종전에는 개설자가 나가면 사라졌다),
       * 아무도 없으면 목록에서 빠진다.
       *
       * ⚠ 아무도 없는 Trail 로 **돌아가는** 창구는 아직 없다 — 목록에 안 뜨기 때문이고,
       *   이는 개설자·참여자 모두 같다. 별건(2단계)으로 남긴다.
       */
      if (uid && endedTrailId !== DEFAULT_TRAIL_ID) {
        await refreshOpenTrailListingFromTrail(endedTrailId).catch(() => {});
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

  /** Trailhead·코스 정리 후 이용 종료. Firebase 세션은 남기고 시작 메뉴로 돌아간다. */
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
      setUserInfoSheetOpen(false);
      setMenuOpen(false);
      setIntroDismissed(false);
      setEntryRequested(false);
      endAppUse();
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
      publishVisible &&
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
    pageVisible: publishVisible,
    lngLat: globalPresencePublishLngLat,
    // peer 동기화는 메뉴 네비(trailId)가 아니라 실제 주행 trail(ridingTrailId)에 publish해야
    // 같은 trail의 motion 노드를 공유한다. 주행 중 메뉴가 Trailhead("default")로 가도 어긋나지 않음.
    trailId: menuTrailSanitizedId,
    publicationId: sharedRidePublicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
    // 발행 속도는 rAF 적용속도 샘플러가 만든다. 이 값은 idle fallback + 목표 변경 burst 용.
    speedKmh: rideTargetSpeedKmh,
    routeRidePhase: rideStatus === "paused" ? "paused" : "live",
    joinBurstNonce: rideJoinBurstNonce,
  });

  const { dots: globalPresenceDots } = useGlobalLivePresence({
    user,
    enabled: globalLivePresenceSubscribeEnabled,
  });


  /** Firebase 미설정이거나 인증 준비 완료 후 — Trailhead·입문 코스 UI가 숨겨지지 않도록 메인 워크스페이스 표시 */
  const rideWorkspaceOpen = !configured || (configured && authInitialized);
  void rideWorkspaceOpen;

  // ===== Map-first stage 머신 =====
  /**
   * 결과 시트 노출(§3.5) — 도착·ad-hoc 여부로 제한하지 않는다.
   * 폐기되지 않은 모든 유효 Ride 가 `lastRideResult` 를 채우므로 그것만으로 열린다.
   */
  /**
   * 주행 스토리(2026-10-07 Chief) — 결과 시트 맨 위 한 줄. 「지금」은 주행이 끝난 시각으로
   * 고정한다(렌더마다 시계를 읽지 않는다). 기록에 이번 주행이 이미 있어도 두 번 세지 않는다.
   */
  const rideEndStory = useMemo(() => {
    if (!lastRideResult) return null;
    const endedAt = new Date(lastRideResult.endedAtIso);
    if (!Number.isFinite(endedAt.getTime())) return null;
    return composeRideEndStory(
      buildRideStoryFacts({
        sessions: recentSessions,
        thisRide: {
          id: lastRideResult.recordId,
          serverRideId: lastRideResult.serverRideId,
          distanceMeters: lastRideResult.sessionDistanceMeters,
          endedAtIso: lastRideResult.endedAtIso,
          routeMeters: lastRideResult.hasRoute ? lastRideResult.routeDistanceMeters : 0,
          previousProgressRatio: lastRideResult.previousProgressRatio,
          progressRatio: lastRideResult.progressRatio,
          routeCompleted: lastRideResult.routeCompleted,
        },
        now: endedAt,
      }),
      readPreviousRideStoryKind(lastRideResult.recordId),
    );
  }, [lastRideResult, recentSessions]);
  const rideEndStoryRecordId = lastRideResult?.recordId ?? null;
  const rideEndStoryKind = rideEndStory?.kind ?? null;
  useEffect(() => {
    if (rideEndStoryRecordId && rideEndStoryKind) {
      rememberRideStoryKind(rideEndStoryRecordId, rideEndStoryKind);
    }
  }, [rideEndStoryRecordId, rideEndStoryKind]);

  const summaryVisible =
    lastRideResult !== null ||
    (summarySheetVisible && (arrivalToastTick > 0 || lastEndedWasAdhoc !== null));
  // 탈퇴·게스트 초기화 직후 첫 화면에 한 번 — 읽은 뒤 지워 다음 새로고침엔 나오지 않는다
  const [startScreenNotice] = useState(readStartScreenNotice);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [entryRequested, setEntryRequested] = useState(false);
  useEffect(() => {
    if (startScreenNotice) clearStartScreenNotice();
  }, [startScreenNotice]);
  const expiryKind =
    authExpiryKind ??
    (startScreenNotice === "guest-expired" || startScreenNotice === "account-unavailable" ? startScreenNotice : null);
  const needsGuestEntry =
    configured &&
    authInitialized &&
    !user &&
    !userSignedOut &&
    !appUseEnded &&
    !authOffline &&
    !readGuestEntryAccepted();
  const showAppIntro =
    (needsGuestEntry || (configured && authInitialized && !user && appUseEnded && !authOffline)) &&
    !introDismissed &&
    startScreenNotice !== "account-deleted" &&
    expiryKind == null &&
    !authSigningIn &&
    !busy &&
    !error;
  const entryLocationSessionRef = useRef(false);
  const entryArmed =
    configured &&
    authInitialized &&
    !userSignedOut &&
    (entryRequested || Boolean(user));
  if (!entryArmed) entryLocationSessionRef.current = false;
  else if (rideStatus === "idle") entryLocationSessionRef.current = true;
  const entryLocationEnabled = entryLocationSessionRef.current;
  const entryLocation = useEntryLocation(entryLocationEnabled);
  const entryLocationPrompt =
    entryLocation.phase === "checking" ||
    entryLocation.phase === "choice" ||
    entryLocation.phase === "locating";
  const bootFlyHold = showAppIntro || !authInitialized || entryLocation.phase !== "ready";
  useEffect(() => {
    if (!user?.isAnonymous) return;
    return startGuestActivityWatch(() => postGuestActivity(user));
  }, [user]);
  const startIntroGuest = () => {
    setIntroDismissed(true);
    setEntryRequested(true);
    void beginAuthenticatedSession().catch(() => undefined);
  };
  const startIntroLogin = () => {
    setIntroDismissed(true);
    setEntryRequested(true);
    void handleGoogleSignIn().catch(() => undefined);
  };

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

  /**
   * 자동 생성(클릭 기반 · Ready Ride) 결과를 기존 Go 게이트에 얹는다 — 새 시작 경로를 만들지 않는다.
   * 두 생성 경로(방향 클릭 / Ready Ride)가 이 한 함수를 공유해 회귀 여지를 줄인다.
   */
  const applyGeneratedRouteResult = useCallback(
    (result: {
      start: LngLat;
      end: LngLat;
      profile: RouteProfile;
      distanceMeters: number;
      durationSec: number;
      geometry: LineStringGeometry;
      summary: string;
    }) => {
      setRouteWaypoints([]);
      setStartLngLat(result.start);
      setEndLngLat(result.end);
      setProfile(result.profile);
      setRouteGeometry(result.geometry);
      setRouteDistanceMeters(result.distanceMeters);
      setRouteDurationSec(result.durationSec);
      setRouteSummary(result.summary);
      resetRide();
      setActiveOfficialCourseId(null);
      setPlaceSearchMarkerLngLat(null);
    },
    [
      setRouteWaypoints,
      setStartLngLat,
      setEndLngLat,
      setProfile,
      setRouteGeometry,
      setRouteDistanceMeters,
      setRouteDurationSec,
      setRouteSummary,
      resetRide,
      setActiveOfficialCourseId,
      setPlaceSearchMarkerLngLat,
    ],
  );

  const distanceAutoRoute = useDistanceAutoRoute({
    user,
    functionsRegion: FUNCTIONS_REGION,
    rideLocked: routeMenuLockedForProd,
    routeTokenInsufficient,
    onClearRouteArtifacts: () => clearRouteArtifactsRef.current(),
    onApplyRoute: applyGeneratedRouteResult,
  });

  const {
    clearCirclePreview,
    dismissResult,
    previewCircleAt,
    circleFitToken,
    circleGeometry,
    offeredState: autoRouteOfferedState,
    mapPickMode,
    armDirectionPick,
    getLastSessionPrefs,
    handleMapPick,
    retryDirection,
    isSearching,
    setProfile: setAutoRouteProfile,
    disarm,
    setDistanceDirectionMode,
  } = distanceAutoRoute;

  /** 지시93 — 주행 중(주행·일시정지)에는 경로를 지우지 않고 안내 창만 띄운다(PROD/DEV 무관). */
  const [routeClearBlockedOpen, setRouteClearBlockedOpen] = useState(false);
  const routeClearBlockedByRide = isRouteClearBlockedByRide(rideStatus);
  useEffect(() => {
    if (!routeClearBlockedByRide) setRouteClearBlockedOpen(false);
  }, [routeClearBlockedByRide]);

  const handleClearPins = useCallback(() => {
    if (routeClearBlockedByRide) {
      setRouteClearBlockedOpen(true);
      return;
    }
    anchorFixedStartRef.current = null;
    clearRoutePins(routeMenuLockedForProd);
    clearCirclePreview();
    dismissResult();
  }, [routeClearBlockedByRide, clearRoutePins, routeMenuLockedForProd, clearCirclePreview, dismissResult]);

  const handleSetRouteProfileOnly = useCallback(
    (p: RouteProfile) => {
      if (routeMenuLockedForProd) return;
      // Selecting a draft must not relabel a route that has not been regenerated.
      if (!routeGeometry) setProfile(p);
      setAutoRouteProfile(p);
    },
    [routeMenuLockedForProd, routeGeometry, setProfile, setAutoRouteProfile],
  );

  const handleMapRouteProfile = useCallback(
    (p: RouteProfile) => {
      // 토큰 부족(잔액<1)이면 RouteDock·지도 핀 팝업 어느 쪽에서도 생성을 막는다(정책 통일).
      if (routeTokenInsufficient) return;
      applyRouteProfileForMapLocked(routeMenuLockedForProd, p);
    },
    [applyRouteProfileForMapLocked, routeMenuLockedForProd, routeTokenInsufficient],
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
      if (routeClearBlockedByRide) {
        setRouteClearBlockedOpen(true);
        return;
      }
      if (routeMenuLockedForProd) return;
      if (id === "start") {
        anchorFixedStartRef.current = null;
        setStartLngLat(null);
      } else if (id === "end") setEndLngLat(null);
      else {
        const idx = Number(id.replace("wp-", ""));
        if (Number.isFinite(idx)) {
          setRouteWaypoints((prev) => prev.filter((_, i) => i !== idx));
        }
      }
    },
    [routeClearBlockedByRide, routeMenuLockedForProd, setStartLngLat, setEndLngLat, setRouteWaypoints],
  );

  /** 출발↔도착 바꾸기(10-23 Chief) — 경유지 순서도 뒤집는다. 경로가 있었으면 바뀐 위치로 같은 수단을 다시 만든다 */
  const swapRegenerateProfileRef = useRef<RouteProfile | null>(null);
  const handleSwapRouteEndpoints = useCallback(() => {
    if (routeMenuLockedForProd || !startLngLat || !endLngLat) return;
    anchorFixedStartRef.current = null;
    swapRegenerateProfileRef.current = routeGeometry ? profile : null;
    setStartLngLat(endLngLat);
    setEndLngLat(startLngLat);
    setRouteWaypoints((prev) => [...prev].reverse());
  }, [routeMenuLockedForProd, startLngLat, endLngLat, routeGeometry, profile, setStartLngLat, setEndLngLat, setRouteWaypoints]);
  // 경로 생성은 현재 상태를 읽으므로, 바뀐 위치가 반영된 다음 렌더에서 부른다
  useEffect(() => {
    const p = swapRegenerateProfileRef.current;
    if (!p) return;
    swapRegenerateProfileRef.current = null;
    applyRouteProfileForMapLocked(routeMenuLockedForProd, p);
  }, [startLngLat, endLngLat, routeWaypoints, applyRouteProfileForMapLocked, routeMenuLockedForProd]);

  const handleFocusRouteDockStop = useCallback(
    (stop: RouteDockStop) => {
      setFollowMode("free");
      setActiveQuickCamera(null);
      setLockBaseHeading(null);
      cameraJumpSeqRef.current += 1;
      setExternalCameraJump({
        lngLat: stop.lngLat,
        zoom: Math.max(mapZoom, 15),
        requestId: cameraJumpSeqRef.current,
      });
    },
    [mapZoom, setActiveQuickCamera, setFollowMode, setLockBaseHeading],
  );

  /**
   * ===== 다음 주행·이어 달리기(RIDE-CONTINUE-1) =====
   * 후보는 mutable pointer 문서가 아니라 최근 Ride + SavedRoute 에서 **파생**한다 —
   * Route 가 삭제·완주되면 카드도 자동으로 무효화된다(§4.3).
   */
  // 슬롯 ready 가드는 상단 resumeSlotActiveRouteId 정의 참고
  const nextRideView = useMemo(
    () =>
      resolveNextRideView({
        rides: recentSessions,
        savedRoutes,
        activeRouteId: resumeSlotActiveRouteId,
      }),
    [recentSessions, savedRoutes, resumeSlotActiveRouteId],
  );

  // 슬롯 등록 실패·bootstrap 실패 등 짧은 UI 안내(성공처럼 포기/확보 보고하지 않음)
  useEffect(() => {
    if (!rideResumeSlot.errorMessage) return;
    setRouteSummary(rideResumeSlot.errorMessage);
  }, [rideResumeSlot.errorMessage, setRouteSummary]);

  /**
   * idle 후속 카드(다음 주행·첫 주행 표면) 공통 게이트 — `entryLocation.phase === "ready"` 일 때만 평가한다.
   * idle/checking/choice/locating 은 모두 차단(인증 직후 idle 한 프레임 포함). Chief 지시80·81.
   */
  const idleFollowUpCardsEligible = Boolean(
    user &&
      stage === "idle" &&
      !savedRoutesLoading &&
      // 첫 로드 전 빈 목록으로 후보를 잘못 해석하지 않는다(§3.1 「로딩이 끝났다」)
      (!configured || savedRoutesLoaded) &&
      entryLocation.phase === "ready" &&
      !menuOpen &&
      !placeSearchOpen &&
      !mapViewSheetOpen &&
      !userInfoSheetOpen &&
      !rideSettingsSheetOpen &&
      !cadenceSensorSheetOpen &&
      !publicRouteRequestModalRoute &&
      !needsGuestEntry,
  );

  /**
   * 카드 노출 조건(§3.1) — Route 가 없는 idle 화면에서만, gate·summary·sheet/modal 이
   * 주 화면을 점유하지 않을 때. 사용자가 다른 Route 를 명시적으로 불러오면 stage 가 바뀌어 사라진다.
   */
  const nextRideCardVisible = Boolean(
    idleFollowUpCardsEligible &&
      nextRideView &&
      nextRideDismissedRideId !== nextRideView.target.rideId,
  );

  /**
   * 이전 주행이 없는 idle — 입문 코스 CTA 표시(RIDE-NEXT-VISIT-2 §3, V3).
   * NextRideCard 와 같은 가드를 쓰되, `nextRideView` 가 null 일 때만 등장한다.
   */
  const firstRideIntroVisible = Boolean(idleFollowUpCardsEligible && !nextRideView);

  /**
   * 재개 준비 상태의 지도 표현(§3.4) — 완료 구간은 마젠타(내 도로망과 같은 색),
   * 남은 구간은 현행 빨강, 경계에 「N% · 여기서 계속」 마커 하나.
   * 주행 중 진행 칠하기와 **같은 파이프라인**(conquestLiveTraveledMeters)을 재사용한다.
   */
  const resumePreview = useMemo(() => {
    if (rideStatus !== "idle" || resumeRatio == null || !routeGeometry) return null;
    // Codex -04 Fix: F2 adapter (NO scaling - routeDistanceMeters offset = geometry offset in meters)
    const meters = resumeOffsetMetersFrom(resumeRatio, routeDistanceMeters);
    if (!(meters > 0)) return null;
    const lngLat = getPointOnRouteByDistance(routeGeometry, meters);
    if (!lngLat) return null;
    return {
      meters,
      lngLat,
      label: `${Math.round(resumeRatio * 100)}% · 여기서 계속`,
    };
  }, [rideStatus, resumeRatio, routeGeometry, routeDistanceMeters]);

  /** 지도 카메라를 한 지점으로 이동(마커 표시 포함) */
  const focusAnchorOnMap = useCallback(
    (lngLat: LngLat) => {
      setFollowMode("free");
      setActiveQuickCamera(null);
      setLockBaseHeading(null);
      cameraJumpSeqRef.current += 1;
      setExternalCameraJump({
        lngLat,
        zoom: Math.max(mapZoom, 14),
        requestId: cameraJumpSeqRef.current,
      });
      setPlaceSearchMarkerLngLat(lngLat);
    },
    [mapZoom, setActiveQuickCamera, setFollowMode, setLockBaseHeading],
  );

  /**
   * 「이어 달리기」(§3.2) — Route 를 불러와 `ready-to-start` 까지만 만든다.
   * 실제 시작은 기존 Go·주행 입력 준비 게이트를 그대로 통과한다(카드가 Go 를 우회하지 않는다).
   * 후보 해석 뒤 Route 가 삭제·완주됐으면 stale 상태를 시작하지 않고 CTA 만 거둔다.
   * 다른 경로가 슬롯을 점유 중이면 switchTo(abandon→acquire)로 대상을 교체한다.
   */
  const handleResumeSavedRouteById = useCallback(
    (routeId: string, dismissRideId?: string) => {
      const route = savedRoutes.find((r) => r.id === routeId);
      if (!route || route.completed === 1) {
        if (dismissRideId) setNextRideDismissedRideId(dismissRideId);
        return;
      }
      const priorActive = rideResumeSlot.activeRouteId;
      const decision = resolveResumeSlotSwitchAction(priorActive, routeId);
      void (async () => {
        const op = await rideResumeSlot.switchTo(routeId);
        if (!op.ok) {
          setRouteSummary("이어달리기 대상 변경에 실패했어요. 다시 시도해 주세요.");
          return;
        }
        setSummarySheetVisible(false);
        setLastRideResult(null);
        setUserInfoSheetOpen(false);
        handleLoadSavedRoute(route);
        if (decision === "acquire" || decision === "switch") {
          const pct = Math.round(
            Math.max(0, Math.min(1, route.lastProgressRatio)) * 100,
          );
          setRouteSummary(`이어달리기 대상을 이 경로로 바꿨어요 — ${pct}%부터`);
        }
      })();
    },
    [savedRoutes, handleLoadSavedRoute, setUserInfoSheetOpen, rideResumeSlot, setRouteSummary],
  );

  /**
   * 내 경로 「이어 달리기」 — switchTo 후 로드.
   * 대기·완주 「열기」는 handleLoadSavedRoute 만(슬롯 불변).
   */
  const handleResumeSavedRouteFromLibrary = useCallback(
    (route: SavedRoute) => {
      handleResumeSavedRouteById(route.id);
    },
    [handleResumeSavedRouteById],
  );

  /** ad-hoc 미완주 저장 성공 시 — 슬롯이 비어 있을 때만 확보(교체는 사용자가 고를 때만) */
  const handleSaveAdhocAsUserRouteWithSlot = useCallback(
    async (name: string, confirmUpdate?: boolean) => {
      const applied = await handleSaveAdhocAsUserRoute(name, confirmUpdate);
      if (applied.completed === 1) return applied;
      if (resolveAdhocSaveSlotAcquireAction(rideResumeSlot.activeRouteId) !== "acquire") {
        return applied;
      }
      const op = await rideResumeSlot.ensureAcquired(applied.id);
      if (!op.ok) {
        setRouteSummary("내 경로에 저장했지만 이어달리기 대상 확보에 실패했어요.");
      }
      return applied;
    },
    [handleSaveAdhocAsUserRoute, rideResumeSlot, setRouteSummary],
  );

  const handleResumeNextRide = useCallback(
    (target: Extract<NextRideTarget, { kind: "resume_route" }>) => {
      handleResumeSavedRouteById(target.routeId, target.rideId);
    },
    [handleResumeSavedRouteById],
  );

  /**
   * 「여기에서 계속」(R1 §4) — 마지막 Ride 종료점을 Start(S)로 고정하고
   * 거리·방향 자동 Route 팝업을 1급 진입으로 연다. SavedRoute geometry 는 건드리지 않는다.
   */
  /**
   * 이어 달리기 승계의 1순위 근거. `lastRideResult` 는 진입 즉시 `setLastRideResult(null)`
   * 로 지워지므로(시트를 닫아야 하니까), 지워지기 전 값을 ref 에 붙들어 둔다.
   * 폐기된 주행(≤100m)은 `lastRideResult` 가 만들어지지 않아 여기에도 남지 않는다 —
   * 그때는 계약 함수가 다음 순위로 내려간다.
   */
  // 사용자 전환 시 낡은 result·다른 UID 이벤트로 슬롯이 돌지 않게 초기화
  const slotOwnerUidGateRef = useRef<string | null>(null);
  const processedSlotRecordIdsRef = useRef<Set<string>>(new Set());
  const rideResumeSlotRef = useRef(rideResumeSlot);
  rideResumeSlotRef.current = rideResumeSlot;
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (slotOwnerUidGateRef.current != null && slotOwnerUidGateRef.current !== uid) {
      setLastRideResult(null);
      processedSlotRecordIdsRef.current.clear();
      pendingProgressAppliedRef.current = filterProgressAppliedEventsForUid(
        pendingProgressAppliedRef.current,
        uid,
      );
    }
    slotOwnerUidGateRef.current = uid;
  }, [user?.uid]);

  // 매 유효 주행 후 「다음 주행」 카드 dismiss 리셋(슬롯 op 와 무관)
  useEffect(() => {
    if (lastRideResult) setNextRideDismissedRideId(null);
  }, [lastRideResult]);

  // progress 실제 저장 성공 이벤트 → 슬롯 확보/해제 (UI result null 과 무관)
  useEffect(() => {
    const uid = user?.uid ?? null;
    pendingProgressAppliedRef.current = filterProgressAppliedEventsForUid(
      pendingProgressAppliedRef.current,
      uid,
    );

    const slotApi = rideResumeSlotRef.current;
    let event = peekNextProgressAppliedEvent(
      pendingProgressAppliedRef.current,
      processedSlotRecordIdsRef.current,
    );
    let action: ReturnType<typeof resolveRideEndSlotAction> = "wait";
    while (event) {
      action = resolveRideEndSlotAction({
        savedRouteId: event.routeId,
        routeCompleted: event.routeCompleted,
        savedRouteProgressStatus: "success",
        slotStatus: slotApi.status,
        slotInitialized: slotApi.slot.initialized,
        slotOwnerUid: slotApi.slotOwnerUid,
        currentUid: uid,
        recordId: event.recordId,
        alreadyProcessed: processedSlotRecordIdsRef.current.has(event.recordId),
      });
      if (action === "skip") {
        processedSlotRecordIdsRef.current.add(event.recordId);
        event = peekNextProgressAppliedEvent(
          pendingProgressAppliedRef.current,
          processedSlotRecordIdsRef.current,
        );
        continue;
      }
      break;
    }
    if (!event || action === "wait" || action === "skip") return;

    const routeId = event.routeId;
    const eventUid = event.userId;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    const retryTimers: number[] = [];

    const markProcessed = () => {
      processedSlotRecordIdsRef.current.add(event!.recordId);
    };

    const run = () => {
      if (cancelled || slotOwnerUidGateRef.current !== eventUid) return;
      if (processedSlotRecordIdsRef.current.has(event!.recordId)) return;
      const api = rideResumeSlotRef.current;

      if (action === "clear") {
        void api.clearIfActive(routeId).then((op) => {
          if (cancelled || slotOwnerUidGateRef.current !== eventUid) return;
          if (shouldMarkSlotOpProcessed(op)) {
            markProcessed();
            setProgressAppliedSeq((n) => n + 1);
            return;
          }
          attempts += 1;
          if (attempts < MAX_ATTEMPTS) {
            retryTimers.push(window.setTimeout(run, 400));
          }
        });
        return;
      }

      void api.ensureAcquired(routeId).then((op) => {
        if (cancelled || slotOwnerUidGateRef.current !== eventUid) return;
        if (shouldMarkSlotOpProcessed(op)) {
          markProcessed();
          setProgressAppliedSeq((n) => n + 1);
          return;
        }
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          retryTimers.push(window.setTimeout(run, 400));
        }
      });
    };

    run();
    return () => {
      cancelled = true;
      for (const t of retryTimers) window.clearTimeout(t);
    };
  }, [
    progressAppliedSeq,
    user?.uid,
    rideResumeSlot.status,
    rideResumeSlot.slot.initialized,
    rideResumeSlot.slotOwnerUid,
  ]);

  const continuationLastRideRef = useRef<{
    profile: RouteProfile;
    routeDistanceMeters: number;
  } | null>(null);
  useEffect(() => {
    if (lastRideResult) {
      continuationLastRideRef.current = {
        profile: lastRideResult.profile,
        routeDistanceMeters: lastRideResult.routeDistanceMeters,
      };
    }
  }, [lastRideResult]);

  const handleStartRouteFromAnchor = useCallback(
    (anchorLngLat: LngLat) => {
      if (routeMenuLockedForProd) return;
      setSummarySheetVisible(false);
      resetArrivalToast();
      setLastRideResult(null);
      setUserInfoSheetOpen(false);
      dismissResult();
      clearCirclePreview();
      clearRoutePins(routeMenuLockedForProd);
      setBasicActiveHubCourseId(null);
      setPlaceSearchMarkerLngLat(null);

      /**
       * 이어 달리기 진입 계약 — 두 진입점(결과 시트 「지금 새 경로 연결」·「다음 주행」
       * 카드 「여기에서 계속」)이 **같은 순수 함수**로 초기 상태를 정한다.
       * 승계 근거는 직전 Ride → 세션 선호 → 현재 화면 순이다. 세션 선호만 보면
       * 그 ref 의 초기값(`driving`·10 km)이 그대로 승계된다(결함 ④).
       */
      const continuation = resolveRideContinuationSetup({
        anchorLngLat,
        lastRide: continuationLastRideRef.current,
        sessionPrefs: getLastSessionPrefs(),
        currentProfile: profile,
        currentRouteDistanceMeters: routeDistanceMeters,
      });

      setStartLngLat(continuation.startLngLat);
      // End 는 clearRoutePins 가 이미 비웠다 — 계약이 비움을 요구한다는 사실을 여기서 못박는다.
      setEndLngLat(continuation.endLngLat);
      setProfile(continuation.profile);

      const result = armDirectionPick({
        start: continuation.startLngLat,
        profile: continuation.profile,
        targetKm: continuation.targetKm,
      });

      if (result.ok) {
        anchorFixedStartRef.current = anchorLngLat;
        routePickOpenSeqRef.current += 1;
        setRoutePickOpenRequest({
          lngLat: anchorLngLat,
          requestId: routePickOpenSeqRef.current,
        });
        setRouteSummary(
          "마지막 종료 지점에서 거리·방향 자동 Route — 지도에서 방향을 클릭하세요.",
        );
        focusAnchorOnMap(anchorLngLat);
        return;
      }

      anchorFixedStartRef.current = null;
      setRouteSummary(result.message);
      focusAnchorOnMap(anchorLngLat);
    },
    [
      routeMenuLockedForProd,
      resetArrivalToast,
      dismissResult,
      clearCirclePreview,
      clearRoutePins,
      setBasicActiveHubCourseId,
      getLastSessionPrefs,
      profile,
      routeDistanceMeters,
      setStartLngLat,
      setEndLngLat,
      setProfile,
      armDirectionPick,
      setRouteSummary,
      focusAnchorOnMap,
      setUserInfoSheetOpen,
    ],
  );

  const nextRideCard =
    nextRideCardVisible && nextRideView ? (
      <NextRideCard
        view={nextRideView}
        onResume={handleResumeNextRide}
        onExtend={handleStartRouteFromAnchor}
        onShowOnMap={focusAnchorOnMap}
        onDismiss={() => setNextRideDismissedRideId(nextRideView.target.rideId)}
      />
    ) : null;

  const applyLocalFirstRegion = useCallback(
    (region: LocalFirstRegion, opts?: { jumpCamera?: boolean }) => {
      setLocalFirstRegion(region);
      writeLocalFirstRegion(region);
      if (opts?.jumpCamera === false) return;
      localFirstFramedAtRef.current = region.at;
      setFollowMode("free");
      setActiveQuickCamera(null);
      setLockBaseHeading(null);
      cameraJumpSeqRef.current += 1;
      setExternalCameraJump({
        lngLat: region.lngLat,
        zoom: region.zoom,
        requestId: cameraJumpSeqRef.current,
      });
    },
    [setActiveQuickCamera, setFollowMode, setLockBaseHeading],
  );

  const handleMenuReveal = useCallback(
    (progress: number | null) => {
      setMenuReveal(progress);
      if (progress == null) return;
      setMapViewSheetOpen(false);
      setMapViewReveal(null);
      setPlaceSearchOpen(false);
      setUserInfoSheetOpen(false);
      setRideSettingsSheetOpen(false);
      setCadenceSensorSheetOpen(false);
    },
    [
      setMapViewSheetOpen,
      setPlaceSearchOpen,
      setUserInfoSheetOpen,
      setRideSettingsSheetOpen,
      setCadenceSensorSheetOpen,
    ],
  );

  const handleMapViewReveal = useCallback(
    (progress: number | null) => {
      setMapViewReveal(progress);
      if (progress == null) return;
      setMenuOpen(false);
      setMenuReveal(null);
      setPlaceSearchOpen(false);
      setUserInfoSheetOpen(false);
      setRideSettingsSheetOpen(false);
      setCadenceSensorSheetOpen(false);
    },
    [
      setMenuOpen,
      setPlaceSearchOpen,
      setUserInfoSheetOpen,
      setRideSettingsSheetOpen,
      setCadenceSensorSheetOpen,
    ],
  );

  const openMapViewFromEdge = useCallback(() => {
    setMenuOpen(false);
    setMenuReveal(null);
    setPlaceSearchOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setCadenceSensorSheetOpen(false);
    setMapViewSheetOpen(true);
  }, [
    setMenuOpen,
    setPlaceSearchOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    setCadenceSensorSheetOpen,
    setMapViewSheetOpen,
  ]);

  /**
   * localStorage 복원 지역 — 첫 idle 진입 시 1회만 카메라 점프.
   * 사용자가 지도를 움직인 뒤 재점프하지 않는다(at 가드).
   */
  useEffect(() => {
    if (!firstRideIntroVisible || !localFirstRegion) return;
    if (localFirstFramedAtRef.current === localFirstRegion.at) return;
    localFirstFramedAtRef.current = localFirstRegion.at;
    setFollowMode("free");
    setActiveQuickCamera(null);
    setLockBaseHeading(null);
    cameraJumpSeqRef.current += 1;
    setExternalCameraJump({
      lngLat: localFirstRegion.lngLat,
      zoom: localFirstRegion.zoom,
      requestId: cameraJumpSeqRef.current,
    });
  }, [firstRideIntroVisible, localFirstRegion, setActiveQuickCamera, setFollowMode, setLockBaseHeading]);

  /**
   * Quick Camera 1~6 — 공통 Camera Controller(followMode + distance + fitBounds)만 사용.
   * 줌 비간섭은 지시03 범위 밖(STEP 6).
   */
  const handleQuickCameraSelect = useCallback(
    (n: 1 | 2 | 3 | 4 | 5 | 6, requestedFlatMode?: Camera1Mode) => {
      const leavingCamera1 = activeQuickCamera === 1 && n !== 1;
      const enteringCamera1 = n === 1 && activeQuickCamera !== 1;

      if (leavingCamera1) {
        setMapStyle(
          resolveCamera1ExitMapStyle({
            currentStyle: mapStyle,
            styleBeforeEnter: camera1StyleBeforeEnterRef.current,
            userToggledWhileInCamera1: camera1UserToggledStyleRef.current,
          }),
        );
        camera1StyleBeforeEnterRef.current = null;
        camera1UserToggledStyleRef.current = false;
      }

      setActiveQuickCamera(n);
      if (n === 1) {
        if (enteringCamera1) {
          const enter = resolveCamera1EnterMapStyle({
            currentStyle: mapStyle,
            satelliteStyle: MAP_STYLE_SATELLITE,
          });
          camera1StyleBeforeEnterRef.current = enter.styleBeforeEnter;
          camera1UserToggledStyleRef.current = false;
          setMapStyle(enter.nextStyle);
        }
        // 평면 카메라 메뉴는 높이를 직접 넘긴다. 인자 없는 옛 호출만 순환 호환.
        const next: Camera1Mode =
          requestedFlatMode ?? (activeQuickCamera === 1 ? nextCamera1Mode(camera1Mode) : "routeFit");
        setCamera1Mode(next);
        setLockBaseHeading(null);
        if (next === "routeFit") {
          if (routeGeometry?.coordinates?.length) {
            const b = boundsFromLineCoordinates(routeGeometry.coordinates as [number, number][]);
            cameraJumpSeqRef.current += 1;
            setExternalCameraJump({
              lngLat: liveForMap ?? startLngLat ?? routeGeometry.coordinates[0],
              requestId: cameraJumpSeqRef.current,
              bbox: [b.minLng, b.minLat, b.maxLng, b.maxLat],
            });
          }
          // Route Fit = 1회 fitBounds 만. topDown 팔로우면 억제 창 후 tick 이 프레이밍을 덮는다(지시05).
          setFollowMode("free");
          setRideCameraSpanFloorMode("preset");
        } else {
          // 평면 높이 preset — 거리는 camera1Mode.ts 의 단일 표(CAMERA1_AERIAL_DISTANCE_M).
          // 거리 상한 60m(RIDE_CAMERA_DISTANCE_MAX_M)은 맵 뷰 시트 슬라이더 전용 클램프라
          // 이 preset 경로는 거치지 않는다 — 500m 도 상한 변경 없이 그대로 적용된다.
          setFollowMode("aerial");
          setRideCameraDistanceM(CAMERA1_AERIAL_DISTANCE_M[next]);
          setRideCameraSpanFloorMode("preset");
        }
        return;
      }
      setLockBaseHeading(n === 6 ? 0 : null);
      // 지면 가까이 눕는 QC2~6 은 도로 판독이 우선 — 위성으로 남거나 바뀌지 않게 한다.
      setMapStyle(DEFAULT_MAP_STYLE);
      const modeByN: Record<2 | 3 | 4 | 5 | 6, FollowMode> = {
        2: "forward",
        3: "backward",
        4: "left",
        5: "right",
        6: "forward",
      };
      setFollowMode(modeByN[n]);
      // QC2·3 은 quickCameraProductTune 거리. 나머지 밀착은 pitch 80 floor → MIN≈6m.
      const tune = getQuickCameraProductTune(n);
      setRideCameraDistanceM(
        tune?.distanceM ?? Math.max(QUICK_CAMERA_FALLBACK_DISTANCE_M, RIDE_CAMERA_DISTANCE_MIN_M),
      );
      setRideCameraSpanFloorMode("preset");
    },
    [
      activeQuickCamera,
      camera1Mode,
      mapStyle,
      routeGeometry,
      liveForMap,
      startLngLat,
      setActiveQuickCamera,
      setCamera1Mode,
      setFollowMode,
      setLockBaseHeading,
      setMapStyle,
      setRideCameraDistanceM,
      setRideCameraSpanFloorMode,
      camera1StyleBeforeEnterRef,
      camera1UserToggledStyleRef,
    ],
  );

  const handleRideCameraDistanceFromUserZoom = useCallback((distanceM: number) => {
    setRideCameraDistanceM(distanceM);
    setRideCameraSpanFloorMode("userZoom");
  }, [setRideCameraDistanceM, setRideCameraSpanFloorMode]);

  const handleRideCameraDistancePreset = useCallback((distanceM: number) => {
    setRideCameraDistanceM(distanceM);
    setRideCameraSpanFloorMode("preset");
  }, [setRideCameraDistanceM, setRideCameraSpanFloorMode]);

  /**
   * Go 사전조건 = 경로 준비 **+ 주행 입력 준비**.
   * 준비 미완료 상태로 주행 화면에 들어간 뒤 센서를 설정시키지 않는다(§1.4).
   */
  const canStartRideWithInput = Boolean(routeGeometry) && !routeLoading && rideInputReady;
  const rideStartable = stage === "ready-to-start" && canStartRideWithInput && !routeMenuLockedForProd;
  /** 두 주행 버튼(경로 창·우측 하단)이 같은 순간 5회 펄싱하는 번호 — 새 경로마다 한 번(Chief 10-26) */
  const rideStartPulseKey = useRideStartPulseKey(routeSetupToken, rideStartable);

  /** HUD 칩용 최소 상태 — BLE 훅 객체 전체를 넘기지 않는다 */
  const cadenceHud = useMemo(
    () => ({
      state: {
        capable: bleCrankRpm.capable,
        uiState: bleCrankRpm.uiState,
        crankRpm: bleCrankRpm.crankRpm,
      },
      open: cadenceSensorSheetOpen,
      onOpen: openCadenceSensorPanel,
    }),
    [
      bleCrankRpm.capable,
      bleCrankRpm.uiState,
      bleCrankRpm.crankRpm,
      cadenceSensorSheetOpen,
      openCadenceSensorPanel,
    ],
  );

  const routeDockPanel = (
    <RouteDock
      stage={stage}
      stops={routeDockStops}
      routeLoading={routeLoading}
      onRemoveStop={handleRemoveRouteDockStop}
      onFocusStop={handleFocusRouteDockStop}
      onSwapEndpoints={handleSwapRouteEndpoints}
      editLocked={routeMenuLockedForProd}
      cadence={cadenceHud}
      sensorAttention={Boolean(routeGeometry) && !routeLoading && !rideInputReady}
    />
  );

  const rideControlPanel = (
    <RideControlBar
      stage={stage}
      routeLoading={routeLoading}
      routeSetupToken={routeSetupToken}
      startPulseKey={rideStartPulseKey}
      canStartRide={canStartRideWithInput}
      sensorAttention={Boolean(routeGeometry) && !routeLoading && !rideInputReady}
      onStartRide={handleStartRide}
      onPauseRide={handlePause}
      onResumeRide={handleResume}
      onEndRide={handleEndRideWithTrailCleanup}
      onModifyFromPause={handleModifyFromPause}
      resumeRatio={resumeRatio}
      onAbandonResume={resumeRatio != null ? rideResumeSlot.abandon : null}
      editLocked={routeMenuLockedForProd}
      cadence={cadenceHud}
      nextRideVisible={Boolean(nextRideCardVisible && nextRideView)}
    />
  );

  // ===== Map-first 핸들러 =====
  function handleMenuPlacePick(
    lngLat: LngLat,
    placeName: string,
    _bbox: [number, number, number, number] | null,
  ) {
    const intent = placeSearchIntentRef.current;
    placeSearchIntentRef.current = "menu";

    if (intent === "localFirst") {
      const name = localFirstRegionLabel(placeName) ?? (placeName.trim() || "선택한 지역");
      applyLocalFirstRegion(
        makeLocalFirstRegion({
          name,
          lngLat,
          source: "search",
        }),
      );
      setPlaceSearchMarkerLngLat(null);
      setPlaceSearchOpen(false);
      return;
    }

    /** `liveForMap` 추적 jumpTo 가 flyTo 를 덮어쓰지 않도록 */
    setFollowMode("free");
    setActiveQuickCamera(null);
    setLockBaseHeading(null);
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

  /**
   * 결과 시트를 닫고 **지도를 idle 로 되돌린다**(§3.1·§3.5).
   *
   * ⚠ 방금 달린 Route 를 지도에 남겨 두면 stage 가 `ready-to-start` 로 머물러
   * RouteDock 이 Go 를 다시 띄우고 「다음 주행」 카드는 숨는다 — 실주행에서 종료 직후
   * 카드가 안 보이던 원인이 이 stage 충돌이었다. 카드는 「Route 가 없는 idle 화면」의
   * 표면이므로, 결과를 닫는 순간 워크스페이스를 비워 카드가 즉시 나타나게 한다.
   * 같은 경로를 다시 타려면 카드의 「이어 달리기」가 다시 불러온다(처음부터는 RouteDock 보조 선택).
   */
  function closeSummaryAndReturnToIdleMap() {
    setSummarySheetVisible(false);
    resetArrivalToast();
    setLastEndedWasAdhoc(null);
    setLastRideResult(null);
    // 최근 주행의 신규 도로 강조는 결과 시트를 닫아도 유지한다.
    // 다음 주행 시작·로그아웃·사용자 전환 시 새 세션 경계에서 정리한다.
    clearRoutePins(routeMenuLockedForProd);
  }

  function handleCloseSummary() {
    closeSummaryAndReturnToIdleMap();
  }

  function handleModifyFromPause() {
    handleEndRide();
    openMenuPanel();
  }

  const {
    elapsedLabel,
    cumulativeDistanceMeters,
    suggestedRouteName,
    hudMetrics,
  } = computeAppHudValues({
    rideMetrics,
    sessionStartOffsetMeters,
    startPlaceLabel,
    endPlaceLabel,
    lastEndedWasAdhoc,
    routeDistanceMeters,
    rideStatus,
    routeGeometry,
    summaryVisible,
    avgSpeedLabel,
    routeElevationProfile: rideElevationProfile,
  });
  const accountInitial = (() => {
    if (!user) return null;
    if (user.isAnonymous) return "G";
    return selfRiderDisplayName(user).slice(0, 1).toUpperCase();
  })();
  const accountLabel = (() => {
    if (!user) return "";
    return selfRiderDisplayName(user);
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
  const snap = calorieSessionSnapshotRef.current;
  const liveElapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
  const caloriesEstimate =
    lastRideResult?.caloriesEstimate !== undefined
      ? lastRideResult.caloriesEstimate
      : estimateGrossKcal({
          weightKg: snap?.weightKg ?? null,
          met: snap?.met ?? null,
          activeSec: clampActiveSecForCalories(pedalActiveSecRef.current, liveElapsedSec),
        });

  const sessionRideKm = useMemo(
    () =>
      Math.max(0, rideMetrics.virtualDistanceMeters - sessionStartOffsetMeters) / 1000,
    [rideMetrics.virtualDistanceMeters, sessionStartOffsetMeters],
  );
  const glanceMyBaseKm =
    leaderboardGlance.atRideStart?.me.valueKm ?? leaderboardGlance.data?.me.valueKm ?? 0;
  const leaderboardGlanceView = useMemo(() => {
    if (!user) return null;
    const riding = rideStatus === "running" || rideStatus === "paused";
    const pedalQualifiedLive = pedalActiveSecRef.current != null;
    const liveRows = buildGlanceLiveRows(
      leaderboardGlance.atRideStart ?? leaderboardGlance.data,
    );
    return {
      mode: riding ? ("riding" as const) : ("map" as const),
      isGuest: Boolean(user.isAnonymous),
      panelOpen: leaderboardGlance.panelOpen,
      onTogglePanel: leaderboardGlance.togglePanel,
      onOpenFullLeaderboard: openLeaderboardPanel,
      onRegister: user.isAnonymous ? () => void handleGoogleSignIn() : undefined,
      mapData: leaderboardGlance.data,
      rideSnapshot: leaderboardGlance.atRideStart,
      liveRows,
      myBaseKm: glanceMyBaseKm,
      addedKm: riding && pedalQualifiedLive ? sessionRideKm : 0,
      pedalQualified: riding ? pedalQualifiedLive : true,
    };
  }, [
    user,
    rideStatus,
    leaderboardGlance.data,
    leaderboardGlance.atRideStart,
    leaderboardGlance.panelOpen,
    leaderboardGlance.togglePanel,
    glanceMyBaseKm,
    sessionRideKm,
    openLeaderboardPanel,
    handleGoogleSignIn,
  ]);
  const mapHudLeaderboard = useMemo(() => {
    if (!leaderboardGlanceView) return {};
    return {
      leaderboardGlanceChip: <LeaderboardGlanceChip {...leaderboardGlanceView} />,
      leaderboardGlancePanel: <LeaderboardGlancePanel {...leaderboardGlanceView} />,
    };
  }, [leaderboardGlanceView]);
  const summaryRankChange = useMemo(() => {
    if (!summaryVisible || !lastRideResult || !user) return null;
    const snap = leaderboardGlance.atRideStart;
    if (!snap) return null;
    const rows = buildGlanceLiveRows(snap);
    const sessionKm = lastRideResult.sessionDistanceMeters / 1000;
    return computeRideRankChangeLine(
      rows,
      snap.me.valueKm,
      sessionKm,
      sessionPedalQualifiedRef.current,
      Boolean(user.isAnonymous),
      snap.me.status === "ranked" ? snap.me.rank : null,
      snap.me.status === "guest" ? snap.me.projectedRank : null,
    );
  }, [summaryVisible, lastRideResult, user, leaderboardGlance.atRideStart]);

  const mapHudRidePresence = useMemo(() => {
    if (!configured || !user) return null;
    const courseTitle = sharedPresenceCourseId
      ? (sharedPresenceCourseTitle?.trim() || "퍼블릭 경로")
      : null;
    const trailMembers = trailSession.rows.map((r) => ({
      key: r.uid,
      display: presenceRiderDisplayName(r.uid, r.memberType, r.displayName),
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

  const edgePanelHandlesVisible = Boolean(
    authInitialized &&
      user &&
      !summarySheetVisible &&
      !showAppIntro &&
      !entryLocationPrompt &&
      !needsGuestEntry &&
      !needsAuthCard &&
      !needsNicknameCard &&
      !menuOpen &&
      !mapViewSheetOpen &&
      !placeSearchOpen &&
      !userInfoSheetOpen &&
      !rideSettingsSheetOpen &&
      !cadenceSensorSheetOpen &&
      !publicRouteRequestModalRoute &&
      !profileEditOpen,
  );

  return (
    <div className={`app-shell app-shell--map-first${showAppIntro ? " app-shell--intro" : ""}${!authInitialized || !user ? " app-shell--pre-auth" : ""}`}>
      <RotateOverlay />
      <DevLabPanels
        mapZoom={mapZoom}
        activeQuickCamera={activeQuickCamera}
        camera1Mode={camera1Mode}
        onDistanceM={handleRideCameraDistancePreset}
      />

      <div className="app-map-stage">
        {debugMapIsolationActive ? (
          <Suspense fallback={null}>
            <DebugMapStage
              accessToken={MAPBOX_TOKEN || undefined}
              mapStyle={mapStyle}
              mapZoom={mapZoom}
              onMapZoom={setMapZoom}
              onMapViewport={onMapViewport}
              mapHud={{
                visible: authInitialized && Boolean(user),
                stage,
                onOpenMenu: openMenuPanel,
                menuOpen,
                account: accountChip,
                onOpenUserInfo: openUserInfoPanel,
                userInfoOpen: userInfoSheetOpen,
                authGateVisualDismissed: needsAuthCard,
                onOpenMapView: openMapViewPanel,
                mapViewOpen: mapViewSheetOpen,
                coachData,
                coachLineEnabled: rideCoachingBannerVisible,
                metrics: hudMetrics,
                cadenceRpm:
                  rideStatus === "running" && bleCrankRpm.crankRpm != null
                    ? bleCrankRpm.crankRpm
                    : null,
                onClearPins: handleClearPins,
                routeError: null,
                onResumeFromPause: handleResume,
                onEndFromPause: handleEndRideWithTrailCleanup,
                onModifyFromPause: handleModifyFromPause,
                ridePresence: mapHudRidePresence,
                onGoTrailhead: goTrailheadAndCloseMenu,
                conquestLiveMeters,
                conquestAllOwnedHint,
                ...mapHudLeaderboard,
              }}
            >
            </DebugMapStage>
          </Suspense>
        ) : (
          <AppMapStage
            routeDock={
              <>
                <MapBottomLeftStack>
                  {routeDockPanel}
                  <RouteMinimap
                    active={stage === "riding" || stage === "paused"}
                    routeGeometry={routeGeometry}
                    liveLngLat={liveForMap}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    traveledMeters={cumulativeDistanceMeters}
                    routeMeters={routeDistanceMeters}
                  />
                </MapBottomLeftStack>
                {/*
                  「다음 주행」 카드는 좌하단 스택 밖 — **우하단**에 홀로 선다(2026-09-17 Chief).
                  스택은 하단 기준이라 카드가 들고 날 때마다 RouteDock 이 위아래로 밀렸다.
                  창이 흔들리면 안 된다. 카드는 `stage === "idle"` 에서만 뜨고 주행 컨트롤
                  (`.map-hud__br`)은 주행 중에만 뜨므로 우하단에서 부딪힐 상대가 없다.
                */}
                {nextRideCard}
                {rideControlPanel}
              </>
            }
            mapView={{
              onStartRide: () => handleStartRide(),
              canStartRide: rideStartable,
              rideStartPulseKey,
              accessToken: MAPBOX_TOKEN || undefined,
              routeElevationProfile: rideElevationProfile,
              routeGeometry,
              routeDistanceMeters,
              startLngLat,
              endLngLat,
              routeWaypoints,
              liveLngLat: liveForMap,
              sampleLiveLngLat: rideStatus === "idle" ? undefined : sampleLiveLngLat,
              sampleLiveDistM: rideStatus === "idle" ? undefined : sampleLiveDistM,
              pacerEnabled,
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
              initialCenter: MAP_FALLBACK_CENTER,
              initialZoom: MAP_FALLBACK_ZOOM,
              bootFlyTarget: entryLocation.target,
              bootFlyHold,
              followMode,
              enable3D,
              onMapZoom: setMapZoom,
              mapZoomStepRequest,
              onMapViewport,
              onMapLodViewport,
              coverageOverlayMode,
              routeProfile: profile,
              onRouteProfile: handleMapRouteProfile,
              routeTokenInsufficient,
              conquestTraces: conquestTraceGeometries,
              conquestDisplayMode,
              conquestLiveTraveledMeters:
                rideStatus === "running" || rideStatus === "paused"
                  ? rideMetrics.virtualDistanceMeters
                  : (resumePreview?.meters ?? null),
              conquestRecentNewRoad: recentNewRoadGeometry,
              resumeAnchor: resumePreview
                ? { lngLat: resumePreview.lngLat, label: resumePreview.label }
                : null,
              rideActive: rideStatus === "running" || rideStatus === "paused",
              rideCameraDistanceM,
              lockBaseHeading,
              activeQuickCamera,
              rideCameraSpanFloorMode,
              onRideCameraDistanceFromUserZoom: handleRideCameraDistanceFromUserZoom,
              onClearRoute: handleClearPins,
              canClearRouteNow: () => !routeClearBlockedByRide,
              onSelectPoint: (type, lngLat, waypointSlot) => {
                if (!user || routeMenuLockedForProd) return;
                setActiveOfficialCourseId(null);
                setPlaceSearchMarkerLngLat(null);
                if (type === "start") {
                  const fixed = anchorFixedStartRef.current;
                  if (fixed) {
                    const moved =
                      Math.abs(fixed[0] - lngLat[0]) > 1e-6 ||
                      Math.abs(fixed[1] - lngLat[1]) > 1e-6;
                    if (moved) {
                      anchorFixedStartRef.current = null;
                      setDistanceDirectionMode(false);
                    }
                  }
                  setStartLngLat(lngLat);
                } else if (type === "end") {
                  disarm();
                  setEndLngLat(lngLat);
                }
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
              openRoutePickRequest: routePickOpenRequest,
              placeSearchMarkerLngLat,
              trailSpectatorDots: spectatorDots,
              trailSpectatorRoutes: spectatorRouteGeometries,
              globalPresenceDots: debugGlobalPresenceOnMap ? globalPresenceDots : null,
              activityWorldRaw,
              getActivityWorldPinLabel,
              rideFollowCameraNonce,
              distanceTargetCircle: circleGeometry,
                  userMileageTotalMeters: userTier.mileageTotalMeters,
              userMileageTotalSec: userTier.mileageTotalSec,
              distanceTargetCircleFitToken: circleFitToken,
              autoRouteOfferedState,
              autoRouteMapPick: mapPickMode,
              // 경로창은 지도(자식) 효과에서 만들어져 App 효과가 갱신하는 bridge 보다 먼저 읽는다.
              // 세션 값을 직접 넘기지 않으면 「여기에서 계속」 직후 거리가 미확정으로 잡혀 탭이 무시된다(10-23).
              autoRouteSessionActive: distanceAutoRoute.sessionActive,
              autoRouteTargetKm: distanceAutoRoute.targetKm,
              autoRouteStatusMessage: distanceAutoRoute.statusMessage,
              onPreviewDistanceAutoRouteCircle: previewCircleAt,
              onClearDistanceAutoRouteCircle: clearCirclePreview,
              onSetRouteProfileOnly: handleSetRouteProfileOnly,
              onArmDirectionPick: (input) => {
                const result = armDirectionPick(input);
                if (result.ok) {
                  // Preparing a direction is not a generated route or a publication change.
                  if (!routeGeometry) {
                    setStartLngLat(input.start);
                    setProfile(input.profile);
                  }
                  setPlaceSearchMarkerLngLat(null);
                }
                return result;
              },
              onAutoRouteMapPick: handleMapPick,
              onRetryDistanceAutoRoute: retryDirection,
              onDismissDistanceAutoRoute: dismissResult,
            }}
            lodDebug={lodDebugPanelProps}
            mapHud={{
              visible: authInitialized && Boolean(user),
              stage,
              onOpenMenu: openMenuPanel,
              menuOpen,
              account: accountChip,
              onOpenUserInfo: openUserInfoPanel,
              userInfoOpen: userInfoSheetOpen,
              authGateVisualDismissed: needsAuthCard,
              onOpenMapView: openMapViewPanel,
              mapViewOpen: mapViewSheetOpen,
              coachData,
              coachLineEnabled: rideCoachingBannerVisible,
              metrics: hudMetrics,
              cadenceRpm:
                rideStatus === "running" && bleCrankRpm.crankRpm != null
                  ? bleCrankRpm.crankRpm
                  : null,
              onClearPins: handleClearPins,
              routeError: null,
              onResumeFromPause: handleResume,
              onEndFromPause: handleEndRideWithTrailCleanup,
              onModifyFromPause: handleModifyFromPause,
              ridePresence: mapHudRidePresence,
              onGoTrailhead: goTrailheadAndCloseMenu,
              conquestLiveMeters,
              conquestAllOwnedHint,
              ...mapHudLeaderboard,
              quickCamera:
                rideStatus === "running" || rideStatus === "paused"
                  ? {
                      active: activeQuickCamera,
                      onSelect: handleQuickCameraSelect,
                      onSelectFlat: (mode) => handleQuickCameraSelect(1, mode),
                      camera1Mode,
                    }
                  : null,
              mapControls: {
                styleLabel: mapStyleHudShortLabel(mapStyle),
                styleAriaLabel: isQuickCameraOutdoorsOnly(activeQuickCamera)
                  ? "맵 스타일 야외, 카메라 2~6에서는 야외 고정"
                  : `맵 스타일 ${mapStyleHudShortLabel(mapStyle)}, 클릭 시 ${mapStyleHudShortLabel(nextOutdoorsSatelliteMapStyle(mapStyle))}`,
                styleToggleDisabled: isQuickCameraOutdoorsOnly(activeQuickCamera),
                onToggleStyle: () => {
                  if (isQuickCameraOutdoorsOnly(activeQuickCamera)) {
                    setMapStyle(DEFAULT_MAP_STYLE);
                    return;
                  }
                  if (activeQuickCamera === 1) {
                    camera1UserToggledStyleRef.current = true;
                  }
                  setMapStyle(nextOutdoorsSatelliteMapStyle(mapStyle));
                },
                onZoomOut: () => {
                  const rideActive =
                    rideStatus === "running" || rideStatus === "paused";
                  // idle = 일반 지도 줌 −1. 주행 = 거리 없는 모드·routeFit(free)는 실측 mapZoom 스텝.
                  if (
                    !rideActive ||
                    followMode === "free" ||
                    followMode === "topDown" ||
                    followMode === "north" ||
                    followMode === "keep"
                  ) {
                    mapZoomStepSeqRef.current += 1;
                    setMapZoomStepRequest({
                      requestId: mapZoomStepSeqRef.current,
                      delta: -1,
                    });
                    return;
                  }
                  handleRideCameraDistanceFromUserZoom(
                    nextRideUserZoomOutDistanceM(rideCameraDistanceM),
                  );
                },
                onZoomIn: () => {
                  const rideActive =
                    rideStatus === "running" || rideStatus === "paused";
                  // idle = 일반 지도 줌 +1. 주행 = 실측 mapZoom↑ 또는 거리↓(userZoom).
                  if (
                    !rideActive ||
                    followMode === "free" ||
                    followMode === "topDown" ||
                    followMode === "north" ||
                    followMode === "keep"
                  ) {
                    mapZoomStepSeqRef.current += 1;
                    setMapZoomStepRequest({
                      requestId: mapZoomStepSeqRef.current,
                      delta: 1,
                    });
                    return;
                  }
                  handleRideCameraDistanceFromUserZoom(
                    Math.max(1e-9, nextRideUserZoomInDistanceM(rideCameraDistanceM)),
                  );
                },
                zoomOutDisabled: (() => {
                  const rideActive =
                    rideStatus === "running" || rideStatus === "paused";
                  if (
                    !rideActive ||
                    followMode === "free" ||
                    followMode === "topDown" ||
                    followMode === "north" ||
                    followMode === "keep"
                  ) {
                    return mapZoom <= MAP_GLOBE_MIN_ZOOM + 1e-6;
                  }
                  // 거리 지배 주행 카메라에는 제품 임의 상한이 없다.
                  // 실제 축소 한계는 Mapbox `minZoom`이 맡는다.
                  return false;
                })(),
                zoomInDisabled: (() => {
                  const rideActive =
                    rideStatus === "running" || rideStatus === "paused";
                  if (
                    !rideActive ||
                    followMode === "free" ||
                    followMode === "topDown" ||
                    followMode === "north" ||
                    followMode === "keep"
                  ) {
                    return mapZoom >= MAP_ZOOM_SLIDER_MAX - 1e-6;
                  }
                  return rideCameraDistanceM <= 1e-6;
                })(),
              },
            }}
          >
          </AppMapStage>
        )}
      </div>

      {edgePanelHandlesVisible ? (
        <>
          <EdgePanelHandle
            edge="left"
            open={menuOpen}
            panelId="menu-panel"
            label="메뉴 열기"
            onOpen={openMenuPanel}
            onClose={() => {
              setMenuOpen(false);
              setPlaceSearchMarkerLngLat(null);
            }}
            onDragProgress={handleMenuReveal}
          />
          <EdgePanelHandle
            edge="right"
            open={mapViewSheetOpen}
            panelId="map-view-sheet"
            label="맵 뷰 열기"
            onOpen={openMapViewFromEdge}
            onClose={() => setMapViewSheetOpen(false)}
            onDragProgress={handleMapViewReveal}
          />
        </>
      ) : null}

      <MenuPanel
        open={menuOpen}
        revealProgress={menuReveal}
        onClose={() => {
          setMenuOpen(false);
          setPlaceSearchMarkerLngLat(null);
          setMenuReveal(null);
        }}
      >
        <RideRoutePanel
          onOpenSettings={openRideSettingsPanel}
          onOpenPlaceSearch={() => {
            placeSearchIntentRef.current = "menu";
            openPlaceSearchPanel();
          }}
          onOpenLeaderboard={openLeaderboardPanel}
          leaderboardMenuAside={
            leaderboardGlance.data?.me.status === "ranked" &&
            leaderboardGlance.data.me.rank != null
              ? (
                  <>
                    이번 주 <b>{leaderboardGlance.data.me.rank}</b>위
                  </>
                )
              : undefined
          }
          routeSummary={routeSummary}
          routeLoading={routeLoading || isSearching}
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
          onResumeSavedRoute={(route) => {
            handleResumeSavedRouteFromLibrary(route);
            setMenuOpen(false);
          }}
          activeResumeRouteId={resumeSlotActiveRouteId}
          onRenameSavedRoute={handleRenameSavedRoute}
          onDeleteSavedRoute={handleDeleteSavedRouteWithSlotClear}
          arrivalToastVisible={false}
          adhocSaveAvailable={false}
          onSaveAdhocAsUserRoute={handleSaveAdhocAsUserRouteWithSlot}
          adhocSuggestedName={suggestedRouteName}
          onDismissAdhocSave={() => setLastEndedWasAdhoc(null)}
          openSavedTabSignal={openSavedTabNonce}
          reopenSavedSignal={reopenSavedNonce}
          savedQuotaNotice={savedQuotaNotice}
          onDismissSavedQuotaNotice={() => setSavedQuotaNotice(null)}
          onIncompleteQuotaBlocked={handleIncompleteQuotaBlocked}
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
          pacerEnabled={pacerEnabled}
          onPacerEnabled={setPacerEnabled}
          rideElevationProfileLoading={rideElevationProfileLoading}
          rideBgmCatalogConfigured={rideBgmCatalogConfigured}
        />
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
      </MenuPanel>

      <PlaceSearchPanel
        open={placeSearchOpen}
        onClose={() => {
          placeSearchIntentRef.current = "menu";
          setPlaceSearchOpen(false);
        }}
      >
        <MenuPlaceSearch
          accessToken={MAPBOX_TOKEN}
          open={placeSearchOpen}
          onPickPlace={handleMenuPlacePick}
        />
      </PlaceSearchPanel>

      <RouteClearBlockedDialog
        open={routeClearBlockedOpen && routeClearBlockedByRide}
        onContinue={() => setRouteClearBlockedOpen(false)}
        onEndRide={() => {
          setRouteClearBlockedOpen(false);
          handleEndRideWithTrailCleanup();
        }}
      />

      <RideSettingsSheet
        open={rideSettingsSheetOpen}
        onClose={() => setRideSettingsSheetOpen(false)}
        rideTtsEnabled={rideTtsEnabled}
        onRideTtsEnabled={setRideTtsEnabled}
        rideBgmEnabled={rideBgmEnabled}
        onRideBgmEnabled={setRideBgmEnabled}
        rideCoachingBanner={rideCoachingBannerVisible}
        onRideCoachingBanner={setRideCoachingBannerVisible}
        pacerEnabled={pacerEnabled}
        onPacerEnabled={setPacerEnabled}
        rideBgmCatalogConfigured={rideBgmCatalogConfigured}
        rideElevationProfileLoading={rideElevationProfileLoading}
        calorieWeightKg={calorieProfile.weightKg}
        calorieIntensityId={calorieProfile.intensityId}
        onEditProfile={() => {
          setRideSettingsSheetOpen(false);
          setProfileEditOpen(true);
        }}
      />

      <CadenceSensorSheet
        open={cadenceSensorSheetOpen}
        onClose={() => setCadenceSensorSheetOpen(false)}
        capable={bleCrankRpm.capable}
        uiState={bleCrankRpm.uiState}
        deviceLabel={bleCrankRpm.deviceLabel}
        crankRpm={bleCrankRpm.crankRpm}
        errorMessage={bleCrankRpm.errorMessage}
        mode={rideInputMode}
        readiness={rideInputReadiness}
        riding={rideStatus !== "idle"}
        manualSpeedKmh={manualSpeedKmh}
        onManualSpeedKmh={setManualSpeedKmh}
        onConnect={() => void bleCrankRpm.connect()}
        onDisconnect={bleCrankRpm.disconnect}
        onChooseManual={switchRideInputToManual}
        onChooseCadence={switchRideInputToCadence}
      />

      <MapViewSheet
        open={mapViewSheetOpen}
        revealProgress={mapViewReveal}
        onClose={() => {
          setMapViewSheetOpen(false);
          setMapViewReveal(null);
        }}
        coverageOverlayMode={coverageOverlayMode}
        onCoverageOverlayMode={setCoverageOverlayMode}
        enable3D={enable3D}
        onEnable3D={setEnable3D}
        rideActive={rideStatus === "running" || rideStatus === "paused"}
        rideCameraDistanceM={rideCameraDistanceM}
        onRideCameraDistanceM={handleRideCameraDistancePreset}
        conquestDisplayMode={conquestDisplayMode}
        conquestHasRecentGeometry={recentNewRoadGeometry.length > 0}
        onConquestDisplayMode={(mode) => {
          if (mode === "recent") focusConquestView(mode);
          else setConquestDisplayMode(mode);
        }}
        onShowAllConquest={() => focusConquestView("all")}
      />

      <ProfileEditSheet
        open={profileEditOpen}
        onClose={() => setProfileEditOpen(false)}
        user={user}
        weightKg={calorieProfile.weightKg}
        intensityId={calorieProfile.intensityId}
        nicknameChangedAtMs={userTier.nicknameChangedAtMs}
        onChangeNickname={handleChangeNickname}
        onWeightKg={setCalorieWeightKg}
        onIntensityId={setCalorieIntensityId}
      />

      <UserInfoSheet
        open={userInfoSheetOpen}
        onEditProfile={user ? () => setProfileEditOpen(true) : undefined}
        onOpenAdmin={user ? openAdminDashboardPanel : undefined}
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
        rideActive={rideStatus === "running" || rideStatus === "paused"}
        savedRoutes={savedRoutes}
        onShowRideOnMap={(ride) => {
          const anchor = ride.sessionEndLngLat;
          if (!anchor) return;
          setUserInfoSheetOpen(false);
          focusAnchorOnMap(anchor);
        }}
        onResumeRideRoute={(routeId) => handleResumeSavedRouteById(routeId)}
        onExtendFromRide={handleStartRouteFromAnchor}
        activeRouteId={resumeSlotActiveRouteId}
        onFocusActiveRoute={(routeId) => {
          const route = savedRoutes.find((r) => r.id === routeId);
          if (!route) return;
          setUserInfoSheetOpen(false);
          handleResumeSavedRouteById(routeId);
        }}
      />

      <AdminDashboardSheet
        open={adminDashboardSheetOpen}
        onClose={() => setAdminDashboardSheetOpen(false)}
        user={user}
      />

      <LeaderboardSheet
        open={leaderboardSheetOpen}
        onClose={() => setLeaderboardSheetOpen(false)}
        user={user}
        onRegister={() => void handleGoogleSignIn()}
        onJoinTrail={(trailId) => {
          setLeaderboardSheetOpen(false);
          joinTrailAndCloseMenu(trailId);
        }}
      />

      <RideSummarySheet
        open={summaryVisible}
        result={lastRideResult}
        story={rideEndStory}
        arrivalCompleted={arrivalToastTick > 0}
        elapsedLabel={elapsedLabel}
        avgKmh={avgSpeedLabel}
        caloriesEstimate={caloriesEstimate}
        onOpenCalorieSettings={() => setProfileEditOpen(true)}
        calorieProfileComplete={calorieProfile.weightKg != null && calorieProfile.intensityId != null}
        onGuestLinkGoogle={user?.isAnonymous ? () => void handleGoogleSignIn() : undefined}
        adhocSaveAvailable={lastEndedWasAdhoc !== null}
        userId={user?.uid}
        onConquestResult={handleRecentConquestResult}
        onConquestTimeout={handleRecentConquestTimeout}
        maxNameLength={SAVED_ROUTE_NAME_MAX}
        suggestedName={suggestedRouteName}
        onSaveAdhoc={async (name, confirmUpdate) => {
          await handleSaveAdhocAsUserRouteWithSlot(name, confirmUpdate);
          // 저장 후에도 같은 규칙 — 지도를 idle 로 되돌려야 카드가 다음 행동을 제시한다.
          closeSummaryAndReturnToIdleMap();
        }}
        onDismissAdhoc={() => setLastEndedWasAdhoc(null)}
        onClose={handleCloseSummary}
        onIncompleteQuotaBlocked={handleIncompleteQuotaBlocked}
        rankChange={summaryRankChange}
        onOpenLeaderboard={openLeaderboardPanel}
      />

      {publicRouteRequestModalRoute && user ? (
        <PublicRouteRequestModal
          route={publicRouteRequestModalRoute}
          onClose={() => setPublicRouteRequestModalRoute(null)}
          // 취소만 내 경로 창을 다시 연다 — 등록 성공은 onClose 만(2026-10-06 Chief).
          onCancel={() => {
            setPublicRouteRequestModalRoute(null);
            setReopenSavedNonce((n) => n + 1);
          }}
          onSubmit={handleSubmitPublicRouteRequest}
        />
      ) : null}

      {entryLocation.notice ? (
        <p className="entry-location-notice" role="status">
          {entryLocation.notice}
        </p>
      ) : null}

      {showAppIntro ? (
        <AppIntroScreen onStartGuest={startIntroGuest} onLogin={startIntroLogin} />
      ) : null}

      <EntryLocationDialog
        phase={entryLocation.phase}
        permission={entryLocation.permission}
        onChooseRome={entryLocation.chooseRome}
        onChooseCurrent={entryLocation.chooseCurrent}
        onPosition={entryLocation.acceptPosition}
      />

      {needsGuestEntry && !showAppIntro && !entryRequested && !entryLocationPrompt ? (
        <GuestEntryCard
          busy={busy || authSigningIn}
          error={error}
          notice={
            startScreenNotice === "account-deleted"
              ? "탈퇴가 완료되었습니다. 그동안 함께 달려 주셔서 고맙습니다."
              : null
          }
          expiryKind={expiryKind}
          onStartGuest={() => void beginAuthenticatedSession()}
          onGoogleSignIn={() => void handleGoogleSignIn()}
        />
      ) : null}

      {stage === "gate" && !showAppIntro && !needsGuestEntry && !entryLocationPrompt ? (
        <AuthSessionGate
          configured={configured}
          authInitialized={authInitialized}
          authSigningIn={authSigningIn}
          userSignedOut={userSignedOut}
          authOffline={authOffline}
          busy={busy}
          error={error}
          onStartGuest={() => void beginAuthenticatedSession()}
          onGoogleSignIn={() => void handleGoogleSignIn()}
          onRetryAuth={() => void retryAuthRestore()}
        />
      ) : null}

      {stage === "gate-nickname" && user && !entryLocationPrompt ? (
        <AuthGateCard title="닉네임">
          <SignUpNicknameCard
            busy={busy}
            initialWeightKg={calorieProfile.weightKg}
            initialIntensityId={calorieProfile.intensityId}
            onSubmit={async (nickname, calorie) => {
              // 가입 때 한 번 받아 두면 주행마다 다시 묻지 않는다(본인 전용 서버 문서로 기기 간 동기화)
              if (calorie.weightKg != null) setCalorieWeightKg(calorie.weightKg);
              if (calorie.intensityId != null) setCalorieIntensityId(calorie.intensityId);
              await handleCompleteNickname(nickname);
            }}
          />
          {error ? <p className="error tight">{error}</p> : null}
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            title="End session"
            onClick={() => void handleServiceExit()}
          >
            종료
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
