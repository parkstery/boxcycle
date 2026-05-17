import type { User } from "firebase/auth";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  backfillSavedRoutesExpiresAt,
  deleteSavedRouteFromFirestore,
  loadSavedRoutesFromFirestore,
  migrateLocalRoutesToFirestore,
  promoteSavedRouteInFirestore,
  renameSavedRouteInFirestore,
  saveRouteToFirestore,
  type SavedRoute,
} from "../lib/firestoreSavedRoutes";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";
import { lockRouteWorkspaceDuringRide } from "../lib/routeWorkspaceLock";
import {
  clearSavedRoutesLocal,
  deleteSavedRouteFromLocal,
  exportLocalRoutesForMigration,
  loadSavedRoutesFromLocal,
  promoteSavedRouteInLocal,
  renameSavedRouteInLocal,
  saveRouteToLocal,
} from "../lib/savedRoutesLocal";
import { formatDuration, type RouteProfile } from "../services/mapboxDirections";
import type { RideSessionStatus } from "./useVirtualRideSession";

export type LastEndedAdhocState = {
  distanceMeters: number;
  durationSec: number;
  geometry: LineStringGeometry;
  startLngLat: LngLat;
  endLngLat: LngLat;
  waypoints: LngLat[];
  profile: RouteProfile;
  rideId: string | null;
};

export type UseSavedRoutesWorkspaceOptions = {
  configured: boolean;
  user: User | null;
  rideStatus: RideSessionStatus;
  routeGeometry: LineStringGeometry | null;
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  routeWaypoints: LngLat[];
  profile: RouteProfile;
  routeDistanceMeters: number;
  routeDurationSec: number;
  setRouteSummary: Dispatch<SetStateAction<string>>;
  setStartLngLat: Dispatch<SetStateAction<LngLat | null>>;
  setEndLngLat: Dispatch<SetStateAction<LngLat | null>>;
  setRouteWaypoints: Dispatch<SetStateAction<LngLat[]>>;
  setProfile: Dispatch<SetStateAction<RouteProfile>>;
  setRouteGeometry: Dispatch<SetStateAction<LineStringGeometry | null>>;
  setRouteDistanceMeters: Dispatch<SetStateAction<number>>;
  setRouteDurationSec: Dispatch<SetStateAction<number>>;
  resetRide: () => void;
  setActiveOfficialCourseId: Dispatch<SetStateAction<string | null>>;
  setPlaceSearchMarkerLngLat: Dispatch<SetStateAction<LngLat | null>>;
};

/**
 * 저장 경로 목록(Firestore/로컬), 로드·마이그레이션·TTL 백필, CRUD, 지도에 올린 저장 경로 ref, ad-hoc 저장 컨텍스트.
 */
export function useSavedRoutesWorkspace(options: UseSavedRoutesWorkspaceOptions) {
  const {
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
  } = options;

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => loadSavedRoutesFromLocal());
  const [savedRoutesLoading, setSavedRoutesLoading] = useState(false);
  const loadedSavedRouteIdRef = useRef<string | null>(null);
  const loadedSavedRouteNameRef = useRef<string | null>(null);
  const [lastEndedWasAdhoc, setLastEndedWasAdhoc] = useState<LastEndedAdhocState | null>(null);

  const clearLoadedRouteAndAdhoc = useCallback(() => {
    loadedSavedRouteIdRef.current = null;
    loadedSavedRouteNameRef.current = null;
    setLastEndedWasAdhoc(null);
  }, []);

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
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, user]);

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

  const handleSaveAdhocAsUserRoute = useCallback(
    async (name: string) => {
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
      if (lockRouteWorkspaceDuringRide(rideStatus !== "idle")) {
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
      setPlaceSearchMarkerLngLat(null);
      setRouteSummary(
        `「${route.name}」 불러옴 · 거리 ${(route.distanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(route.durationSec)}`,
      );
    },
    [
      rideStatus,
      resetRide,
      setRouteSummary,
      setStartLngLat,
      setEndLngLat,
      setRouteWaypoints,
      setProfile,
      setRouteGeometry,
      setRouteDistanceMeters,
      setRouteDurationSec,
      setActiveOfficialCourseId,
      setPlaceSearchMarkerLngLat,
    ],
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
            r.id === route.id ? { ...r, name, updatedAtIso: new Date().toISOString() } : r,
          ),
        );
        if (loadedSavedRouteIdRef.current === route.id) {
          loadedSavedRouteNameRef.current = name;
        }
      } else {
        const name = renameSavedRouteInLocal(route.id, newName);
        setSavedRoutes((prev) =>
          prev.map((r) =>
            r.id === route.id ? { ...r, name, updatedAtIso: new Date().toISOString() } : r,
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

  return {
    savedRoutes,
    setSavedRoutes,
    savedRoutesLoading,
    loadedSavedRouteIdRef,
    loadedSavedRouteNameRef,
    lastEndedWasAdhoc,
    setLastEndedWasAdhoc,
    clearLoadedRouteAndAdhoc,
    handleSaveCurrentRoute,
    handleSaveAdhocAsUserRoute,
    handleLoadSavedRoute,
    handleRenameSavedRoute,
    handleDeleteSavedRoute,
  };
}
