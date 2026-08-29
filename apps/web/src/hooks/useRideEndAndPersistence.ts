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
import { formatLngLat, getDistanceMeters } from "../lib/geo";
import { computeRideSessionAnchors } from "../lib/rideSessionAnchors";
import type { RideEndResult } from "../lib/rideEndResult";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";
import { safeRideSpeechCancel } from "../lib/rideSpeech";
import { loadRideSessions, saveRideSessions, type StoredRideSession } from "../lib/rideSessionsStorage";
import { isDiscardableRideRecord, isRouteCompletion } from "../lib/rideRecordPolicy";
import {
  loadSavedRoutesFromLocal,
  promoteSavedRouteInLocal,
  updateSavedRouteProgressInLocal,
} from "../lib/savedRoutesLocal";
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
  /**
   * 이어 달리기(§9.5.5 단위7) — 이번 세션의 경로상 시작 오프셋(m). virtualDistance 는
   * 「경로상 위치(누적)」이므로 운동 인정·Claim 페이로드는 (virtualDistance − offset) 세션 구간만.
   */
  startOffsetMetersRef?: RefObject<number>;
  /** 로드 시점 저장 진행률(0..1) — 진행률 저장은 max(기존, 신규)로 최대 도달점 유지 */
  loadedSavedRouteProgressRef?: MutableRefObject<number>;
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
  /**
   * 종료 결과(RIDE-CONTINUE-1 §3.5) — 도착·ad-hoc 여부와 무관하게 **모든 유효 Ride** 가 채운다.
   * 결과 시트는 이 값 하나로 구동되고, 닫으면 「다음 주행」 카드가 즉시 갱신된다.
   */
  setLastRideResult?: Dispatch<SetStateAction<RideEndResult | null>>;
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
    startOffsetMetersRef,
    loadedSavedRouteProgressRef,
    rideEntryRef,
    pedalActiveSecRef,
    publishedCatalogRef,
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    setLastRideResult,
  } = options;

  const handleEndRide = useCallback(() => {
    if (rideStatus === "idle") return;
    safeRideSpeechCancel();

    const elapsedSec = Math.floor(rideMetrics.accumulatedMs / 1000);
    /**
     * 이어 달리기(§9.5.5 단위7) — virtualDistance 는 경로상 위치(누적).
     * 운동 인정(거리·칼로리·평속)·Claim 페이로드는 이번 세션 실주행 구간만.
     */
    const startOffsetMeters = Math.max(
      0,
      Math.min(startOffsetMetersRef?.current ?? 0, rideMetrics.virtualDistanceMeters),
    );
    const sessionDistanceMeters = rideMetrics.virtualDistanceMeters - startOffsetMeters;
    const caloriesEstimate = Math.round((sessionDistanceMeters / 1000) * 30);
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

    /**
     * 실제 세션 시작·종료 anchor(§4.1) — 계획된 `endLngLat` 이 아니라 **실제 종료 누적 거리** 지점.
     * `liveForMap` 과 같은 경계 함수를 공유한다. geometry 가 없으면 좌표는 null 이고 저장은 계속된다.
     */
    const anchors = computeRideSessionAnchors({
      geometry: routeGeometry,
      routeDistanceMeters,
      startOffsetMeters,
      endVirtualDistanceMeters: rideMetrics.virtualDistanceMeters,
    });
    /** 이번 주행 **전** 저장돼 있던 진행률 — 결과 시트의 「31% → 43%」 좌변 */
    const previousProgressRatio = Math.max(
      0,
      Math.min(1, loadedSavedRouteProgressRef?.current ?? 0),
    );

    /**
     * anchor 가 계획 핀과 사실상 같은 지점이면(전 구간 주행) 이미 확보한 지명을 그대로 쓴다.
     * 다르면(부분 주행) 아래 비동기 블록에서 anchor 좌표를 따로 역지오코딩한다.
     */
    const ANCHOR_SAME_PLACE_METERS = 25;
    const startAnchorIsPlanned =
      anchors.sessionStartLngLat != null &&
      startLngLat != null &&
      getDistanceMeters(anchors.sessionStartLngLat, startLngLat) <= ANCHOR_SAME_PLACE_METERS;
    const endAnchorIsPlanned =
      anchors.sessionEndLngLat != null &&
      endLngLat != null &&
      getDistanceMeters(anchors.sessionEndLngLat, endLngLat) <= ANCHOR_SAME_PLACE_METERS;

    const record: StoredRideSession = {
      id: crypto.randomUUID(),
      endedAt: new Date().toISOString(),
      elapsedSec,
      distanceMeters: sessionDistanceMeters,
      avgSpeedKmh:
        elapsedSec > 0
          ? (sessionDistanceMeters / 1000) / (elapsedSec / 3600)
          : 0,
      caloriesEstimate,
      routeDistanceMeters,
      routeDurationSec,
      userRouteId: savedRouteIdAtEnd,
      routeName: savedRouteNameAtEnd,
      completionRatio,
      startPlaceLabel: startPlaceSnapshot,
      endPlaceLabel: endPlaceSnapshot,
      ...anchors,
      sessionStartPlaceLabel: startAnchorIsPlanned ? startPlaceSnapshot : undefined,
      sessionEndPlaceLabel: endAnchorIsPlanned ? endPlaceSnapshot : undefined,
    };
    if (!user) {
      setRideStatus("idle");
      return;
    }

    const discardRecord = isDiscardableRideRecord(
      record.distanceMeters,
      record.elapsedSec,
    );

    /** Conquest 페이로드 — 이번 세션 실주행 구간(offset..virtualDistance) 도로 셀 + 궤적 + 검증된 페달링 초 */
    let conquestPayload: ConquestRidePayload | null = null;
    if (!discardRecord && routeGeometry && routeGeometry.coordinates.length >= 2) {
      try {
        const cells = buildConquestCellsFromRoute(
          routeGeometry,
          rideMetrics.virtualDistanceMeters,
          startOffsetMeters,
        );
        if (cells.length > 0) {
          const rawPedalSec = pedalActiveSecRef?.current ?? null;
          conquestPayload = {
            v: CONQUEST_PAYLOAD_VERSION,
            z: CONQUEST_CELL_ZOOM,
            cells,
            path: buildTraveledPathForTrace(
              routeGeometry,
              rideMetrics.virtualDistanceMeters,
              startOffsetMeters,
            ),
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

    /**
     * 결과 시트 구동값(§3.5) — 도착·ad-hoc 여부로 노출을 제한하지 않는다.
     * Firestore 쓰기 전에 로컬 record 로 **낙관 표시**하되, 실패는 아래에서 숨기지 않는다.
     */
    if (!discardRecord) {
      setLastRideResult?.({
        recordId: record.id,
        endedAtIso: record.endedAt,
        sessionDistanceMeters: record.distanceMeters,
        elapsedSec: record.elapsedSec,
        avgSpeedKmh: record.avgSpeedKmh,
        caloriesEstimate: record.caloriesEstimate,
        savedRouteId: savedRouteIdAtEnd,
        routeName: savedRouteNameAtEnd,
        hasRoute: routeDistanceMeters > 0 && Boolean(routeGeometry),
        previousProgressRatio,
        progressRatio: Math.max(previousProgressRatio, completionRatio),
        routeCompleted: isRouteCompletion(completionRatio),
        anchorLngLat: anchors.sessionEndLngLat,
        anchorPlaceLabel: record.sessionEndPlaceLabel ?? null,
      });
    } else {
      setLastRideResult?.(null);
    }

    if (configured && !discardRecord) {
      void (async () => {
        try {
          let sessionForPersist: StoredRideSession = record;
          const token = mapboxAccessToken.trim();
          if (token && startLngLat && endLngLat) {
            try {
              /**
               * 계획 핀 지명 + **실제 세션 anchor 지명**(§4.1). anchor 가 계획 핀과 같은 지점이면
               * 같은 결과를 재사용해 불필요한 호출을 만들지 않는다(부분 주행일 때만 추가 조회).
               */
              const needStartAnchor =
                anchors.sessionStartLngLat != null && !startAnchorIsPlanned;
              const needEndAnchor = anchors.sessionEndLngLat != null && !endAnchorIsPlanned;
              const [sName, eName, sAnchorName, eAnchorName] = await Promise.all([
                fetchMapboxReverseGeocodePlaceName(startLngLat, token),
                fetchMapboxReverseGeocodePlaceName(endLngLat, token),
                needStartAnchor
                  ? fetchMapboxReverseGeocodePlaceName(anchors.sessionStartLngLat!, token)
                  : Promise.resolve(null),
                needEndAnchor
                  ? fetchMapboxReverseGeocodePlaceName(anchors.sessionEndLngLat!, token)
                  : Promise.resolve(null),
              ]);
              const sFromApi = sName?.trim();
              const eFromApi = eName?.trim();
              const sessionStartFromApi = needStartAnchor
                ? sAnchorName?.trim()
                : sFromApi || record.sessionStartPlaceLabel;
              const sessionEndFromApi = needEndAnchor
                ? eAnchorName?.trim()
                : eFromApi || record.sessionEndPlaceLabel;
              if (sFromApi || eFromApi || sessionStartFromApi || sessionEndFromApi) {
                sessionForPersist = {
                  ...record,
                  startPlaceLabel: sFromApi || record.startPlaceLabel,
                  endPlaceLabel: eFromApi || record.endPlaceLabel,
                  sessionStartPlaceLabel:
                    sessionStartFromApi || record.sessionStartPlaceLabel,
                  sessionEndPlaceLabel: sessionEndFromApi || record.sessionEndPlaceLabel,
                };
                const rows = loadRideSessions().map((r) =>
                  r.id === record.id ? sessionForPersist : r,
                );
                saveRideSessions(rows, user);
                setRecentSessions(rows);
                // 결과 시트의 「다음 출발점」 지명도 함께 갱신(좌표는 UI 에 노출하지 않는다).
                const resolvedAnchorLabel = sessionForPersist.sessionEndPlaceLabel ?? null;
                setLastRideResult?.((prev) =>
                  prev && prev.recordId === record.id
                    ? { ...prev, anchorPlaceLabel: resolvedAnchorLabel }
                    : prev,
                );
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
          // 진행률은 최대 도달점 유지 — "처음부터 다시" 중간 종료가 기존 재개 지점을 지우지 않게(§9.5.5 단위7)
          const progressToSave = Math.max(
            completionRatio,
            Math.max(0, Math.min(1, loadedSavedRouteProgressRef?.current ?? 0)),
          );
          if (savedRouteIdAtEnd && !savedRouteIdAtEnd.startsWith("local-")) {
            try {
              /**
               * 진행률의 진실은 **서버 문서**다(§4.4). transaction 이 `max(server, requested)` 로
               * 판정한 결과를 그대로 state 에 반영해, 늦은 낮은 진행률이 높은 값을 되돌리지 않게 한다.
               */
              let appliedProgress = progressToSave;
              let appliedCompleted: 0 | 1 = rideCompletedRoute ? 1 : 0;
              if (rideCompletedRoute) {
                await promoteSavedRouteInFirestore({
                  userId: user.uid,
                  routeId: savedRouteIdAtEnd,
                  rideId,
                });
                appliedProgress = 1;
              } else {
                const applied = await updateSavedRouteProgressInFirestore({
                  userId: user.uid,
                  routeId: savedRouteIdAtEnd,
                  rideId,
                  progressRatio: progressToSave,
                });
                appliedProgress = applied.progressRatio;
                appliedCompleted = applied.completed;
              }
              const nowIso = new Date().toISOString();
              setSavedRoutes((prev) =>
                prev.map((r) =>
                  r.id === savedRouteIdAtEnd
                    ? appliedCompleted === 1
                      ? {
                          ...r,
                          completed: 1,
                          completedAtIso: r.completedAtIso ?? nowIso,
                          expiresAtIso: null,
                          lastRideId: rideCompletedRoute ? rideId : r.lastRideId,
                          lastProgressRatio: 1,
                          updatedAtIso: nowIso,
                        }
                      : {
                          ...r,
                          // stale write 로 서버가 값을 올리지 않았으면 lastRideId 도 그대로 둔다.
                          lastRideId:
                            appliedProgress > r.lastProgressRatio ? rideId : r.lastRideId,
                          lastProgressRatio: appliedProgress,
                          updatedAtIso: nowIso,
                        }
                    : r,
                ),
              );
              setLastRideResult?.((prev) =>
                prev && prev.recordId === record.id
                  ? {
                      ...prev,
                      progressRatio: appliedProgress,
                      routeCompleted: appliedCompleted === 1,
                    }
                  : prev,
              );
            } catch (e) {
              console.warn("[savedRoutes] 진행/격상 갱신 실패", e);
            }
          } else if (savedRouteIdAtEnd && rideCompletedRoute) {
            promoteSavedRouteInLocal({ routeId: savedRouteIdAtEnd, rideId });
            setSavedRoutes(loadSavedRoutesFromLocal());
          } else if (savedRouteIdAtEnd) {
            // 로컬(게스트) 미완주 — Firestore transaction 과 같은 단조 규칙(내부에서 max 유지)
            const applied = updateSavedRouteProgressInLocal({
              routeId: savedRouteIdAtEnd,
              rideId,
              progressRatio: progressToSave,
            });
            setSavedRoutes(loadSavedRoutesFromLocal());
            setLastRideResult?.((prev) =>
              prev && prev.recordId === record.id
                ? {
                    ...prev,
                    progressRatio: applied.progressRatio,
                    routeCompleted: applied.completed === 1,
                  }
                : prev,
            );
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
      // Firebase 미구성(로컬 전용) — 완주 게이트·진행률 저장 동일 적용(§9.5)
      if (isRouteCompletion(completionRatio)) {
        promoteSavedRouteInLocal({
          routeId: savedRouteIdAtEnd,
          rideId: record.id,
        });
      } else {
        updateSavedRouteProgressInLocal({
          routeId: savedRouteIdAtEnd,
          rideId: record.id,
          progressRatio: Math.max(completionRatio, previousProgressRatio),
        });
      }
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
    if (loadedSavedRouteProgressRef) loadedSavedRouteProgressRef.current = 0;
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
    startOffsetMetersRef,
    loadedSavedRouteProgressRef,
    rideEntryRef,
    pedalActiveSecRef,
    publicationIdRef,
    publishedCatalogRef,
    setSavedRoutes,
    setLastEndedWasAdhoc,
    setRecentSessions,
    setLastRideResult,
    onRideEndedWithPublication,
    onRidePersistedToFirestore,
  ]);

  return { handleEndRide };
}
