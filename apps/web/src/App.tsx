import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getFirebaseApp, getFirebaseAuth, isFirebaseConfigured } from "./lib/firebase";
import {
  BASIC_SHARED_HUB_IDS,
  BASIC_SHARED_HUB_SUMMARIES,
  ensureBasicCoursesSeeded,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
  matchBasicSharedHubCourseId,
  routeGeometryMatchesBasicSharedHub,
} from "./lib/firestoreCourses";
import { deleteCoursePresence } from "./lib/firestoreCoursePresence";
import { deleteLobbyPresence, sanitizeRoomId } from "./lib/firestoreLobby";
import {
  backfillRideSessionsToFirestore,
  loadRecentRideSessionsFromFirestore,
  saveRideSessionToFirestore,
} from "./lib/firestoreRides";
import type { LineStringGeometry, LngLat } from "./lib/geo";
import { formatLngLat, getPointOnRouteByDistance } from "./lib/geo";
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
import { fetchRouteByProfile, formatDuration, type RouteProfile } from "./services/mapboxDirections";
import { getFunctions } from "firebase/functions";
import "./App.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
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
  const [profile, setProfile] = useState<RouteProfile>("cycling");
  const [routeGeometry, setRouteGeometry] = useState<LineStringGeometry | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(0);
  const [routeDurationSec, setRouteDurationSec] = useState(0);
  const [routeSummary, setRouteSummary] = useState("지도를 클릭한 뒤 팝업에서 출발지/도착지를 선택하세요.");
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState(MAP_STYLE_OPTIONS[3].value);
  const [mapZoom, setMapZoom] = useState(12);
  const [followMode, setFollowMode] = useState<FollowMode>("keep");
  const [enable3D, setEnable3D] = useState(true);
  const [speedKmh, setSpeedKmh] = useState(25);
  const [recentSessions, setRecentSessions] = useState<StoredRideSession[]>(() =>
    loadRideSessions(),
  );
  /** 입문 허브 동시 주행에 참여 중인 코스 document id(null 이면 미참여) */
  const [basicActiveHubCourseId, setBasicActiveHubCourseId] = useState<string | null>(null);
  const [basicStartLoading, setBasicStartLoading] = useState(false);
  const basicStartHubJoined = basicActiveHubCourseId !== null;
  const [coursePeerMarkers, setCoursePeerMarkers] = useState<MapPeerMarker[]>([]);
  /** 입문 허브 동행에서 계산된 내 네임태그(없으면 단독 주행용 표시로 대체) */
  const [liveRiderNametag, setLiveRiderNametag] = useState<string | null>(null);
  /** false면 LobbyPresence 마운트 안 함(로비 문서·하트비트 중단). 게스트 id는 유지. */
  const [lobbyParticipationEnabled, setLobbyParticipationEnabled] = useState(true);
  const lobbyPresenceUidRef = useRef<string | null>(null);
  /** true면 입문 코스 경로가 있어도 동행 허브 자동 참여 안 함(「나가기」 후) */
  const basicStartHubLeftExplicitRef = useRef(false);

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
    if (lobbyPresenceUidRef.current !== user.uid) {
      lobbyPresenceUidRef.current = user.uid;
      startTransition(() => setLobbyParticipationEnabled(true));
    }
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

  /** 로그아웃 후 로비 기본값 초기화(uid 전환 시 참여 플래그는 아래 user effect에서 처리) */
  useEffect(() => {
    if (user) return;
    lobbyPresenceUidRef.current = null;
    startTransition(() => setLobbyParticipationEnabled(true));
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

  const enterBasicHub = useCallback(
    async (courseId: string) => {
      if (rideStatus !== "idle") {
        setRouteSummary("세션이 대기 상태일 때만 입문 코스를 불러올 수 있습니다. 종료 후 다시 시도하세요.");
        return;
      }
      setBasicStartLoading(true);
      setRouteSummary("입문 코스 불러오는 중…");
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
        setProfile("cycling");
        setRouteDistanceMeters(resolved.distanceMeters);
        setRouteDurationSec(resolved.durationSec);
        resetRide();
        setRouteSummary(
          `${resolved.title} · 거리 ${(resolved.distanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(resolved.durationSec)}`,
        );
        basicStartHubLeftExplicitRef.current = false;
        if (user) {
          setBasicActiveHubCourseId(resolved.id);
        } else {
          setBasicActiveHubCourseId(null);
        }
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
    basicStartHubLeftExplicitRef.current = true;
    if (user && basicActiveHubCourseId) {
      await deleteCoursePresence(user.uid, basicActiveHubCourseId).catch(() => {
        /* noop */
      });
    }
    setBasicActiveHubCourseId(null);
  }, [user, basicActiveHubCourseId]);

  const generateRoute = useCallback(async () => {
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
      setRouteSummary("지도를 클릭해 출발지와 도착지를 먼저 선택하세요.");
      return;
    }

    setRouteLoading(true);
    setRouteSummary("경로 계산 중…");
    try {
      const functions = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
      const route = await fetchRouteByProfile(functions, user, start, end, profile);
      setRouteGeometry(route.geometry);
      setRouteDistanceMeters(route.distance);
      setRouteDurationSec(route.duration);
      setRouteSummary(
        `거리 ${(route.distance / 1000).toFixed(2)} km / 예상 ${formatDuration(route.duration)}`,
      );
      resetRide();
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
    } finally {
      setRouteLoading(false);
    }
  }, [rideStatus, startLngLat, endLngLat, profile, resetRide, user]);

  async function handleGuestStart() {
    setError(null);
    setBusy(true);
    try {
      await signInAnonymously(getFirebaseAuth());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`게스트(익명) 로그인 실패: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setBusy(true);
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
      const err = e as { code?: string; message?: string };
      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "이 Google 계정은 다른 로그인 방식과 연결되어 있습니다. 해당 방식으로 로그인하거나 Firebase 콘솔에서 계정을 확인해 주세요.",
        );
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
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

  function joinRoomFromDraft() {
    const next = sanitizeRoomId(roomDraft);
    setRoomId(next);
    setRoomDraft(next);
    replaceRoomInUrl(next);
    setLobbyParticipationEnabled(true);
  }

  function handleStartRide() {
    if (!routeGeometry || rideStatus !== "idle") return;
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

    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    const caloriesEstimate = Math.round((rideMetrics.virtualDistanceMeters / 1000) * 30);
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
    };
    const next = [record, ...loadRideSessions()].slice(0, 50);
    saveRideSessions(next);
    setRecentSessions(next);
    if (configured && user) {
      void saveRideSessionToFirestore({
        userId: user.uid,
        roomId,
        profile,
        session: record,
      }).catch(() => {
        // Firestore 저장 실패 시 로컬 저장본은 유지한다.
      });
    }

    setRideStatus("idle");
    resetRide();
  }

  /** 로비 실시간 참여만 중단(코스 동행·Firebase 세션은 유지) */
  async function handleLeaveLobbyOnly() {
    if (!user) return;
    setError(null);
    try {
      await deleteLobbyPresence(user.uid, roomId).catch(() => {
        /* noop */
      });
      setLobbyParticipationEnabled(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** 로비·코스 정리 후 Firebase 로그아웃 → 시작 화면으로 복귀(게스트·Google 공통) */
  async function handleServiceExit() {
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
      setLobbyParticipationEnabled(false);
      setRecentSessions(loadRideSessions());
      await signOut(getFirebaseAuth());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  /** 일시정지 직후 RAF가 멈추면 liveLngLat 가 잠깐 비는 구간이 있어, 가상 거리로 보정 */
  const liveForMap: LngLat | null = useMemo(() => {
    if (rideStatus === "idle") return null;
    if (rideMetrics.liveLngLat) return rideMetrics.liveLngLat;
    if (routeGeometry && routeDistanceMeters > 0) {
      return getPointOnRouteByDistance(
        routeGeometry,
        Math.min(rideMetrics.virtualDistanceMeters, routeDistanceMeters),
      );
    }
    return null;
  }, [
    rideStatus,
    rideMetrics.liveLngLat,
    rideMetrics.virtualDistanceMeters,
    routeGeometry,
    routeDistanceMeters,
  ]);
  const startLabel = startLngLat ? formatLngLat(startLngLat) : "미설정";
  const endLabel = endLngLat ? formatLngLat(endLngLat) : "미설정";

  /** Firebase 미설정이거나 인증 준비 완료 후 — 로비·입문 코스 UI가 숨겨지지 않도록 메인 워크스페이스 표시 */
  const rideWorkspaceOpen = !configured || (configured && authInitialized);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <h1 className="title">BOXCYCLE</h1>
          <p className="subtitle">
            Vite + React + TypeScript · Firebase · Mapbox
          </p>
        </div>

        {!configured ? (
          <section className="card card--compact">
            <p className="lead tight">
              Firebase 환경 변수가 없습니다.{" "}
              <code className="inline">apps/web/.env</code> 를 확인하세요.
            </p>
          </section>
        ) : (
          <section
            className={`card card--compact auth-card${
              user && !user.isAnonymous && fsSync.state === "awaiting_nickname" ? " auth-card--wide" : ""
            }`}
          >
            {!authInitialized ? (
              <div className="auth-row">
                <p className="lead tight">Firebase 인증 연결 확인 중…</p>
              </div>
            ) : user ? (
              user.isAnonymous ? (
                <div className="auth-row">
                  <div className="auth-info">
                    <p className="lead tight">
                      <strong>게스트로 이용 중</strong> ({user.uid.slice(0, 8)}…)
                    </p>
                    <p className="meta tight">
                      로비 나가기·입문 코스 동행 나가기·서비스 종료는 서로 다릅니다. Google을 연결하면 같은 uid로
                      기록이 이어집니다.
                    </p>
                    {fsSync.state === "ok" ? <p className="fs-ok">게스트 세션 활성</p> : null}
                  </div>
                  <div className="auth-actions">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => void handleGoogleSignIn()}
                    >
                      {busy ? "처리 중…" : "Google 계정 연결"}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => void handleServiceExit()}
                      title="로비·코스 presence를 정리한 뒤 로그아웃합니다. 게스트도 다음 접속 시 다시 시작 화면으로 돌아옵니다."
                    >
                      서비스 종료
                    </button>
                  </div>
                </div>
              ) : fsSync.state === "awaiting_nickname" ? (
                <div className="auth-row auth-row--signup-nickname">
                  <div className="auth-info auth-info--signup">
                    <p className="meta tight">
                      로그인 계정: <strong>{user.email ?? user.uid}</strong>
                    </p>
                    <SignUpNicknameCard busy={busy} onSubmit={handleCompleteNickname} />
                    <p className="fs-hint">닉네임을 저장하면 회원가입이 완료됩니다.</p>
                  </div>
                  <div className="auth-actions">
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => void handleServiceExit()}
                      title="가입을 중단하고 로그아웃합니다."
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              ) : (
                <div className="auth-row">
                  <div className="auth-info">
                    <p className="lead tight">
                      <strong>{user.displayName ?? user.email ?? user.uid}</strong>
                    </p>
                    <p className="meta tight">{user.uid}</p>
                    {fsSync.state === "syncing" ? (
                      <p className="fs-hint">Firestore 동기화 중…</p>
                    ) : null}
                    {fsSync.state === "ok" ? <p className="fs-ok">Firestore 프로필 저장됨</p> : null}
                    {fsSync.state === "error" ? (
                      <p className="fs-err" title={fsSync.message}>
                        Firestore 오류: {fsSync.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="auth-actions">
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => void handleServiceExit()}
                      title="로비·코스 presence를 정리한 뒤 로그아웃합니다. 게스트도 다음 접속 시 다시 시작 화면으로 돌아옵니다."
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="auth-row auth-row--gate">
                <div className="auth-info">
                  <p className="lead tight">시작 방식을 선택하세요</p>
                  <p className="meta tight auth-gate-hint">
                    게스트 계정은 「게스트로 시작」을 눌렀을 때만 만들어져, 페이지만 열어도 익명 사용자가 늘어나지
                    않습니다. 종료 후에는 다시 이 화면에서 선택합니다. Gmail 회원가입·로그인 모두 Google 인증 후
                    닉네임을 한 번 설정합니다.
                  </p>
                </div>
                <div className="auth-actions auth-actions--gate">
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void handleGuestStart()}
                  >
                    {busy ? "처리 중…" : "게스트로 시작"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void handleGoogleSignIn()}
                  >
                    {busy ? "처리 중…" : "Google로 회원가입"}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void handleGoogleSignIn()}
                  >
                    {busy ? "처리 중…" : "Google로 로그인"}
                  </button>
                </div>
              </div>
            )}
            {error ? <p className="error tight">{error}</p> : null}
          </section>
        )}
      </header>

      {rideWorkspaceOpen ? (
        configured && user ? (
          <div className="lobby-strip">
            <div className="room-bar">
              <label className="room-bar__label" htmlFor="roomDraft">
                방 ID
              </label>
              <input
                id="roomDraft"
                className="room-bar__input"
                type="text"
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                value={roomDraft}
                onChange={(e) => setRoomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinRoomFromDraft();
                }}
                placeholder="예: demo-ride"
              />
              <button type="button" className="btn primary room-bar__btn" onClick={joinRoomFromDraft}>
                입장
              </button>
              {lobbyParticipationEnabled ? (
                <button
                  type="button"
                  className="btn secondary room-bar__btn"
                  disabled={busy}
                  onClick={() => void handleLeaveLobbyOnly()}
                >
                  로비 나가기
                </button>
              ) : null}
              <span className="room-bar__hint">
                주소창 URL을 복사해 공유하면 같은 방(`?room=`)으로 입장합니다. 방 ID는 영문·숫자·`_` `-` 만,
                최대 64자입니다.
              </span>
            </div>
            {lobbyParticipationEnabled ? (
              <LobbyPresence user={user} roomId={roomId} />
            ) : (
              <section className="lobby-presence lobby-presence--paused" aria-label="로비 참여 중지됨">
                <div className="lobby-presence__head">
                  <strong>실시간 로비</strong>
                  <span className="lobby-presence__meta">참여 안 함 · 하트비트 없음</span>
                </div>
                <p className="lobby-presence__empty">
                  로비 목록에서 빠져 있습니다. 「로비 참여」 또는 방 「입장」으로 다시 연결할 수 있습니다.
                </p>
                <div className="lobby-presence__rejoin">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    onClick={() => setLobbyParticipationEnabled(true)}
                  >
                    로비 참여
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="lobby-strip">
            <section className="lobby-presence lobby-presence--paused" aria-label="로비 안내">
              <div className="lobby-presence__head">
                <strong>실시간 로비</strong>
                <span className="lobby-presence__meta">
                  {!configured ? "Firebase 미설정 · 오프라인 미리보기" : "로그인 전 · 목록 비활성"}
                </span>
              </div>
              <p className="lobby-presence__empty">
                {!configured ? (
                  <>
                    <code className="inline">apps/web/.env</code> 에 Firebase 값을 넣으면 방 ID·접속자 목록이
                    살아납니다. 지금은 아래 <strong>입문 코스</strong>만 내장 경로로 불러와 주행해 볼 수 있습니다.
                  </>
                ) : (
                  <>
                    상단에서 <strong>게스트로 시작</strong> 또는 <strong>Google로 로그인</strong>하면 방·로비
                    하트비트가 켜집니다. 그 전에도 왼쪽 패널에서 입문 코스 입장·지도 주행은 이용할 수 있습니다.
                  </>
                )}
              </p>
            </section>
          </div>
        )
      ) : null}

      {configured && user && basicActiveHubCourseId ? (
        <div className="lobby-strip">
          <CourseSharedPresence
            user={user}
            courseId={basicActiveHubCourseId}
            title={getBasicHubCoursePayload(basicActiveHubCourseId).title}
            isRiding={rideStatus !== "idle"}
            myLiveLngLat={liveForMap}
            onPeersChange={onCoursePeersChange}
            onLiveRiderNametagChange={setLiveRiderNametag}
          />
        </div>
      ) : null}

      {rideWorkspaceOpen ? (
        <>
          {configured && authInitialized && !user ? (
            <div className="pre-ride-strip">
              <section className="card card--compact pre-ride-strip__card" aria-label="시작 전 안내">
                <p className="lead tight">
                  실시간 로비·동시 주행을 쓰려면 상단에서 <strong>게스트로 시작</strong> 또는{" "}
                  <strong>Google로 로그인</strong>하세요. 그 전에도 아래에서 입문 코스·지도를 바로 써 볼 수 있습니다.
                </p>
                <p className="meta tight">
                  입문 코스 동행·로비는 로그인 후 활성화됩니다. 맞춤 경로(출발·도착 클릭 후 경로 생성)는 게스트 또는
                  Google 세션이 필요합니다.
                </p>
              </section>
            </div>
          ) : null}
          <main className="route-main" aria-label="경로·지도">
            <RideRoutePanel
              startLabel={startLabel}
              endLabel={endLabel}
              profile={profile}
              onProfile={setProfile}
              routeSummary={routeSummary}
              routeLoading={routeLoading}
              onGenerateRoute={() => void generateRoute()}
              mapStyle={mapStyle}
              mapStyleOptions={MAP_STYLE_OPTIONS}
              onMapStyle={setMapStyle}
              followMode={followMode}
              onFollowMode={setFollowMode}
              enable3D={enable3D}
              onEnable3D={setEnable3D}
              mapZoom={mapZoom}
              onMapZoom={setMapZoom}
              hasRoute={Boolean(routeGeometry)}
              speedKmh={speedKmh}
              onSpeedKmh={setSpeedKmh}
              sessionStatus={rideStatus}
              onStartRide={handleStartRide}
              onPause={handlePause}
              onResume={handleResume}
              onEndRide={handleEndRide}
              elapsedLabel={formatElapsedFromMs(rideMetrics.accumulatedMs)}
              distanceKm={(rideMetrics.virtualDistanceMeters / 1000).toFixed(2)}
              avgSpeedLabel={avgSpeedLabel}
              recentSessions={recentSessions}
              basicSharedHubs={BASIC_SHARED_HUB_SUMMARIES}
              basicActiveHubCourseId={basicActiveHubCourseId}
              basicStartLoading={basicStartLoading}
              basicStartHubJoined={basicStartHubJoined}
              authGuest={Boolean(user?.isAnonymous)}
              onEnterBasicHub={(courseId) => void enterBasicHub(courseId)}
              onLeaveBasicHub={() => void leaveBasicHub()}
            />
            <div className="map-stage map-stage--in-route">
              <MapView
                accessToken={MAPBOX_TOKEN || undefined}
                routeGeometry={routeGeometry}
                startLngLat={startLngLat}
                endLngLat={endLngLat}
                liveLngLat={liveForMap}
                liveRiderMotion={
                  rideStatus === "idle"
                    ? null
                    : { sessionStatus: rideStatus, speedKmh }
                }
                liveRiderNametag={resolvedLiveRiderNametag}
                peerMarkers={coursePeerMarkers}
                mapStyle={mapStyle}
                mapZoom={mapZoom}
                followMode={followMode}
                enable3D={enable3D}
                onMapZoom={setMapZoom}
                onSelectPoint={(type, lngLat) => {
                  if (rideStatus !== "idle") {
                    setRouteSummary("주행 중에는 출발지/도착지를 바꿀 수 없습니다. 세션 종료 후 다시 선택하세요.");
                    return;
                  }
                  if (type === "start") {
                    setStartLngLat(lngLat);
                    setRouteSummary("출발지가 지도 클릭으로 설정되었습니다.");
                    return;
                  }
                  setEndLngLat(lngLat);
                  setRouteSummary("도착지가 지도 클릭으로 설정되었습니다.");
                }}
              />
            </div>
          </main>
        </>
      ) : configured && !authInitialized ? (
        <main className="route-main route-main--gate" aria-label="연결 중">
          <p className="lead tight" style={{ padding: "1rem 1.25rem" }}>
            Firebase 인증 연결 확인 중…
          </p>
        </main>
      ) : null}

      <footer className="footer">
        레거시 상세(3D·고도·지명검색 등)는 저장소 루트{" "}
        <code className="inline">index.html</code> · <code className="inline">app.js</code> 참고. Directions는
        Cloud Functions 프록시를 사용합니다. 지도 타일용 Mapbox 토큰만 클라이언트에 둡니다.
      </footer>
    </div>
  );
}
