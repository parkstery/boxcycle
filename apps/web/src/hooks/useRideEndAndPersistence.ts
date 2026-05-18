import type { User } from "firebase/auth";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useCallback } from "react";
import { promoteSavedRouteInFirestore, type SavedRoute } from "../lib/firestoreSavedRoutes";
import { markCourseActivityRideCompletedOptimistic } from "../lib/firestoreCourseActivity";
import { saveRideSessionToFirestore } from "../lib/firestoreRides";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { formatLngLat } from "../lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";
import { safeRideSpeechCancel } from "../lib/rideSpeech";
import { loadRideSessions, saveRideSessions, type StoredRideSession } from "../lib/rideSessionsStorage";
import { loadSavedRoutesFromLocal, promoteSavedRouteInLocal } from "../lib/savedRoutesLocal";
import { fetchMapboxReverseGeocodePlaceName } from "../services/mapboxReverseGeocode";
import type { RouteProfile } from "../services/mapboxDirections";
import type { PublishedPublicCourseSummary } from "../lib/firestoreCourses";
import {
  resolvePublishedRouteLink,
  resolvePublishedRouteLinkByCourseId,
  type RouteRideEntry,
} from "../lib/routePublicationResolve";
import type { LastEndedAdhocState } from "./useSavedRoutesWorkspace";
import type { RideMetricsUi, RideSessionStatus } from "./useVirtualRideSession";

export type UseRideEndAndPersistenceOptions = {
  mapboxAccessToken: string;
  configured: boolean;
  user: User | null;
  roomId: string;
  /** 주행 종료 시점 코스 ID — `rides.courseId`·CF aggregate용 */
  courseIdRef: RefObject<string | null>;
  /** 종료 직후 heat 낙관 표시(서버 `liveNow` 지연 대비) */
  onRideEndedWithCourse?: (courseId: string) => void;
  /** aggregate 캐시 무효화 직후 UI 갱신(heat 반영) */
  onRidePersistedToFirestore?: (courseId: string | null) => void;
  profile: RouteProfile;
  rideStatus: RideSessionStatus;
  setRideStatus: Dispatch<SetStateAction<RideSessionStatus>>;
  rideMetrics: RideMetricsUi;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  routeDurationSec: number;
  routeWaypoints: LngLat[];
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  startPlaceLabel: string | null;
  endPlaceLabel: string | null;
  loadedSavedRouteIdRef: MutableRefObject<string | null>;
  loadedSavedRouteNameRef: MutableRefObject<string | null>;
  /** 주행 입구 — 내 경로 vs 퍼블릭 탭 */
  rideEntryRef?: RefObject<RouteRideEntry | null>;
  /** `resolvePublishedRouteLink` 카탈로그 1차 힌트 */
  publishedCatalogRef?: RefObject<readonly PublishedPublicCourseSummary[]>;
  setSavedRoutes: Dispatch<SetStateAction<SavedRoute[]>>;
  setLastEndedWasAdhoc: Dispatch<SetStateAction<LastEndedAdhocState | null>>;
  setRecentSessions: Dispatch<SetStateAction<StoredRideSession[]>>;
};

/**
 * 가상 주행 종료: 로컬 기록·Firestore ride 문서·저장 경로 격상·ad-hoc 저장 컨텍스트.
 */
export function useRideEndAndPersistence(options: UseRideEndAndPersistenceOptions) {
  const {
    mapboxAccessToken,
    configured,
    user,
    roomId,
    courseIdRef,
    onRideEndedWithCourse,
    onRidePersistedToFirestore,
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
  } = options;

  const handleEndRide = useCallback(() => {
    if (rideStatus === "idle") return;
    safeRideSpeechCancel();

    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    const caloriesEstimate = Math.round((rideMetrics.virtualDistanceMeters / 1000) * 30);
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

    if (configured && user) {
      void (async () => {
        try {
          let sessionForPersist: StoredRideSession = record;
          const token = mapboxAccessToken.trim();
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
          let persistedCourseId = courseIdRef.current?.trim() || null;
          let canonicalRouteId = savedRouteIdAtEnd;
          let publicationId: string | null = null;
          let publicTitleSnap: string | null = null;
          let routeEntry: RouteRideEntry | null = rideEntryRef?.current ?? null;

          if (
            !persistedCourseId &&
            savedRouteIdAtEnd &&
            routeGeometry &&
            routeGeometry.coordinates.length >= 2
          ) {
            try {
              const link = await resolvePublishedRouteLink({
                savedRouteId: savedRouteIdAtEnd,
                geometry: routeGeometry,
                profile,
                catalogHints: publishedCatalogRef?.current,
              });
              if (link) {
                persistedCourseId = link.courseId;
                publicationId = link.publicationId;
                canonicalRouteId = link.routeId;
                publicTitleSnap = link.publicTitle;
                if (!routeEntry) routeEntry = "owner_library";
              }
            } catch {
              /* publication 조회 실패 시 courseId 없이 저장 */
            }
          }

          if (persistedCourseId && !canonicalRouteId) {
            try {
              const link = await resolvePublishedRouteLinkByCourseId(persistedCourseId);
              if (link) {
                canonicalRouteId = link.routeId;
                publicationId = publicationId ?? link.publicationId;
                publicTitleSnap = publicTitleSnap ?? link.publicTitle;
                if (!routeEntry) routeEntry = "public_catalog";
              }
            } catch {
              /* noop */
            }
          }

          if (savedRouteIdAtEnd && !routeEntry) routeEntry = "owner_library";
          if (persistedCourseId && !savedRouteIdAtEnd && !routeEntry) {
            routeEntry = "public_catalog";
          }

          const rideId = await saveRideSessionToFirestore({
            userId: user.uid,
            roomId,
            courseId: persistedCourseId,
            routeId: canonicalRouteId,
            publicationId,
            routeEntry,
            publicTitleSnap,
            profile,
            session: sessionForPersist,
          });
          // aggregate 재조회는 onRidePersisted에서 수행 — 여기서 invalidate 하면
          // CF `recentRideCount7d` 반영 전 서버 0이 낙관 heat를 지워 버린다.
          onRidePersistedToFirestore?.(persistedCourseId);
          const courseIdBeforeAsync = courseIdRef.current?.trim() || null;
          if (persistedCourseId && persistedCourseId !== courseIdBeforeAsync) {
            markCourseActivityRideCompletedOptimistic(persistedCourseId);
            onRideEndedWithCourse?.(persistedCourseId);
          }
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
            promoteSavedRouteInLocal({ routeId: savedRouteIdAtEnd, rideId });
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
              rideId,
            });
          }
        } catch {
          // Firestore 저장 실패 시 로컬 저장본은 유지한다.
        }
      })();
    } else if (savedRouteIdAtEnd) {
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

    if (!(configured && user)) {
      const token = mapboxAccessToken.trim();
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

    loadedSavedRouteIdRef.current = null;
    loadedSavedRouteNameRef.current = null;
    if (rideEntryRef) rideEntryRef.current = null;

    const courseIdAtEnd = courseIdRef.current?.trim() || null;
    if (courseIdAtEnd) {
      markCourseActivityRideCompletedOptimistic(courseIdAtEnd);
      onRideEndedWithCourse?.(courseIdAtEnd);
    }

    setRideStatus("idle");
  }, [
    mapboxAccessToken,
    configured,
    user,
    roomId,
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
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    onRideEndedWithCourse,
    onRidePersistedToFirestore,
  ]);

  return { handleEndRide };
}
