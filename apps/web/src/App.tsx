import { startTransition, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import type { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  reload,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { CourseSharedPresence } from "./components/CourseSharedPresence";
import { LobbyPresence } from "./components/LobbyPresence";
import { MapView, type MapPeerMarker } from "./components/MapView";
import { SignUpNicknameCard } from "./components/SignUpNicknameCard";
import { RideRoutePanel, type FollowMode } from "./components/RideRoutePanel";
import { PublicRouteRequestModal } from "./components/PublicRouteRequestModal";
import { MapHud } from "./components/maphud/MapHud";
import { useLobbyRoomSession } from "./hooks/useLobbyRoomSession";
import { useLobbyLiveCourseRidePublisher } from "./hooks/useLobbyLiveCourseRidePublisher";
import { useLobbyLiveCourseRideSpectatorOverlay } from "./hooks/useLobbyLiveCourseRideSpectatorOverlay";
import { useDocumentVisibility } from "./hooks/useDocumentVisibility";
import { fetchWorldPresenceSummary, formatWorldPresenceHudLine } from "./lib/firestoreWorldPresence";
import { MAP_ZOOM_WORLD_ACTIVITY_MAX, WORLD_PRESENCE_POLL_MS } from "./lib/rideSyncPolicy";
import { AuthGateCard, AuthGoogleMark } from "./components/AuthGateCard";
import { RideSummarySheet } from "./components/RideSummarySheet";
import { MenuPanel } from "./components/MenuPanel";
import { MenuPlaceSearch } from "./components/MenuPlaceSearch";
import { RoomSwitcher } from "./components/RoomSwitcher";
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
import { safeRideSpeechCancel } from "./lib/rideSpeech";
import { getFirebaseApp, getFirebaseAuth, isFirebaseConfigured } from "./lib/firebase";
import {
  BASIC_SHARED_HUB_IDS,
  BASIC_SHARED_HUB_SUMMARIES,
  ensureBasicCoursesSeeded,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
  listPublishedPublicCourses,
  matchBasicSharedHubCourseId,
  routeGeometryMatchesBasicSharedHub,
  type PublishedPublicCourseSummary,
} from "./lib/firestoreCourses";
import { deleteCoursePresence } from "./lib/firestoreCoursePresence";
import { deleteLobbyPresence, isLobbyMemberActive, sanitizeRoomId } from "./lib/firestoreLobby";
import {
  backfillRideSessionsToFirestore,
  loadRecentRideSessionsFromFirestore,
  saveRideSessionToFirestore,
} from "./lib/firestoreRides";
import {
  backfillSavedRoutesExpiresAt,
  deleteSavedRouteFromFirestore,
  loadSavedRoutesFromFirestore,
  migrateLocalRoutesToFirestore,
  promoteSavedRouteInFirestore,
  renameSavedRouteInFirestore,
  saveRouteToFirestore,
  SAVED_ROUTE_NAME_MAX,
  type SavedRoute,
} from "./lib/firestoreSavedRoutes";
import {
  createPublicRouteRequest,
  isRouteReviewer,
  loadMyPendingRequestRouteIds,
  loadPendingPublicRouteRequests,
  type ExperienceTagId,
} from "./lib/publicRouteRequests";
import {
  clearSavedRoutesLocal,
  deleteSavedRouteFromLocal,
  exportLocalRoutesForMigration,
  loadSavedRoutesFromLocal,
  promoteSavedRouteInLocal,
  renameSavedRouteInLocal,
  saveRouteToLocal,
} from "./lib/savedRoutesLocal";
import type { LineStringGeometry, LngLat } from "./lib/geo";
import { formatLngLat, getPointOnRouteByDistance, lineStringLengthMeters } from "./lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "./lib/routeWaypoints";
import {
  loadRideSessions,
  saveRideSessions,
  type StoredRideSession,
} from "./lib/rideSessionsStorage";
import { readRoomIdFromLocation, replaceRoomInUrl } from "./lib/roomUrl";
import {
  claimNicknameTransaction,
  getUserProfileNickname,
  NicknameTakenError,
} from "./lib/firestoreUser";
import { isValidNickname } from "./lib/nickname";
import { useVirtualRideSession } from "./hooks/useVirtualRideSession";
import { useBleCrankRpm } from "./hooks/useBleCrankRpm";
import { useRideMapillaryStreet } from "./hooks/useRideMapillaryStreet";
import { MAPILLARY_CLIENT_TOKEN, mapillaryTokenConfigured } from "./lib/mapillaryToken";
import type { CoverageOverlayMode } from "./lib/coverageOverlayMode";

const MapillaryRideViewer = lazy(async () => {
  const m = await import("./components/MapillaryRideViewer");
  return { default: m.MapillaryRideViewer };
});
import { fetchRouteByProfile, formatDuration, type RouteProfile } from "./services/mapboxDirections";
import { fetchMapboxReverseGeocodePlaceName } from "./services/mapboxReverseGeocode";
import { getFunctions } from "firebase/functions";
import "./App.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
/** 로그아웃 직후 같은 탭에서 맵을 유지할지(sessionStorage). 최초 방문은 플래그 없음 → 기존처럼 전체 인증 게이트. */
const POST_SIGNOUT_MAP_SESSION_KEY = "boxcycle_post_signout_map_v1";

function readPostSignoutMapSessionFlag(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(POST_SIGNOUT_MAP_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
/** B 여정 setup 안내 탭 닫힘 — 브라우저 탭 세션 동안만 유지(새 탭이면 다시 표시 가능) */
const B_JOURNEY_HINT_SESSION_KEY = "boxcycle_b_journey_hint_dismissed_v1";

function readBJourneyHintDismissedSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(B_JOURNEY_HINT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

const MAP_STYLE_OPTIONS = [
  { value: "mapbox://styles/mapbox/streets-v12", label: "Streets" },
  { value: "mapbox://styles/mapbox/outdoors-v12", label: "Outdoors" },
  { value: "mapbox://styles/mapbox/light-v11", label: "Light" },
  { value: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
];

type FsSyncState =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "awaiting_nickname" }
  | { state: "ok" }
  | { state: "error"; message: string };

function formatElapsedFromMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function isBenignAuthPopupCancel(e: unknown): boolean {
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fsSync, setFsSync] = useState<FsSyncState>({ state: "idle" });
  const [roomId, setRoomId] = useState(readRoomIdFromLocation);
  const [roomDraft, setRoomDraft] = useState(readRoomIdFromLocation);
  const configured = isFirebaseConfigured();

  const [startLngLat, setStartLngLat] = useState<LngLat | null>(null);
  const [endLngLat, setEndLngLat] = useState<LngLat | null>(null);
  const [startPlaceLabel, setStartPlaceLabel] = useState<string | null>(null);
  const [endPlaceLabel, setEndPlaceLabel] = useState<string | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<LngLat[]>([]);
  /** 경유지 표시용 — Mapbox 역지오코딩(null 이면 로딩 중) */
  const [waypointPlaceLabels, setWaypointPlaceLabels] = useState<(string | null)[]>([]);
  const routeWaypointsGeocodeRef = useRef(routeWaypoints);
  routeWaypointsGeocodeRef.current = routeWaypoints;

  const [profile, setProfile] = useState<RouteProfile>("cycling");
  const [routeGeometry, setRouteGeometry] = useState<LineStringGeometry | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(0);
  const [routeDurationSec, setRouteDurationSec] = useState(0);
  const [routeSummary, setRouteSummary] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState(MAP_STYLE_OPTIONS[3].value);
  const [mapZoom, setMapZoom] = useState(12);
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
  const cameraJumpSeqRef = useRef(0);
  const [mapViewSheetOpen, setMapViewSheetOpen] = useState(false);
  const [userInfoSheetOpen, setUserInfoSheetOpen] = useState(false);
  const [rideSettingsSheetOpen, setRideSettingsSheetOpen] = useState(false);
  const [idleHintDismissed, setIdleHintDismissed] = useState(false);
  /** B 여정(커스텀 경로): setup 안내 세션 플래그 */
  const [bJourneyHintDismissedSession, setBJourneyHintDismissedSession] = useState(readBJourneyHintDismissedSession);
  const [summarySheetVisible, setSummarySheetVisible] = useState(false);
  const [coverageOverlayMode, setCoverageOverlayMode] = useState<CoverageOverlayMode>("off");
  const [recentSessions, setRecentSessions] = useState<StoredRideSession[]>(() =>
    loadRideSessions(),
  );
  /** 사용자가 저장한 경로 — 로그인 사용자는 Firestore, 게스트/미로그인은 localStorage */
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() =>
    loadSavedRoutesFromLocal(),
  );
  const [savedRoutesLoading, setSavedRoutesLoading] = useState(false);
  const [publicRouteRequestModalRoute, setPublicRouteRequestModalRoute] = useState<SavedRoute | null>(null);
  const [isPublicRouteReviewer, setIsPublicRouteReviewer] = useState(false);
  const [pendingPublicRouteIds, setPendingPublicRouteIds] = useState<ReadonlySet<string>>(() => new Set());
  const [publicRouteReviewQueueCount, setPublicRouteReviewQueueCount] = useState(0);
  /** 심사 승인된 퍼블릭 코스 카탈로그(공식 코스 · 퍼블릭 탭) */
  const [publishedPublicCourses, setPublishedPublicCourses] = useState<PublishedPublicCourseSummary[]>([]);
  const [publishedPublicCoursesLoading, setPublishedPublicCoursesLoading] = useState(false);
  const [publishedPublicCoursesError, setPublishedPublicCoursesError] = useState<string | null>(null);
  /** 입문 허브 동시 주행에 참여 중인 코스 document id(null 이면 미참여) */
  const [basicActiveHubCourseId, setBasicActiveHubCourseId] = useState<string | null>(null);
  const [basicStartLoading, setBasicStartLoading] = useState(false);
  /** 지도에 올라온 경로가 공식 코스(입문 허브·퍼블릭 등)에서 온 경우 — 맞춤 「경로 생성」 비활성에 사용 */
  const [activeOfficialCourseId, setActiveOfficialCourseId] = useState<string | null>(null);
  const basicStartHubJoined = basicActiveHubCourseId !== null;
  const [coursePeerMarkers, setCoursePeerMarkers] = useState<MapPeerMarker[]>([]);
  /** 입문 허브 동행에서 계산된 내 네임태그(없으면 단독 주행용 표시로 대체) */
  const [liveRiderNametag, setLiveRiderNametag] = useState<string | null>(null);
  /** 로그인(게스트 포함) 세션 동안 로비 presence·관전 항상 on — 사용자용 로비 진입·이탈 토글 없음 */
  const lobbySessionActive = Boolean(configured && user);
  const [postSignoutMapSession, setPostSignoutMapSession] = useState(readPostSignoutMapSessionFlag);
  /** 비로그인 맵에서 TR「로그인」으로 연 게스트/Google 카드 */
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  /** 게스트/Google 클릭 직후 첫 진입 풀스크린 선택 카드만 숨김(stage 는 아직 gate 일 수 있음) */
  const [authPickCardHidden, setAuthPickCardHidden] = useState(false);
  const pageVisible = useDocumentVisibility();
  const [worldHudHint, setWorldHudHint] = useState<string | null>(null);

  const lobbyRoomSession = useLobbyRoomSession({
    user: user ?? undefined,
    roomId,
    enabled: lobbySessionActive,
    pageVisible,
  });
  /** true면 입문 코스 경로가 있어도 동행 허브 자동 참여 안 함(「나가기」 후) */
  const basicStartHubLeftExplicitRef = useRef(false);
  /** leaveBasicHub 등에서 최신 주행 종료 로직을 호출하기 위한 ref */
  const handleEndRideRef = useRef<() => void>(() => {});
  /**
   * 현재 지도에 로드되어 있는 사용자 경로(SavedRoute) ID.
   * - `handleLoadSavedRoute` 호출 시 채워지고
   * - `handleSaveCurrentRoute` 로 방금 저장한 경로를 지도에 그대로 두고 주행할 때도 채워진다(완주 격상 대상).
   * - 새 경로 탐색 / 출발-도착 변경 / 입문 코스 진입 시 null 로 리셋
   * - `handleEndRide` 에서 이 값이 있으면 → 격상(completed=1) 처리
   */
  const loadedSavedRouteIdRef = useRef<string | null>(null);
  /**
   * 가장 최근 격상된 사용자 경로의 이름(스냅샷). rides 문서 저장 시 routeName 으로 함께 적재.
   * 격상 직전 단계에서 동기적으로 잡아 쓴다.
   */
  const loadedSavedRouteNameRef = useRef<string | null>(null);
  /** 직전 종료(handleEndRide) 시 ad-hoc 주행이었는지 — 토스트 「사용자 경로로 저장」 버튼 노출 조건 */
  const [lastEndedWasAdhoc, setLastEndedWasAdhoc] = useState<{
    distanceMeters: number;
    durationSec: number;
    geometry: LineStringGeometry;
    startLngLat: LngLat;
    endLngLat: LngLat;
    waypoints: LngLat[];
    profile: RouteProfile;
    rideId: string | null;
  } | null>(null);

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

  const {
    status: rideStatus,
    setStatus: setRideStatus,
    metrics: rideMetrics,
    resetDistances: resetRide,
    syncLiveFromDistance,
  } = useVirtualRideSession({
    speedKmh,
    routeGeometry,
    routeDistanceMeters,
  });

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

  const coursePeerIdsForLobbySpectator = useMemo(
    () => new Set(coursePeerMarkers.map((p) => p.id)),
    [coursePeerMarkers],
  );

  const lobbySpectatorOverlayEnabled = Boolean(
    lobbySessionActive && rideStatus === "idle" && pageVisible,
  );

  const { spectatorDots, spectatorRouteGeometries } = useLobbyLiveCourseRideSpectatorOverlay({
    user,
    roomId,
    enabled: lobbySpectatorOverlayEnabled,
    mapZoom,
    excludePeerIds: coursePeerIdsForLobbySpectator,
  });

  useLobbyLiveCourseRidePublisher({
    user,
    enabled: Boolean(
      lobbySessionActive &&
        rideStatus === "running" &&
        (basicActiveHubCourseId ?? activeOfficialCourseId) &&
        Boolean(routeGeometry?.coordinates?.length),
    ),
    pageVisible,
    roomId,
    courseId: basicActiveHubCourseId ?? activeOfficialCourseId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters: rideMetrics.virtualDistanceMeters,
  });

  useEffect(() => {
    if (!configured || !user || !pageVisible || mapZoom > MAP_ZOOM_WORLD_ACTIVITY_MAX) {
      setWorldHudHint(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void (async () => {
        const r = await fetchWorldPresenceSummary();
        if (!cancelled) setWorldHudHint(formatWorldPresenceHudLine(r.regions));
      })();
    };
    load();
    const id = window.setInterval(load, WORLD_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [configured, user, pageVisible, mapZoom]);

  useEffect(() => {
    const onPop = () => {
      const next = readRoomIdFromLocation();
      setRoomId(next);
      setRoomDraft(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Firebase Auth 첫 onAuthStateChanged 수신 여부(영속 세션 복원 vs 미로그인 구분) */
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    try {
      sessionStorage.removeItem(POST_SIGNOUT_MAP_SESSION_KEY);
    } catch {
      /* noop */
    }
    setPostSignoutMapSession(false);
    setAuthSheetOpen(false);
  }, [user]);
  useEffect(() => {
    if (!configured) {
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      startTransition(() => setAuthInitialized(true));
      setUser(nextUser);
    });
    return () => unsub();
  }, [configured]);

  /** 비로그인 상태에서는 사용자 시트 액션(로비/로그아웃)이 없으므로 시트를 닫음 */
  useEffect(() => {
    if (!user) setUserInfoSheetOpen(false);
  }, [user]);

  useEffect(() => {
    if (!configured || !user) {
      startTransition(() => setFsSync({ state: "idle" }));
      return;
    }
    if (user.isAnonymous) {
      startTransition(() => setFsSync({ state: "ok" }));
      return;
    }
    let cancelled = false;
    startTransition(() => setFsSync({ state: "syncing" }));
    void (async () => {
      try {
        const stored = await getUserProfileNickname(user.uid);
        if (cancelled) return;
        if (stored == null || !isValidNickname(stored)) {
          startTransition(() => setFsSync({ state: "awaiting_nickname" }));
          return;
        }
        await claimNicknameTransaction(user, stored);
        if (cancelled) return;
        startTransition(() => setFsSync({ state: "ok" }));
      } catch (e: unknown) {
        if (e instanceof NicknameTakenError) {
          if (!cancelled) startTransition(() => setFsSync({ state: "awaiting_nickname" }));
          if (!cancelled) setError(`${e.message} 다른 계정이 먼저 사용 중입니다. 닉네임을 바꿔 주세요.`);
        } else if (
          typeof e === "object" &&
          e !== null &&
          (e as { code?: string }).code === "aborted"
        ) {
          if (!cancelled) startTransition(() => setFsSync({ state: "awaiting_nickname" }));
          if (!cancelled) {
            setError("다른 분이 먼저 같은 닉네임을 선택했습니다. 닉네임을 바꿔 주세요.");
          }
        } else {
          const message = e instanceof Error ? e.message : String(e);
          if (!cancelled) startTransition(() => setFsSync({ state: "error", message }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, user]);

  useEffect(() => {
    if (!configured || !user) return;
    void ensureBasicCoursesSeeded(user.uid).catch(() => {
      // 기본 코스 시드 실패는 치명적 오류로 다루지 않고 앱 동작을 유지한다.
    });
  }, [configured, user]);

  useEffect(() => {
    if (!user) {
      basicStartHubLeftExplicitRef.current = false;
      startTransition(() => setBasicActiveHubCourseId(null));
    }
  }, [user]);

  useEffect(() => {
    if (!basicActiveHubCourseId) startTransition(() => setCoursePeerMarkers([]));
  }, [basicActiveHubCourseId]);

  useEffect(() => {
    if (!basicActiveHubCourseId) setLiveRiderNametag(null);
  }, [basicActiveHubCourseId]);

  useEffect(() => {
    const matched = matchBasicSharedHubCourseId(routeGeometry);
    if (!matched) {
      basicStartHubLeftExplicitRef.current = false;
    }
  }, [routeGeometry]);

  useEffect(() => {
    if (!configured || !user) return;
    if (basicStartHubLeftExplicitRef.current) return;

    const matched = matchBasicSharedHubCourseId(routeGeometry);
    if (matched) {
      startTransition(() => setBasicActiveHubCourseId(matched));
      return;
    }

    if (
      basicActiveHubCourseId &&
      (BASIC_SHARED_HUB_IDS as readonly string[]).includes(basicActiveHubCourseId) &&
      routeGeometryMatchesBasicSharedHub(basicActiveHubCourseId, routeGeometry)
    ) {
      return;
    }

    if (routeGeometry?.coordinates?.length) {
      startTransition(() => setBasicActiveHubCourseId(null));
    }
  }, [configured, user, routeGeometry, basicActiveHubCourseId]);

  useEffect(() => {
    if (!configured || !user) return;
    let cancelled = false;
    void loadRecentRideSessionsFromFirestore(user.uid, 50)
      .then(async (rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          saveRideSessions(rows);
          setRecentSessions(rows);
          return;
        }
        const localRows = loadRideSessions();
        if (localRows.length > 0) {
          try {
            await backfillRideSessionsToFirestore({
              userId: user.uid,
              roomId,
              profile,
              sessions: localRows,
            });
            const synced = await loadRecentRideSessionsFromFirestore(user.uid, 50);
            if (!cancelled && synced.length > 0) {
              saveRideSessions(synced);
              setRecentSessions(synced);
              return;
            }
          } catch {
            // 백필 실패 시 로컬 데이터를 유지한다.
          }
        }
        if (!cancelled) setRecentSessions(localRows);
      })
      .catch(() => {
        if (!cancelled) {
          setRecentSessions(loadRideSessions());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configured, user, roomId, profile]);

  const avgSpeedLabel = useMemo(() => {
    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    if (elapsedSec <= 0) return "0.0";
    const avg =
      (rideMetrics.virtualDistanceMeters / 1000) / (elapsedSec / 3600);
    return avg.toFixed(1);
  }, [rideMetrics.accumulatedMs, rideMetrics.virtualDistanceMeters]);

  const refreshPublishedPublicCourseCatalog = useCallback(async () => {
    if (!configured) {
      setPublishedPublicCourses([]);
      setPublishedPublicCoursesError(null);
      setPublishedPublicCoursesLoading(false);
      return;
    }
    setPublishedPublicCoursesLoading(true);
    setPublishedPublicCoursesError(null);
    try {
      const rows = await listPublishedPublicCourses(50);
      setPublishedPublicCourses(rows);
    } catch (e: unknown) {
      setPublishedPublicCourses([]);
      const msg = e instanceof Error ? e.message : String(e);
      setPublishedPublicCoursesError(msg);
    } finally {
      setPublishedPublicCoursesLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void refreshPublishedPublicCourseCatalog();
  }, [refreshPublishedPublicCourseCatalog]);

  const publishedPublicSavedRouteIds = useMemo(
    () =>
      new Set(
        publishedPublicCourses
          .map((c) => c.sourceSavedRouteId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    [publishedPublicCourses],
  );

  const refreshPublicRouteMeta = useCallback(async () => {
    if (!configured || !user) {
      setIsPublicRouteReviewer(false);
      setPendingPublicRouteIds(new Set());
      setPublicRouteReviewQueueCount(0);
      return;
    }
    try {
      const rev = await isRouteReviewer(user);
      setIsPublicRouteReviewer(rev);
      const mine = await loadMyPendingRequestRouteIds(user.uid);
      setPendingPublicRouteIds(mine);
      if (rev) {
        const q = await loadPendingPublicRouteRequests();
        setPublicRouteReviewQueueCount(q.length);
      } else {
        setPublicRouteReviewQueueCount(0);
      }
    } catch {
      setIsPublicRouteReviewer(false);
      setPendingPublicRouteIds(new Set());
      setPublicRouteReviewQueueCount(0);
    }
  }, [configured, user]);

  useEffect(() => {
    void refreshPublicRouteMeta();
  }, [refreshPublicRouteMeta]);

  /**
   * 사용자 경로 로딩: 로그인 사용자(익명 포함) 는 Firestore 사용.
   * 첫 진입 시 로컬에 남아있던 옛 데이터는 1회 마이그레이션 후 로컬을 비움.
   * 익명 게스트 → Google 전환은 `linkWithPopup` 으로 동일 uid 가 유지되어 데이터가 그대로 살아남는다.
   * Firebase 미설정/미인증 상태에서만 localStorage 폴백 사용.
   */
  useEffect(() => {
    if (!configured || !user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setSavedRoutesLoading(true);
      try {
        const localPending = exportLocalRoutesForMigration();
        console.info(
          `[savedRoutes] 마이그레이션·로드 시작 uid=${user.uid} isAnonymous=${user.isAnonymous} 로컬보류=${localPending.length}건`,
        );
        if (localPending.length > 0) {
          await migrateLocalRoutesToFirestore({
            userId: user.uid,
            routes: localPending.map((r) => ({ ...r, userId: user.uid })),
          });
          clearSavedRoutesLocal();
        }
        const rows = await loadSavedRoutesFromFirestore(user.uid, 50);
        if (!cancelled) setSavedRoutes(rows);
      } catch (e) {
        console.error("[savedRoutes] 로드/마이그레이션 실패 → localStorage 폴백", e);
        if (!cancelled) setSavedRoutes(loadSavedRoutesFromLocal());
      } finally {
        if (!cancelled) setSavedRoutesLoading(false);
      }
      /**
       * expiresAt 백필 — 사용자당 1회.
       * Firestore TTL 정책(Console UI)이 `savedRoutes.expiresAt` 필드를 인식하려면
       * 컬렉션에 실제 필드가 1건 이상 존재해야 한다. 기존 경로(필드 없음)에는
       * 「지금 + 7일」 의 유예를 새로 부여하여 채워 넣는다.
       * 격상된(completed=1) 경로는 건너뛴다(영구 보존).
       */
      const backfillKey = `boxcycle_saved_routes_ttl_backfill_v1_${user.uid}`;
      if (!cancelled && !localStorage.getItem(backfillKey)) {
        try {
          const result = await backfillSavedRoutesExpiresAt({ userId: user.uid });
          console.info("[savedRoutes] expiresAt 백필 완료", result);
          localStorage.setItem(backfillKey, new Date().toISOString());
          if (result.updated > 0) {
            const rows = await loadSavedRoutesFromFirestore(user.uid, 50);
            if (!cancelled) setSavedRoutes(rows);
          }
        } catch (e) {
          console.warn("[savedRoutes] expiresAt 백필 실패(다음 진입 시 재시도)", e);
        }
      }
      if (!cancelled) void refreshPublicRouteMeta();
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, user, refreshPublicRouteMeta]);

  /** 미로그인 상태(또는 Firebase 미설정)에서만 로컬 저장소 폴백(외부 소스→React 동기화). */
  useEffect(() => {
    if (configured && user) return;
    const local = loadSavedRoutesFromLocal();
    setSavedRoutes((prev) => {
      if (prev.length === local.length && prev.every((r, i) => r.id === local[i]?.id)) {
        return prev;
      }
      return local;
    });
  }, [configured, user]);

  const handleSaveCurrentRoute = useCallback(
    async (name: string) => {
      // RideRoutePanel: 이름 검증 후 저장 확정 시에만 호출(경로 생성만으로는 DB/로컬 목록에 쓰지 않음).
      if (!routeGeometry || routeGeometry.coordinates.length < 2) {
        throw new Error("저장할 경로가 없습니다. 경로 생성 후 다시 시도하세요.");
      }
      if (!startLngLat || !endLngLat) {
        throw new Error("출발지·도착지가 설정되지 않았습니다.");
      }
      const baseInput = {
        name,
        profile,
        startLngLat,
        endLngLat,
        waypoints: routeWaypoints.slice(0, MAX_ROUTE_WAYPOINTS),
        geometry: routeGeometry,
        distanceMeters: routeDistanceMeters,
        durationSec: routeDurationSec,
      };
      if (configured && user) {
        const saved = await saveRouteToFirestore({ ...baseInput, userId: user.uid });
        setSavedRoutes((prev) => [saved, ...prev]);
        loadedSavedRouteIdRef.current = saved.id;
        loadedSavedRouteNameRef.current = saved.name;
        setLastEndedWasAdhoc(null);
      } else {
        const saved = await saveRouteToLocal(baseInput);
        setSavedRoutes((prev) => [saved, ...prev]);
        loadedSavedRouteIdRef.current = saved.id;
        loadedSavedRouteNameRef.current = saved.name;
        setLastEndedWasAdhoc(null);
      }
    },
    [
      configured,
      user,
      routeGeometry,
      startLngLat,
      endLngLat,
      routeWaypoints,
      profile,
      routeDistanceMeters,
      routeDurationSec,
    ],
  );

  /**
   * 완주 후 「내 경로로 저장」— RideRoutePanel / RideSummarySheet 에서 이름 검증·confirm 후에만 호출.
   * rides 는 보안 규칙상 update 불가 → 새 사용자 경로 생성 후 즉시 promote(completed=1) 하여
   * 「완주 경로」 로 즉시 등록한다. rides 문서의 userRouteId 는 null 로 남지만, 사용자 경로 쪽에는
   * lastRideId 로 연결되어 역추적 가능하다.
   */
  const handleSaveAdhocAsUserRoute = useCallback(
    async (name: string) => {
      // UI에서 confirm·이름 정규화 후에만 호출.
      if (!lastEndedWasAdhoc) {
        throw new Error("저장 대상 경로 정보가 없습니다.");
      }
      const base = {
        name,
        profile: lastEndedWasAdhoc.profile,
        startLngLat: lastEndedWasAdhoc.startLngLat,
        endLngLat: lastEndedWasAdhoc.endLngLat,
        waypoints: lastEndedWasAdhoc.waypoints,
        geometry: lastEndedWasAdhoc.geometry,
        distanceMeters: lastEndedWasAdhoc.distanceMeters,
        durationSec: lastEndedWasAdhoc.durationSec,
      };
      const rideId = lastEndedWasAdhoc.rideId;
      if (configured && user) {
        const saved = await saveRouteToFirestore({ ...base, userId: user.uid });
        try {
          await promoteSavedRouteInFirestore({
            userId: user.uid,
            routeId: saved.id,
            rideId: rideId ?? "",
          });
        } catch {
          /* 격상 실패해도 사용자 경로는 이미 생성됨 */
        }
        const nowIso = new Date().toISOString();
        const promoted: SavedRoute = {
          ...saved,
          completed: 1,
          completedAtIso: nowIso,
          expiresAtIso: null,
          lastRideId: rideId ?? null,
          updatedAtIso: nowIso,
        };
        setSavedRoutes((prev) => [promoted, ...prev]);
      } else {
        const saved = await saveRouteToLocal(base);
        promoteSavedRouteInLocal({
          routeId: saved.id,
          rideId: rideId ?? saved.id,
        });
        setSavedRoutes(loadSavedRoutesFromLocal());
      }
      setLastEndedWasAdhoc(null);
    },
    [configured, user, lastEndedWasAdhoc],
  );

  const handleLoadSavedRoute = useCallback(
    (route: SavedRoute) => {
      if (rideStatus !== "idle") {
        setRouteSummary("주행 중에는 경로를 바꿀 수 없습니다. 세션 종료 후 다시 시도하세요.");
        return;
      }
      setStartLngLat(route.startLngLat);
      setEndLngLat(route.endLngLat);
      setRouteWaypoints(route.waypoints ?? []);
      setProfile(route.profile);
      setRouteGeometry(route.geometry);
      setRouteDistanceMeters(route.distanceMeters);
      setRouteDurationSec(route.durationSec);
      resetRide();
      loadedSavedRouteIdRef.current = route.id;
      loadedSavedRouteNameRef.current = route.name;
      setLastEndedWasAdhoc(null);
      setActiveOfficialCourseId(null);
      setRouteSummary(
        `「${route.name}」 불러옴 · 거리 ${(route.distanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(route.durationSec)}`,
      );
    },
    [rideStatus, resetRide],
  );


  const handleRenameSavedRoute = useCallback(
    async (route: SavedRoute, newName: string) => {
      const isFirestore = !route.id.startsWith("local-");
      if (isFirestore) {
        if (!configured || !user) {
          throw new Error("이 경로를 수정하려면 로그인이 필요합니다.");
        }
        const name = await renameSavedRouteInFirestore(user.uid, route.id, newName);
        setSavedRoutes((prev) =>
          prev.map((r) =>
            r.id === route.id
              ? { ...r, name, updatedAtIso: new Date().toISOString() }
              : r,
          ),
        );
        if (loadedSavedRouteIdRef.current === route.id) {
          loadedSavedRouteNameRef.current = name;
        }
      } else {
        const name = renameSavedRouteInLocal(route.id, newName);
        setSavedRoutes((prev) =>
          prev.map((r) =>
            r.id === route.id
              ? { ...r, name, updatedAtIso: new Date().toISOString() }
              : r,
          ),
        );
        if (loadedSavedRouteIdRef.current === route.id) {
          loadedSavedRouteNameRef.current = name;
        }
      }
    },
    [configured, user],
  );

  const handleDeleteSavedRoute = useCallback(
    async (route: SavedRoute) => {
      const isFirestore = !route.id.startsWith("local-");
      if (isFirestore) {
        if (!configured || !user) {
          throw new Error("이 경로를 삭제하려면 로그인이 필요합니다.");
        }
        await deleteSavedRouteFromFirestore(route.id);
      } else {
        deleteSavedRouteFromLocal(route.id);
      }
      setSavedRoutes((prev) => prev.filter((r) => r.id !== route.id));
      if (loadedSavedRouteIdRef.current === route.id) {
        loadedSavedRouteIdRef.current = null;
        loadedSavedRouteNameRef.current = null;
        setLastEndedWasAdhoc(null);
      }
    },
    [configured, user],
  );

  const handleSubmitPublicRouteRequest = useCallback(
    async (input: {
      publicTitle: string;
      publicSummary: string;
      experienceTags: ExperienceTagId[];
    }) => {
      if (!user) return;
      const route = publicRouteRequestModalRoute;
      if (!route) return;
      await createPublicRouteRequest(user, route, input);
      setPublicRouteRequestModalRoute(null);
      await refreshPublicRouteMeta();
    },
    [user, publicRouteRequestModalRoute, refreshPublicRouteMeta],
  );

  const onPublicRouteReviewQueueChanged = useCallback(() => {
    void refreshPublicRouteMeta();
    void refreshPublishedPublicCourseCatalog();
  }, [refreshPublicRouteMeta, refreshPublishedPublicCourseCatalog]);

  const enterBasicHub = useCallback(
    async (courseId: string) => {
      if (rideStatus !== "idle") {
        setRouteSummary("세션이 대기 상태일 때만 입문 코스를 불러올 수 있습니다. 종료 후 다시 시도하세요.");
        return;
      }
      setBasicStartLoading(true);
      setRouteSummary("공식 코스 불러오는 중…");
      try {
        if (user && basicActiveHubCourseId && basicActiveHubCourseId !== courseId) {
          await deleteCoursePresence(user.uid, basicActiveHubCourseId).catch(() => {
            /* noop */
          });
        }
        let payload = null;
        if (configured) {
          try {
            payload = await fetchCourseRoutePayload(courseId);
          } catch {
            payload = null;
          }
        }
        const resolved = payload ?? getBasicHubCoursePayload(courseId);
        const coords = resolved.geometry.coordinates;
        setRouteGeometry(resolved.geometry);
        setStartLngLat(coords[0] ?? null);
        setEndLngLat(coords[coords.length - 1] ?? null);
        setRouteWaypoints([]);
        setProfile(resolved.profile);
        setRouteDistanceMeters(resolved.distanceMeters);
        setRouteDurationSec(resolved.durationSec);
        resetRide();
        setRouteSummary(
          `${resolved.title} · 거리 ${(resolved.distanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(resolved.durationSec)}`,
        );
        loadedSavedRouteIdRef.current = null;
        loadedSavedRouteNameRef.current = null;
        setLastEndedWasAdhoc(null);
        basicStartHubLeftExplicitRef.current = false;
        const joinHubPresence =
          Boolean(user) && (BASIC_SHARED_HUB_IDS as readonly string[]).includes(resolved.id);
        setBasicActiveHubCourseId(joinHubPresence ? resolved.id : null);
        setActiveOfficialCourseId(resolved.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setRouteSummary(message);
      } finally {
        setBasicStartLoading(false);
      }
    },
    [rideStatus, configured, user, resetRide, basicActiveHubCourseId],
  );

  const leaveBasicHub = useCallback(async () => {
    handleEndRideRef.current();
    basicStartHubLeftExplicitRef.current = true;
    if (user && basicActiveHubCourseId) {
      await deleteCoursePresence(user.uid, basicActiveHubCourseId).catch(() => {
        /* noop */
      });
    }
    setBasicActiveHubCourseId(null);
  }, [user, basicActiveHubCourseId]);

  const generateRoute = useCallback(
    async (profileOverride?: RouteProfile) => {
      if (rideStatus !== "idle") {
        setRouteSummary("세션이 대기 상태일 때만 경로를 바꿀 수 있습니다. 종료 후 다시 시도하세요.");
        return;
      }
      if (!user) {
        setRouteSummary("경로 계산은 로그인(게스트 포함) 후에 사용할 수 있습니다.");
        return;
      }
      const start = startLngLat;
      const end = endLngLat;
      if (!start || !end) {
        setRouteSummary("");
        return;
      }

      const activeProfile = profileOverride ?? profile;

      setRouteLoading(true);
      setRouteSummary("경로 계산 중…");
      try {
        const functions = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
        const wps = routeWaypoints.slice(0, MAX_ROUTE_WAYPOINTS);
        const route = await fetchRouteByProfile(
          functions,
          user,
          start,
          end,
          activeProfile,
          wps.length ? wps : undefined,
        );
        setRouteGeometry(route.geometry);
        setRouteDistanceMeters(route.distance);
        setRouteDurationSec(route.duration);
        const viaNote = wps.length ? ` · 경과 ${wps.length}곳` : "";
        setRouteSummary(
          `거리 ${(route.distance / 1000).toFixed(2)} km / 예상 ${formatDuration(route.duration)}${viaNote}`,
        );
        resetRide();
        loadedSavedRouteIdRef.current = null;
        loadedSavedRouteNameRef.current = null;
        setLastEndedWasAdhoc(null);
        setActiveOfficialCourseId(null);
      } catch (e: unknown) {
        const fe = e as { code?: string; message?: string };
        const message =
          typeof fe?.message === "string"
            ? fe.message
            : e instanceof Error
              ? e.message
              : String(e);
        const hint =
          fe?.code === "functions/not-found"
            ? " Cloud Functions 가 배포되지 않았을 수 있습니다. 저장소 루트에서 firebase deploy --only functions 를 실행하고, MAPBOX_ACCESS_TOKEN 시크릿을 설정하세요."
            : "";
        setRouteSummary(message + hint);
        setRouteGeometry(null);
        setRouteDistanceMeters(0);
        setRouteDurationSec(0);
        setActiveOfficialCourseId(null);
      } finally {
        setRouteLoading(false);
      }
    },
    [rideStatus, startLngLat, endLngLat, routeWaypoints, profile, resetRide, user],
  );

  /** 로그아웃 후 맵 TR「로그인」— 이전 Google 팝업 취소로 남은 busy 를 지워 즉시 버튼을 활성화 */
  const openSignedOutAuthSheet = useCallback(() => {
    setBusy(false);
    setAuthSheetOpen(true);
  }, []);

  async function handleGuestStart() {
    if (!postSignoutMapSession) {
      setAuthSheetOpen(false);
    }
    setAuthPickCardHidden(true);
    setError(null);
    setBusy(true);
    try {
      await signInAnonymously(getFirebaseAuth());
    } catch (e: unknown) {
      setAuthPickCardHidden(false);
      if (postSignoutMapSession) setAuthSheetOpen(true);
      const message = e instanceof Error ? e.message : String(e);
      setError(`게스트(익명) 로그인 실패: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!postSignoutMapSession) {
      setAuthSheetOpen(false);
    }
    setAuthPickCardHidden(true);
    setError(null);
    // Google 팝업은 자체 로딩 UX — signInWithPopup 이 취소 후에도 수 초 pending 될 수 있어
    // busy 로 버튼을 막으면 로그인 시트가 5초+ 비활성처럼 보인다.
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const current = auth.currentUser;
      if (!current) {
        await signInWithPopup(auth, provider);
        return;
      }
      if (current.isAnonymous) {
        try {
          await linkWithPopup(current, provider);
        } catch (inner: unknown) {
          const ie = inner as { code?: string };
          // 같은 Google이 이미 다른 Firebase uid에 묶여 있으면, 두 번째 팝업 대신 실패 응답에 실린 credential 로 로그인
          if (
            ie.code === "auth/credential-already-in-use" ||
            ie.code === "auth/account-exists-with-different-credential"
          ) {
            const cred = GoogleAuthProvider.credentialFromError(inner as FirebaseError);
            if (cred) {
              await signInWithCredential(auth, cred);
            } else {
              await signInWithPopup(auth, provider);
            }
          } else {
            throw inner;
          }
        }
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: unknown) {
      if (isBenignAuthPopupCancel(e)) {
        setAuthPickCardHidden(false);
        if (postSignoutMapSession) setAuthSheetOpen(true);
        return;
      }
      setAuthPickCardHidden(false);
      if (postSignoutMapSession) setAuthSheetOpen(true);
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "이 Google 계정은 다른 로그인 방식과 연결되어 있습니다. 해당 방식으로 로그인하거나 Firebase 콘솔에서 계정을 확인해 주세요.",
        );
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  const handleCompleteNickname = useCallback(
    async (nickname: string) => {
      if (!user || user.isAnonymous) return;
      if (!isValidNickname(nickname)) return;
      setError(null);
      setBusy(true);
      try {
        await claimNicknameTransaction(user, nickname);
        await updateProfile(user, { displayName: nickname });
        await reload(user);
        startTransition(() => setFsSync({ state: "ok" }));
      } catch (e: unknown) {
        if (e instanceof NicknameTakenError) {
          setError(e.message);
        } else if (
          typeof e === "object" &&
          e !== null &&
          (e as { code?: string }).code === "aborted"
        ) {
          setError("다른 분이 먼저 같은 닉네임을 선택했습니다. 다른 닉네임으로 다시 시도해 주세요.");
        } else {
          const message = e instanceof Error ? e.message : String(e);
          setError(`닉네임 저장 실패: ${message}`);
        }
      } finally {
        setBusy(false);
      }
    },
    [user],
  );

  /** URL·MENU 방 전환 후 메뉴 닫고 지도에 집중(지명 선택과 동일한 습관) */
  const applyRoomFromDraft = useCallback(() => {
    const next = sanitizeRoomId(roomDraft);
    setRoomDraft(next);
    setRoomId(next);
    replaceRoomInUrl(next);
    setMenuOpen(false);
  }, [roomDraft]);

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

  function handleEndRide() {
    if (rideStatus === "idle") return;
    safeRideSpeechCancel();

    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    const caloriesEstimate = Math.round((rideMetrics.virtualDistanceMeters / 1000) * 30);
    /**
     * 격상 후보: 저장된 사용자 경로를 「불러와」 주행했거나, 같은 지도 상태로 「내 경로로 저장」 직후 주행했는가?
     * 새 경로 탐색·입문 코스 진입 시 ref 가 null 로 클리어되므로 여기 값이 살아 있다는 건 「이미 저장된 사용자 경로 그대로 탔음」 을 의미.
     */
    const savedRouteIdAtEnd = loadedSavedRouteIdRef.current;
    const savedRouteNameAtEnd = loadedSavedRouteNameRef.current;
    const completionRatio =
      routeDistanceMeters > 0
        ? Math.max(0, Math.min(1, rideMetrics.virtualDistanceMeters / routeDistanceMeters))
        : 0;

    const startPlaceSnapshot =
      startLngLat != null
        ? startPlaceLabel !== null && startPlaceLabel.trim().length > 0
          ? startPlaceLabel.trim()
          : formatLngLat(startLngLat)
        : undefined;
    const endPlaceSnapshot =
      endLngLat != null
        ? endPlaceLabel !== null && endPlaceLabel.trim().length > 0
          ? endPlaceLabel.trim()
          : formatLngLat(endLngLat)
        : undefined;

    const record: StoredRideSession = {
      id: crypto.randomUUID(),
      endedAt: new Date().toISOString(),
      elapsedSec,
      distanceMeters: rideMetrics.virtualDistanceMeters,
      avgSpeedKmh:
        elapsedSec > 0
          ? (rideMetrics.virtualDistanceMeters / 1000) / (elapsedSec / 3600)
          : 0,
      caloriesEstimate,
      routeDistanceMeters,
      routeDurationSec,
      userRouteId: savedRouteIdAtEnd,
      routeName: savedRouteNameAtEnd,
      completionRatio,
      startPlaceLabel: startPlaceSnapshot,
      endPlaceLabel: endPlaceSnapshot,
    };
    const next = [record, ...loadRideSessions()].slice(0, 50);
    saveRideSessions(next);
    setRecentSessions(next);

    /**
     * 격상 정책:
     *  - 저장된 사용자 경로(불러오기 또는 저장 직후 동일 경로로 주행) → 주행 종료 시 completed=1, expiresAt=null 로 격상
     *  - ad-hoc 경로(저장 안 한 채 주행) → rides 만 적재 + 토스트에 「사용자 경로로 저장」 액션 노출
     *  - 격상은 「완주 여부 무관」: 일시정지 후 수동 종료여도 격상 (시니어 정책: 1회 탄 적이 있으면 보존 가치 있음)
     */
    if (configured && user) {
      void (async () => {
        try {
          let sessionForPersist: StoredRideSession = record;
          const token = MAPBOX_TOKEN.trim();
          if (token && startLngLat && endLngLat) {
            try {
              const [sName, eName] = await Promise.all([
                fetchMapboxReverseGeocodePlaceName(startLngLat, token),
                fetchMapboxReverseGeocodePlaceName(endLngLat, token),
              ]);
              const sFromApi = sName?.trim();
              const eFromApi = eName?.trim();
              if (sFromApi || eFromApi) {
                sessionForPersist = {
                  ...record,
                  startPlaceLabel: sFromApi || record.startPlaceLabel,
                  endPlaceLabel: eFromApi || record.endPlaceLabel,
                };
                const rows = loadRideSessions().map((r) =>
                  r.id === record.id ? sessionForPersist : r,
                );
                saveRideSessions(rows);
                setRecentSessions(rows);
              }
            } catch {
              /* noop */
            }
          }
          const rideId = await saveRideSessionToFirestore({
            userId: user.uid,
            roomId,
            profile,
            session: sessionForPersist,
          });
          if (savedRouteIdAtEnd && !savedRouteIdAtEnd.startsWith("local-")) {
            try {
              await promoteSavedRouteInFirestore({
                userId: user.uid,
                routeId: savedRouteIdAtEnd,
                rideId,
              });
              setSavedRoutes((prev) =>
                prev.map((r) =>
                  r.id === savedRouteIdAtEnd
                    ? {
                        ...r,
                        completed: 1,
                        completedAtIso: new Date().toISOString(),
                        expiresAtIso: null,
                        lastRideId: rideId,
                        updatedAtIso: new Date().toISOString(),
                      }
                    : r,
                ),
              );
            } catch (e) {
              console.warn("[savedRoutes] 격상 실패", e);
            }
          } else if (savedRouteIdAtEnd) {
            // 로컬(게스트) 경로
            promoteSavedRouteInLocal({ routeId: savedRouteIdAtEnd, rideId });
            setSavedRoutes(loadSavedRoutesFromLocal());
          } else if (
            routeGeometry &&
            routeGeometry.coordinates.length >= 2 &&
            startLngLat &&
            endLngLat &&
            routeDistanceMeters > 0
          ) {
            // ad-hoc 주행 → 토스트 액션으로 「사용자 경로로 저장」 가능하도록 컨텍스트 보관
            setLastEndedWasAdhoc({
              distanceMeters: routeDistanceMeters,
              durationSec: routeDurationSec,
              geometry: routeGeometry,
              startLngLat,
              endLngLat,
              waypoints: routeWaypoints.slice(0, MAX_ROUTE_WAYPOINTS),
              profile,
              rideId,
            });
          }
        } catch {
          // Firestore 저장 실패 시 로컬 저장본은 유지한다.
        }
      })();
    } else if (savedRouteIdAtEnd) {
      // 게스트(미로그인) 환경: rides 없이도 로컬 격상은 수행
      promoteSavedRouteInLocal({
        routeId: savedRouteIdAtEnd,
        rideId: record.id,
      });
      setSavedRoutes(loadSavedRoutesFromLocal());
    } else if (
      routeGeometry &&
      routeGeometry.coordinates.length >= 2 &&
      startLngLat &&
      endLngLat &&
      routeDistanceMeters > 0
    ) {
      setLastEndedWasAdhoc({
        distanceMeters: routeDistanceMeters,
        durationSec: routeDurationSec,
        geometry: routeGeometry,
        startLngLat,
        endLngLat,
        waypoints: routeWaypoints.slice(0, MAX_ROUTE_WAYPOINTS),
        profile,
        rideId: null,
      });
    }

    /** Firebase 미연동·비로그인: 클라우드 저장 없이도 역지오코딩으로 로컬 기록만 보강 */
    if (!(configured && user)) {
      const token = MAPBOX_TOKEN.trim();
      if (token && startLngLat && endLngLat) {
        void (async () => {
          try {
            const [sName, eName] = await Promise.all([
              fetchMapboxReverseGeocodePlaceName(startLngLat, token),
              fetchMapboxReverseGeocodePlaceName(endLngLat, token),
            ]);
            const sFromApi = sName?.trim();
            const eFromApi = eName?.trim();
            if (!sFromApi && !eFromApi) return;
            const sessionForPersist: StoredRideSession = {
              ...record,
              startPlaceLabel: sFromApi || record.startPlaceLabel,
              endPlaceLabel: eFromApi || record.endPlaceLabel,
            };
            const rows = loadRideSessions().map((r) =>
              r.id === record.id ? sessionForPersist : r,
            );
            saveRideSessions(rows);
            setRecentSessions(rows);
          } catch {
            /* noop */
          }
        })();
      }
    }

    // 격상 후보는 한 번 사용 후 비워 다음 사이클을 깨끗하게 시작
    loadedSavedRouteIdRef.current = null;
    loadedSavedRouteNameRef.current = null;

    setRideStatus("idle");
    // 완료 직후 패널의 경과·거리·평균 속도는 유지한다. 리셋은 「주행 시작」·경로 재계산·저장 경로 불러오기·입문 코스 진입 등에서만 수행한다.
  }

  handleEndRideRef.current = handleEndRide;

  /** 도착 시 결과 시트가 열림. 닫기는 사용자 명시 액션. */
  useEffect(() => {
    if (arrivalToastTick === 0) return;
    setSummarySheetVisible(true);
  }, [arrivalToastTick]);

  /** ad-hoc 저장 안내가 새로 생기면 결과 시트도 함께 노출 */
  useEffect(() => {
    if (lastEndedWasAdhoc) setSummarySheetVisible(true);
  }, [lastEndedWasAdhoc]);

  /** 로비·코스 정리 후 Firebase 로그아웃 — 맵은 유지하고 우측 상단「로그인」으로 재인증(게스트·Google 공통) */  async function handleServiceExit() {
    setError(null);
    setBusy(true);
    try {
      if (rideStatus !== "idle") {
        setRideStatus("idle");
        resetRide();
      }
      if (user) {
        await deleteLobbyPresence(user.uid, roomId).catch(() => {
          /* noop */
        });
        for (const hid of BASIC_SHARED_HUB_IDS) {
          await deleteCoursePresence(user.uid, hid).catch(() => {
            /* noop */
          });
        }
      }
      setBasicActiveHubCourseId(null);
      setRecentSessions(loadRideSessions());
      setAuthSheetOpen(false);
      try {
        sessionStorage.setItem(POST_SIGNOUT_MAP_SESSION_KEY, "1");
      } catch {
        /* noop */
      }
      setPostSignoutMapSession(true);
      try {
        await signOut(getFirebaseAuth());
      } catch (signOutErr) {
        try {
          sessionStorage.removeItem(POST_SIGNOUT_MAP_SESSION_KEY);
        } catch {
          /* noop */
        }
        setPostSignoutMapSession(false);
        throw signOutErr;
      }
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

  useEffect(() => {
    if (!startLngLat) {
      setStartPlaceLabel(null);
      return;
    }
    const token = MAPBOX_TOKEN.trim();
    if (!token) {
      setStartPlaceLabel(formatLngLat(startLngLat));
      return;
    }
    const ac = new AbortController();
    setStartPlaceLabel(null);
    void (async () => {
      try {
        const name = await fetchMapboxReverseGeocodePlaceName(startLngLat, token, ac.signal);
        if (ac.signal.aborted) return;
        setStartPlaceLabel((name && name.trim()) || formatLngLat(startLngLat));
      } catch {
        if (ac.signal.aborted) return;
        setStartPlaceLabel(formatLngLat(startLngLat));
      }
    })();
    return () => ac.abort();
  }, [startLngLat]);

  useEffect(() => {
    if (!endLngLat) {
      setEndPlaceLabel(null);
      return;
    }
    const token = MAPBOX_TOKEN.trim();
    if (!token) {
      setEndPlaceLabel(formatLngLat(endLngLat));
      return;
    }
    const ac = new AbortController();
    setEndPlaceLabel(null);
    void (async () => {
      try {
        const name = await fetchMapboxReverseGeocodePlaceName(endLngLat, token, ac.signal);
        if (ac.signal.aborted) return;
        setEndPlaceLabel((name && name.trim()) || formatLngLat(endLngLat));
      } catch {
        if (ac.signal.aborted) return;
        setEndPlaceLabel(formatLngLat(endLngLat));
      }
    })();
    return () => ac.abort();
  }, [endLngLat]);

  useEffect(() => {
    const wps = routeWaypoints;
    const snapshot = JSON.stringify(wps);
    const ac = new AbortController();

    if (wps.length === 0) {
      setWaypointPlaceLabels([]);
      return () => ac.abort();
    }

    const token = MAPBOX_TOKEN.trim();
    if (!token) {
      setWaypointPlaceLabels(wps.map(formatLngLat));
      return () => ac.abort();
    }

    setWaypointPlaceLabels(wps.map(() => null));

    void (async () => {
      try {
        const resolved = await Promise.all(
          wps.map(async (wp) => {
            try {
              const name = await fetchMapboxReverseGeocodePlaceName(wp, token, ac.signal);
              if (ac.signal.aborted) return formatLngLat(wp);
              return (name && name.trim()) || formatLngLat(wp);
            } catch {
              return formatLngLat(wp);
            }
          }),
        );
        if (ac.signal.aborted) return;
        if (JSON.stringify(routeWaypointsGeocodeRef.current) !== snapshot) return;
        setWaypointPlaceLabels(resolved);
      } catch {
        if (ac.signal.aborted) return;
        if (JSON.stringify(routeWaypointsGeocodeRef.current) !== snapshot) return;
        setWaypointPlaceLabels(wps.map(formatLngLat));
      }
    })();

    return () => ac.abort();
  }, [routeWaypoints]);

  const startLabel = !startLngLat
    ? "미설정"
    : startPlaceLabel === null
      ? "주소 불러오는 중…"
      : startPlaceLabel;
  const endLabel = !endLngLat
    ? "미설정"
    : endPlaceLabel === null
      ? "주소 불러오는 중…"
      : endPlaceLabel;

  const waypointLabelsForPanel = useMemo(
    () =>
      routeWaypoints.map((wp, i) => {
        const lab = waypointPlaceLabels[i];
        if (lab === null) return "주소 불러오는 중…";
        if (typeof lab === "string") return lab;
        return formatLngLat(wp);
      }),
    [routeWaypoints, waypointPlaceLabels],
  );

  /** Firebase 미설정이거나 인증 준비 완료 후 — 로비·입문 코스 UI가 숨겨지지 않도록 메인 워크스페이스 표시 */
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
  const rideLocked = stage === "riding" || stage === "paused";
  /** 개발 서버에서만 주행 중에도 경로 메뉴(드로어) 유지 — 프로덕션에서는 기존처럼 잠금 */
  const menuPanelLockedDuringRide = rideLocked && !import.meta.env.DEV;

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

  const applyRouteProfileFromMapPopup = useCallback(
    (p: RouteProfile) => {
      if (rideLocked) return;
      setProfile(p);
      void generateRoute(p);
    },
    [rideLocked, generateRoute],
  );

  // ===== Map-first 핸들러 =====
  function handleClearPins() {
    if (rideLocked) return;
    setStartLngLat(null);
    setEndLngLat(null);
    setRouteWaypoints([]);
    setRouteGeometry(null);
    setRouteDistanceMeters(0);
    setRouteDurationSec(0);
    setRouteSummary("");
    loadedSavedRouteIdRef.current = null;
    loadedSavedRouteNameRef.current = null;
    setActiveOfficialCourseId(null);
  }

  function handleMenuPlacePick(lngLat: LngLat, _placeName: string, bbox: [number, number, number, number] | null) {
    /** `liveForMap` 추적 jumpTo 가 flyTo 를 덮어쓰지 않도록 */
    setFollowMode("free");
    cameraJumpSeqRef.current += 1;
    setExternalCameraJump({
      lngLat,
      bbox,
      requestId: cameraJumpSeqRef.current,
    });
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
    if (mapZoom > MAP_ZOOM_WORLD_ACTIVITY_MAX || !worldHudHint) return null;
    return worldHudHint;
  }, [mapZoom, worldHudHint]);

  const mapHudRidePresence = useMemo(() => {
    if (!configured || !user) return null;
    const courseTitle = basicActiveHubCourseId
      ? getBasicHubCoursePayload(basicActiveHubCourseId).title.trim() || "입문 코스"
      : null;
    const coursePeerNames = coursePeerMarkers
      .map((p) => (p.label ?? "동행").trim())
      .filter((n) => n.length > 0);
    const lobbyMembers = lobbyRoomSession.rows.map((r) => ({
      key: r.uid,
      display: r.displayName?.trim() || r.uid.slice(0, 8),
      isSelf: r.uid === user.uid,
      active: isLobbyMemberActive(r.lastSeenAtMs),
    }));
    const lobbyError = lobbyRoomSession.error;
    return {
      lobbyEnabled: true,
      roomId: sanitizeRoomId(roomId),
      lobbyMembers,
      lobbyError,
      courseTitle,
      coursePeerNames,
    };
  }, [
    configured,
    user,
    roomId,
    lobbyRoomSession.rows,
    lobbyRoomSession.error,
    basicActiveHubCourseId,
    coursePeerMarkers,
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
          coverageOverlayMode={coverageOverlayMode}
          mapillaryClientToken={mapillaryTokenConfigured ? MAPILLARY_CLIENT_TOKEN : null}
          routeProfile={profile}
          onRouteProfile={applyRouteProfileFromMapPopup}
          onClearRoute={handleClearPins}
          onSelectPoint={(type, lngLat, waypointSlot) => {
            if (rideLocked) return;
            setActiveOfficialCourseId(null);
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
          lobbySpectatorDots={spectatorDots}
          lobbySpectatorRoutes={spectatorRouteGeometries}
        />

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
          idleHintMessage="입문: MENU → 입문 코스 → ▶"
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
        locked={menuPanelLockedDuringRide}
        onClose={() => setMenuOpen(false)}
        onOpenSettings={openRideSettingsPanel}
      >
        <RoomSwitcher
          roomDraft={roomDraft}
          onDraftChange={setRoomDraft}
          activeRoomId={sanitizeRoomId(roomId)}
          onApply={applyRoomFromDraft}
          presenceSyncPossible={Boolean(configured && user)}
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
          authGuest={Boolean(user?.isAnonymous)}
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
          progressRatio={courseLiveProgressRatio}
          myLiveLngLat={liveForMap}
          onPeersChange={onCoursePeersChange}
          onLiveRiderNametagChange={setLiveRiderNametag}
        />
      ) : null}

      {configured && user ? (
        <LobbyPresence user={user} roomId={roomId} rows={lobbyRoomSession.rows} error={lobbyRoomSession.error} />
      ) : null}
    </div>
  );
}
