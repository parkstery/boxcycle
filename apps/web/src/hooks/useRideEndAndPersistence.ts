import type { User } from "firebase/auth";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useCallback } from "react";
import {
  promoteSavedRouteInFirestore,
  updateSavedRouteProgressInFirestore,
  type SavedRoute,
} from "../lib/firestoreSavedRoutes";
import { markRouteActivityRideCompletedOptimistic } from "../lib/firestoreRouteActivity";
import { saveRideSessionToFirestore } from "../lib/firestoreRides";
import {
  buildConquestCellsFromRoute,
  buildTraveledPathForTrace,
  CONQUEST_CELL_ZOOM,
  CONQUEST_PAYLOAD_VERSION,
  type ConquestRidePayload,
} from "../lib/conquestTiles";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { formatLngLat } from "../lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";
import { safeRideSpeechCancel } from "../lib/rideSpeech";
import { loadRideSessions, saveRideSessions, type StoredRideSession } from "../lib/rideSessionsStorage";
import { isDiscardableRideRecord, isRouteCompletion } from "../lib/rideRecordPolicy";
import { loadSavedRoutesFromLocal, promoteSavedRouteInLocal } from "../lib/savedRoutesLocal";
import { fetchMapboxReverseGeocodePlaceName } from "../services/mapboxReverseGeocode";
import type { RouteProfile } from "../services/mapboxDirections";
import type { PublishedPublicCourseSummary } from "../lib/firestoreCourses";
import {
  resolvePublishedRouteLink,
  resolvePublishedRouteLinkByPublicationId,
  type RouteRideEntry,
} from "../lib/routePublicationResolve";
import type { LastEndedAdhocState } from "./useSavedRoutesWorkspace";
import type { RideMetricsUi, RideSessionStatus } from "./useVirtualRideSession";

