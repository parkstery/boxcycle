import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { CourseSharedPresence } from "./components/CourseSharedPresence";
import { LobbyPresence } from "./components/LobbyPresence";
import { MapView, type MapPeerMarker } from "./components/MapView";
import { RideRoutePanel, type FollowMode } from "./components/RideRoutePanel";
import { getFirebaseAuth, isFirebaseConfigured } from "./lib/firebase";
import {
  BASIC_START_COURSE_ID,
  ensureBasicCoursesSeeded,
  fetchCourseRoutePayload,
  getBasicStartCourseStatic,
  isGeometryBasicStartHub,
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
import { syncUserProfileToFirestore } from "./lib/firestoreUser";
import { useVirtualRideSession } from "./hooks/useVirtualRideSession";
import { fetchRouteByProfile, formatDuration, type RouteProfile } from "./services/mapboxDirections";
import "./App.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
const MAP_STYLE_OPTIONS = [
  { value: "mapbox://styles/mapbox/streets-v12", label: "Streets" },
  { value: "mapbox://styles/mapbox/outdoors-v12", label: "Outdoors" },
  { value: "mapbox://styles/mapbox/light-v11", label: "Light" },
  { value: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
];

type FsSyncState =
  | { state: "idle" }
  | { state: "syncing" }
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
  const [basicStartHubJoined, setBasicStartHubJoined] = useState(false);
  const [basicStartLoading, setBasicStartLoading] = useState(false);
  const [coursePeerMarkers, setCoursePeerMarkers] = useState<MapPeerMarker[]>([]);
  /** false면 LobbyPresence 마운트 안 함(로비 문서·하트비트 중단). 게스트 id는 유지. */
  const [lobbyParticipationEnabled, setLobbyParticipationEnabled] = useState(true);
  const lobbyPresenceUidRef = useRef<string | null>(null);
  /** true면 입문 코스 경로가 있어도 동행 허브 자동 참여 안 함(「나가기」 후) */
  const basicStartHubLeftExplicitRef = useRef(false);

  const onCoursePeersChange = useCallback((next: MapPeerMarker[]) => {
    setCoursePeerMarkers(next);
  }, []);

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
    void syncUserProfileToFirestore(user)
      .then(() => {
        if (!cancelled) setFsSync({ state: "ok" });
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setFsSync({ state: "error", message });
      });
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
      startTransition(() => setBasicStartHubJoined(false));
    }
  }, [user]);

  useEffect(() => {
    if (!basicStartHubJoined) startTransition(() => setCoursePeerMarkers([]));
  }, [basicStartHubJoined]);

  useEffect(() => {
    if (!routeGeometry || !isGeometryBasicStartHub(routeGeometry)) {
      basicStartHubLeftExplicitRef.current = false;
    }
  }, [routeGeometry]);

  useEffect(() => {
    if (!configured || !user) return;
    if (!routeGeometry || !isGeometryBasicStartHub(routeGeometry)) {
      startTransition(() => setBasicStartHubJoined(false));
      return;
    }
    if (basicStartHubLeftExplicitRef.current) return;
    startTransition(() => setBasicStartHubJoined(true));
  }, [configured, user, routeGeometry]);

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

  const enterBasicStartHub = useCallback(async () => {
    if (rideStatus !== "idle") {
      setRouteSummary("세션이 대기 상태일 때만 입문 코스를 불러올 수 있습니다. 종료 후 다시 시도하세요.");
      return;
    }
    setBasicStartLoading(true);
    setRouteSummary("입문 코스 불러오는 중…");
    try {
      let payload = null;
      if (configured) {
        try {
          payload = await fetchCourseRoutePayload(BASIC_START_COURSE_ID);
        } catch {
          payload = null;
        }
      }
      const resolved = payload ?? getBasicStartCourseStatic();
      const coords = resolved.geometry.coordinates;
      setRouteGeometry(resolved.geometry);
      setStartLngLat(coords[0] ?? null);
      setEndLngLat(coords[coords.length - 1] ?? null);
      setProfile("cycling");
      setRouteDistanceMeters(resolved.distanceMeters);
      setRouteDurationSec(resolved.durationSec);
      resetRide();
      setRouteSummary(
        `입문 · ${resolved.title} · 거리 ${(resolved.distanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(resolved.durationSec)}`,
      );
      if (user) {
        basicStartHubLeftExplicitRef.current = false;
        setBasicStartHubJoined(true);
      } else {
        setBasicStartHubJoined(false);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRouteSummary(message);
    } finally {
      setBasicStartLoading(false);
    }
  }, [rideStatus, configured, user, resetRide]);

  const leaveBasicStartHub = useCallback(async () => {
    basicStartHubLeftExplicitRef.current = true;
    if (user) {
      await deleteCoursePresence(user.uid, BASIC_START_COURSE_ID).catch(() => {
        /* noop */
      });
    }
    setBasicStartHubJoined(false);
  }, [user]);

  const generateRoute = useCallback(async () => {
    if (rideStatus !== "idle") {
      setRouteSummary("세션이 대기 상태일 때만 경로를 바꿀 수 있습니다. 종료 후 다시 시도하세요.");
      return;
    }
    if (!MAPBOX_TOKEN) {
      setRouteSummary("Mapbox 토큰이 없습니다. apps/web/.env 의 VITE_MAPBOX_ACCESS_TOKEN 을 설정하세요.");
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
      const route = await fetchRouteByProfile(MAPBOX_TOKEN, start, end, profile);
      setRouteGeometry(route.geometry);
      setRouteDistanceMeters(route.distance);
      setRouteDurationSec(route.duration);
      setRouteSummary(
        `거리 ${(route.distance / 1000).toFixed(2)} km / 예상 ${formatDuration(route.duration)}`,
      );
      resetRide();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRouteSummary(message);
      setRouteGeometry(null);
      setRouteDistanceMeters(0);
      setRouteDurationSec(0);
    } finally {
      setRouteLoading(false);
    }
  }, [
    rideStatus,
    startLngLat,
    endLngLat,
    profile,
    resetRide,
  ]);

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
        await deleteCoursePresence(user.uid, BASIC_START_COURSE_ID).catch(() => {
          /* noop */
        });
      }
      setBasicStartHubJoined(false);
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
          <section className="card card--compact auth-card">
            {!authInitialized ? (
              <div className="auth-row">
                <p className="lead tight">Firebase 인증 연결 확인 중…</p>
              </div>
            ) : user ? (
              <div className="auth-row">
                <div className="auth-info">
                  {user.isAnonymous ? (
                    <>
                      <p className="lead tight">
                        <strong>게스트로 이용 중</strong> ({user.uid.slice(0, 8)}…)
                      </p>
                      <p className="meta tight">
                        로비 나가기·입문 코스 동행 나가기·서비스 종료는 서로 다릅니다. Google을 연결하면 같은 uid로
                        기록이 이어집니다.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="lead tight">
                        <strong>{user.displayName ?? user.email ?? user.uid}</strong>
                      </p>
                      <p className="meta tight">{user.uid}</p>
                    </>
                  )}
                  {fsSync.state === "syncing" ? (
                    <p className="fs-hint">Firestore 동기화 중…</p>
                  ) : null}
                  {fsSync.state === "ok" && !user.isAnonymous ? (
                    <p className="fs-ok">Firestore 프로필 저장됨</p>
                  ) : null}
                  {fsSync.state === "ok" && user.isAnonymous ? (
                    <p className="fs-ok">게스트 세션 활성</p>
                  ) : null}
                  {fsSync.state === "error" ? (
                    <p className="fs-err" title={fsSync.message}>
                      Firestore 오류: {fsSync.message}
                    </p>
                  ) : null}
                </div>
                <div className="auth-actions">
                  {user.isAnonymous ? (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => void handleGoogleSignIn()}
                    >
                      {busy ? "처리 중…" : "Google 계정 연결"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void handleServiceExit()}
                    title="로비·코스 presence를 정리한 뒤 로그아웃합니다. 게스트도 다음 접속 시 다시 시작 화면으로 돌아옵니다."
                  >
                    {user.isAnonymous ? "서비스 종료" : "로그아웃"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-row auth-row--gate">
                <div className="auth-info">
                  <p className="lead tight">시작 방식을 선택하세요</p>
                  <p className="meta tight auth-gate-hint">
                    게스트 계정은 「게스트로 시작」을 눌렀을 때만 만들어져, 페이지만 열어도 익명 사용자가 늘어나지
                    않습니다. 종료 후에는 다시 이 화면에서 선택합니다.
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

      {configured && user ? (
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
      ) : null}

      {configured && user && basicStartHubJoined ? (
        <div className="lobby-strip">
          <CourseSharedPresence
            user={user}
            courseId={BASIC_START_COURSE_ID}
            title="Grindelwald 5km"
            isRiding={rideStatus !== "idle"}
            myLiveLngLat={liveForMap}
            onPeersChange={onCoursePeersChange}
          />
        </div>
      ) : null}

      {configured && user ? (
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
            basicStartLoading={basicStartLoading}
            basicStartHubJoined={basicStartHubJoined}
            authGuest={Boolean(user?.isAnonymous)}
            onEnterBasicStartHub={enterBasicStartHub}
            onLeaveBasicStartHub={leaveBasicStartHub}
          />
          <div className="map-stage map-stage--in-route">
            <MapView
              accessToken={MAPBOX_TOKEN || undefined}
              routeGeometry={routeGeometry}
              startLngLat={startLngLat}
              endLngLat={endLngLat}
              liveLngLat={liveForMap}
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
      ) : configured && authInitialized && !user ? (
        <main className="route-main route-main--gate" aria-label="시작 전 안내">
          <section className="card gate-placeholder">
            <p className="lead tight">
              상단에서 <strong>게스트로 시작</strong> 또는 <strong>Google로 로그인</strong>을 선택하면 지도·로비·입문
              코스 동행을 사용할 수 있습니다.
            </p>
            <p className="meta tight">
              <strong>입문 코스 동행 나가기</strong>는 왼쪽 패널에서만 해당 코스 동행을 끕니다.{" "}
              <strong>로비 나가기</strong>는 방 실시간 목록만 끕니다. <strong>서비스 종료</strong>(또는 로그아웃)은
              연결을 모두 끊고 이 시작 단계로 돌아갑니다.
            </p>
          </section>
        </main>
      ) : configured && !authInitialized ? (
        <main className="route-main route-main--gate" aria-label="연결 중">
          <p className="lead tight" style={{ padding: "1rem 1.25rem" }}>
            Firebase 인증 연결 확인 중…
          </p>
        </main>
      ) : (
        <main className="map-stage" aria-label="지도">
          <p className="lead tight" style={{ padding: "1rem" }}>
            Firebase 설정 후 경로 주행 UI가 표시됩니다.
          </p>
        </main>
      )}

      <footer className="footer">
        레거시 상세(3D·고도·지명검색 등)는 저장소 루트{" "}
        <code className="inline">index.html</code> · <code className="inline">app.js</code> 참고. Mapbox
        토큰은 배포 전 <strong>프록시 이전</strong>을 권장합니다.
      </footer>
    </div>
  );
}