export type UseRideEndAndPersistenceOptions = {
  mapboxAccessToken: string;
  configured: boolean;
  user: User | null;
  trailId: string;
  /** 주행 종료 시점 publication ID — `rides.publicationId`·CF aggregate용 */
  publicationIdRef: RefObject<string | null>;
  /** 종료 직후 heat 낙관 표시(서버 `liveNow` 지연 대비) */
  onRideEndedWithPublication?: (publicationId: string) => void;
  /** aggregate 캐시 무효화 직후 UI 갱신(heat 반영) */
  onRidePersistedToFirestore?: (publicationId: string | null) => void;
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
  /**
   * Conquest — 이번 세션의 케이던스>0 누적 초. null = BLE 센서 미연결(T0 no-sensor).
   * App 이 주행 중 1초 간격으로 누적(§3.2 Trust Tier).
   */
  pedalActiveSecRef?: RefObject<number | null>;
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
    trailId,
    publicationIdRef,
    onRideEndedWithPublication,
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
    pedalActiveSecRef,
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
    if (!user) {
      setRideStatus("idle");
      return;
    }

    const discardRecord = isDiscardableRideRecord(
      record.distanceMeters,
      record.elapsedSec,
    );

    /** Conquest 페이로드 — 진행 구간(0..virtualDistance) 도로 셀 + 궤적 + 검증된 페달링 초 */
    let conquestPayload: ConquestRidePayload | null = null;
    if (!discardRecord && routeGeometry && routeGeometry.coordinates.length >= 2) {
      try {
        const cells = buildConquestCellsFromRoute(
          routeGeometry,
          rideMetrics.virtualDistanceMeters,
        );
        if (cells.length > 0) {
          const rawPedalSec = pedalActiveSecRef?.current ?? null;
          conquestPayload = {
            v: CONQUEST_PAYLOAD_VERSION,
            z: CONQUEST_CELL_ZOOM,
            cells,
            path: buildTraveledPathForTrace(routeGeometry, rideMetrics.virtualDistanceMeters),
            pedalSec:
              rawPedalSec == null
                ? null
                : Math.max(0, Math.min(Math.round(rawPedalSec), elapsedSec)),
          };
        }
      } catch {
        /* 정복 계산 실패는 주행 저장을 막지 않는다 */
      }
    }

    if (!discardRecord) {
      const next = [record, ...loadRideSessions()].slice(0, 50);
      saveRideSessions(next, user);
      setRecentSessions(next);
    }

    if (configured && !discardRecord) {
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
                saveRideSessions(rows, user);
                setRecentSessions(rows);
              }
            } catch {
              /* noop */
            }
          }
          let persistedPublicationId = publicationIdRef.current?.trim() || null;
          let canonicalRouteId = savedRouteIdAtEnd;
          let publicationId: string | null = persistedPublicationId;
          let publicTitleSnap: string | null = null;
          let routeEntry: RouteRideEntry | null = rideEntryRef?.current ?? null;

          if (
            !persistedPublicationId &&
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
                persistedPublicationId = link.publicationId;
                publicationId = link.publicationId;
                canonicalRouteId = link.routeId;
                publicTitleSnap = link.publicTitle;
                if (!routeEntry) routeEntry = "owner_library";
              }
            } catch {
              /* publication 조회 실패 시 publicationId 없이 저장 */
            }
          }

          if (persistedPublicationId && !canonicalRouteId) {
            try {
              const link = await resolvePublishedRouteLinkByPublicationId(persistedPublicationId);
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
          if (persistedPublicationId && !savedRouteIdAtEnd && !routeEntry) {
            routeEntry = "public_catalog";
          }

          const rideId = await saveRideSessionToFirestore({
            userId: user.uid,
            trailId,
            routeId: canonicalRouteId,
            publicationId,
            routeEntry,
            publicTitleSnap,
            profile,
            session: sessionForPersist,
            conquest: conquestPayload,
          });
          if (!rideId) return;
          // aggregate 재조회는 onRidePersisted에서 수행 — 여기서 invalidate 하면
          // CF `recentRideCount7d` 반영 전 서버 0이 낙관 heat를 지워 버린다.
          onRidePersistedToFirestore?.(persistedPublicationId);
          const publicationIdBeforeAsync = publicationIdRef.current?.trim() || null;
          if (persistedPublicationId && persistedPublicationId !== publicationIdBeforeAsync) {
            markRouteActivityRideCompletedOptimistic(persistedPublicationId);
            onRideEndedWithPublication?.(persistedPublicationId);
          }
          // 완주(≥98%)만 completed=1 로 격상. 미완주는 진행률만 저장해 「이어 달리기」로 남긴다(§9.5).
          const rideCompletedRoute = isRouteCompletion(completionRatio);
          if (savedRouteIdAtEnd && !savedRouteIdAtEnd.startsWith("local-")) {
            try {
              if (rideCompletedRoute) {
                await promoteSavedRouteInFirestore({
                  userId: user.uid,
                  routeId: savedRouteIdAtEnd,
                  rideId,
                });
              } else {
                await updateSavedRouteProgressInFirestore({
                  userId: user.uid,
                  routeId: savedRouteIdAtEnd,
                  rideId,
                  progressRatio: completionRatio,
                });
              }
              const nowIso = new Date().toISOString();
              setSavedRoutes((prev) =>
                prev.map((r) =>
                  r.id === savedRouteIdAtEnd
                    ? rideCompletedRoute
                      ? {
                          ...r,
                          completed: 1,
                          completedAtIso: nowIso,
                          expiresAtIso: null,
                          lastRideId: rideId,
                          lastProgressRatio: 1,
                          updatedAtIso: nowIso,
                        }
                      : {
                          ...r,
                          lastRideId: rideId,
                          lastProgressRatio: completionRatio,
                          updatedAtIso: nowIso,
                        }
                    : r,
                ),
              );
            } catch (e) {
              console.warn("[savedRoutes] 진행/격상 갱신 실패", e);
            }
          } else if (savedRouteIdAtEnd && rideCompletedRoute) {
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
    } else if (!discardRecord && savedRouteIdAtEnd) {
      promoteSavedRouteInLocal({
        routeId: savedRouteIdAtEnd,
        rideId: record.id,
      });
      setSavedRoutes(loadSavedRoutesFromLocal());
    } else if (
      !discardRecord &&
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

    if (!(configured && user) && !discardRecord) {
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
            saveRideSessions(rows, user);
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

    const publicationIdAtEnd = publicationIdRef.current?.trim() || null;
    if (publicationIdAtEnd && !discardRecord) {
      markRouteActivityRideCompletedOptimistic(publicationIdAtEnd);
      onRideEndedWithPublication?.(publicationIdAtEnd);
    }

    setRideStatus("idle");
  }, [
    mapboxAccessToken,
    configured,
    user,
    trailId,
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
    pedalActiveSecRef,
    publicationIdRef,
    publishedCatalogRef,
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    onRideEndedWithPublication,
    onRidePersistedToFirestore,
  ]);

  return { handleEndRide };
}
