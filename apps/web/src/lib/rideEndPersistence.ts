/**
 * 주행 종료 후 Firestore 저장 핵심 블록.
 *
 * `useRideEndAndPersistence.handleEndRide` 의 async IIFE 중 **저장 커널** 부분을 추출한 것.
 * geocoding · publication 해소는 hook 에서 미리 수행해 pre-resolved 값을 넘긴다.
 *
 * ## 테스트 가능성 (N2)
 * `saveRideSessionFn` · `updateSavedRouteProgressFn` · `promoteSavedRouteFn` 을
 * injectable dep 으로 받아, `node:test` 에서 controlled Promise 로 직접 실행할 수 있다.
 * 테스트 파일: `scripts/ride-result/ride-result-n2-persistence.test.ts`
 *
 * ## 커버하지 않는 것 (S1 테스트 담당)
 * - RideConquestSubscription controller 배선 → `ride-result-s1-subscription.test.ts`
 * - 15s 지연 상태 + 60s 구독 종료 → `ride-result-s1-timers.test.ts`
 * - stale callback (A → B 전환 후 A 콜백 차단) → `ride-result-s1-subscription.test.ts`
 */
import type { Dispatch, SetStateAction } from "react";
import type { StoredRideSession } from "./rideSessionsStorage";
import type { SavedRoute } from "./firestoreSavedRoutes";
import type { RideEndResult } from "./rideEndResult";
import type { LineStringGeometry, LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";
import type { ConquestRidePayload } from "./conquestTiles";
import type { RouteRideEntry } from "./routePublicationResolve";
import type { LastEndedAdhocState } from "../hooks/useSavedRoutesWorkspace";
import { MAX_ROUTE_WAYPOINTS } from "./routeWaypoints";
import {
  loadSavedRoutesFromLocal,
  promoteSavedRouteInLocal,
  updateSavedRouteProgressInLocal,
} from "./savedRoutesLocal";

// ---------------------------------------------------------------------------
// Injectable fn 타입 — Firestore SDK 의존을 주입으로 격리
// ---------------------------------------------------------------------------

export type SaveRideSessionFn = (input: {
  userId: string;
  trailId: string | null;
  routeId?: string | null;
  publicationId?: string | null;
  routeEntry?: RouteRideEntry | null;
  publicTitleSnap?: string | null;
  profile: RouteProfile;
  session: StoredRideSession;
  conquest?: ConquestRidePayload | null;
}) => Promise<string | null>;

export type UpdateSavedRouteProgressFn = (input: {
  userId: string;
  routeId: string;
  rideId: string;
  progressRatio: number;
}) => Promise<{ progressRatio: number; completed: 0 | 1 }>;

export type PromoteSavedRouteFn = (input: {
  userId: string;
  routeId: string;
  rideId: string;
}) => Promise<void>;

// ---------------------------------------------------------------------------
// Input / Callbacks / Deps
// ---------------------------------------------------------------------------

/**
 * 종료 시점 동기 스냅샷 + pre-resolved 값.
 * `record` 는 hook 의 동기 블록에서 고정된 "end sample" 이다 —
 * 비동기 블록 진입 후 UI 메트릭이 변해도 저장되는 값은 이 스냅샷을 따른다.
 */
export type PersistRideEndCoreInput = {
  /** 종료 시점 동기 스냅샷 — distanceMeters·elapsedSec·sessionEndLngLat 등 모두 여기서 확정 */
  record: StoredRideSession;
  /** geocoding 후 업데이트된 세션. 지명만 다를 수 있고 ID·거리·시간은 record 와 동일 */
  sessionForPersist: StoredRideSession;
  userId: string;
  trailId: string;
  savedRouteIdAtEnd: string | null;
  /** `isRouteCompletion(completionRatio)` — 동기 블록에서 미리 계산된 값 */
  rideCompletedRoute: boolean;
  /**
   * `Math.max(completionRatio, previousProgressRatio)` — 진행률 최대 보존 정책.
   * 낮은 진행률로 덮어쓰지 않는다(§9.5).
   */
  progressToSave: number;
  completionRatio: number;
  canonicalRouteId: string | null;
  publicationId: string | null;
  persistedPublicationId: string | null;
  /** 비동기 블록 진입 직전 publicationIdRef.current 스냅샷 (낙관 콜백 중복 방지) */
  publicationIdBeforeAsync: string | null;
  routeEntry: RouteRideEntry | null;
  publicTitleSnap: string | null;
  profile: RouteProfile;
  conquestPayload: ConquestRidePayload | null;
  routeDistanceMeters: number;
  routeDurationSec: number;
  routeGeometry: LineStringGeometry | null;
  routeWaypoints: LngLat[];
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
};

export type PersistRideEndCoreCallbacks = {
  setLastRideResult: Dispatch<SetStateAction<RideEndResult | null>>;
  setSavedRoutes: Dispatch<SetStateAction<SavedRoute[]>>;
  setRecentSessions: Dispatch<SetStateAction<StoredRideSession[]>>;
  setLastEndedWasAdhoc: Dispatch<SetStateAction<LastEndedAdhocState | null>>;
  /** Firestore aggregate 재조회 트리거 */
  onRidePersistedToFirestore?: (publicationId: string | null) => void;
  /** 낙관 heat 갱신 */
  onRideEndedWithPublication?: (publicationId: string) => void;
  /** 메모리 캐시 무효화(markRouteActivityRideCompletedOptimistic). injectable for test isolation */
  onPublicationOptimistic?: (publicationId: string) => void;
};

export type PersistRideEndCoreDeps = {
  saveRideSessionFn: SaveRideSessionFn;
  updateSavedRouteProgressFn: UpdateSavedRouteProgressFn;
  promoteSavedRouteFn: PromoteSavedRouteFn;
  /** localStorage 세션 로드. injectable for test isolation */
  loadRideSessionsFn?: () => StoredRideSession[];
  /** localStorage 세션 저장. injectable for test isolation */
  saveRideSessionsFn?: (items: StoredRideSession[]) => void;
};

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * 주행 저장 핵심 비동기 블록.
 *
 * - 이 함수는 절대 throw 하지 않는다 — 모든 오류는 내부에서 catch 해
 *   `setLastRideResult` 로 상태를 전달한 뒤 return 한다.
 * - `record.id` 가드: `setLastRideResult` 의 functional update 안에서
 *   `prev && prev.recordId === record.id` 를 확인해,
 *   ride A 의 지연 응답이 ride B 의 상태를 덮어쓰지 않는다.
 */
export async function persistRideEndCore(
  input: PersistRideEndCoreInput,
  callbacks: PersistRideEndCoreCallbacks,
  deps: PersistRideEndCoreDeps,
): Promise<void> {
  const {
    record,
    sessionForPersist,
    userId,
    trailId,
    savedRouteIdAtEnd,
    rideCompletedRoute,
    progressToSave,
    canonicalRouteId,
    publicationId,
    persistedPublicationId,
    publicationIdBeforeAsync,
    routeEntry,
    publicTitleSnap,
    profile,
    conquestPayload,
    routeDistanceMeters,
    routeDurationSec,
    routeGeometry,
    routeWaypoints,
    startLngLat,
    endLngLat,
  } = input;
  const {
    setLastRideResult,
    setSavedRoutes,
    setRecentSessions,
    setLastEndedWasAdhoc,
    onRidePersistedToFirestore,
    onRideEndedWithPublication,
    onPublicationOptimistic,
  } = callbacks;
  const {
    saveRideSessionFn,
    updateSavedRouteProgressFn,
    promoteSavedRouteFn,
    loadRideSessionsFn,
    saveRideSessionsFn,
  } = deps;

  try {
    // ── 1. Ride 저장 ────────────────────────────────────────────────────────
    let rideId: string | null = null;
    try {
      rideId = await saveRideSessionFn({
        userId,
        trailId,
        routeId: canonicalRouteId,
        publicationId,
        routeEntry,
        publicTitleSnap,
        profile,
        session: sessionForPersist,
        conquest: conquestPayload,
      });
    } catch (e) {
      console.error("[persistRideEndCore] Ride save failed:", e);
      // F4: ride save failed (reject) — progress 도 함께 실패 처리
      setLastRideResult((prev) =>
        prev && prev.recordId === record.id
          ? {
              ...prev,
              rideSaveStatus: "failed",
              savedRouteProgressStatus:
                prev.savedRouteProgressStatus === "pending"
                  ? "failed"
                  : prev.savedRouteProgressStatus,
            }
          : prev,
      );
      return;
    }

    if (!rideId) {
      // F4: ride save null (no-op from Firestore or discardable)
      setLastRideResult((prev) =>
        prev && prev.recordId === record.id
          ? {
              ...prev,
              rideSaveStatus: "failed",
              savedRouteProgressStatus:
                prev.savedRouteProgressStatus === "pending"
                  ? "failed"
                  : prev.savedRouteProgressStatus,
            }
          : prev,
      );
      return;
    }

    // ── 2. 로컬 세션에 serverRideId 연결 (F1) ────────────────────────────────
    if (loadRideSessionsFn && saveRideSessionsFn) {
      const rowsWithServerId = loadRideSessionsFn().map((r) =>
        r.id === record.id ? { ...r, serverRideId: rideId } : r,
      );
      saveRideSessionsFn(rowsWithServerId);
      setRecentSessions(rowsWithServerId);
    }

    // ── 3. F4: ride save success ─────────────────────────────────────────────
    setLastRideResult((prev) =>
      prev && prev.recordId === record.id
        ? { ...prev, serverRideId: rideId, rideSaveStatus: "success" }
        : prev,
    );

    // ── 4. 콜백 ─────────────────────────────────────────────────────────────
    onRidePersistedToFirestore?.(persistedPublicationId);
    if (persistedPublicationId && persistedPublicationId !== publicationIdBeforeAsync) {
      onPublicationOptimistic?.(persistedPublicationId);
      onRideEndedWithPublication?.(persistedPublicationId);
    }

    // ── 5. 진행률 저장 ──────────────────────────────────────────────────────
    if (savedRouteIdAtEnd && !savedRouteIdAtEnd.startsWith("local-")) {
      try {
        let appliedProgress = progressToSave;
        let appliedCompleted: 0 | 1 = rideCompletedRoute ? 1 : 0;
        if (rideCompletedRoute) {
          await promoteSavedRouteFn({ userId, routeId: savedRouteIdAtEnd, rideId });
          appliedProgress = 1;
        } else {
          const applied = await updateSavedRouteProgressFn({
            userId,
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
                    lastRideId:
                      appliedProgress > r.lastProgressRatio ? rideId : r.lastRideId,
                    lastProgressRatio: appliedProgress,
                    updatedAtIso: nowIso,
                  }
              : r,
          ),
        );
        // F4: progress update success (Firestore)
        setLastRideResult((prev) =>
          prev && prev.recordId === record.id
            ? {
                ...prev,
                progressRatio: appliedProgress,
                routeCompleted: appliedCompleted === 1,
                savedRouteProgressStatus: "success",
              }
            : prev,
        );
      } catch (e) {
        console.warn("[persistRideEndCore] Progress update failed:", e);
        // F4: progress update failed (independent axis)
        setLastRideResult((prev) =>
          prev && prev.recordId === record.id
            ? { ...prev, savedRouteProgressStatus: "failed" }
            : prev,
        );
      }
    } else if (savedRouteIdAtEnd && rideCompletedRoute) {
      // 로컬(게스트) 완주 — local promote
      promoteSavedRouteInLocal({ routeId: savedRouteIdAtEnd, rideId });
      setSavedRoutes(loadSavedRoutesFromLocal());
      setLastRideResult((prev) =>
        prev && prev.recordId === record.id
          ? { ...prev, savedRouteProgressStatus: "success" }
          : prev,
      );
    } else if (savedRouteIdAtEnd) {
      // 로컬(게스트) 미완주 — monotonic progress
      const applied = updateSavedRouteProgressInLocal({
        routeId: savedRouteIdAtEnd,
        rideId,
        progressRatio: progressToSave,
      });
      setSavedRoutes(loadSavedRoutesFromLocal());
      setLastRideResult((prev) =>
        prev && prev.recordId === record.id
          ? {
              ...prev,
              progressRatio: applied.progressRatio,
              routeCompleted: applied.completed === 1,
              savedRouteProgressStatus: "success",
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
      // ad-hoc 저장 컨텍스트
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

    // ── 6. 남은 "pending" 정리 ───────────────────────────────────────────────
    // (경로 없음·adhoc 경우 savedRouteProgressStatus 가 pending 으로 남을 수 있다)
    setLastRideResult((prev) =>
      prev && prev.recordId === record.id && prev.savedRouteProgressStatus === "pending"
        ? { ...prev, savedRouteProgressStatus: "success" }
        : prev,
    );
  } catch (unexpectedError) {
    // 예상 못한 예외 — 어떤 상태도 "pending" 으로 멈추지 않게 한다(R2)
    console.error("[persistRideEndCore] Unexpected error:", unexpectedError);
    setLastRideResult((prev) =>
      prev && prev.recordId === record.id
        ? {
            ...prev,
            rideSaveStatus: prev.rideSaveStatus === "pending" ? "failed" : prev.rideSaveStatus,
            savedRouteProgressStatus:
              prev.savedRouteProgressStatus === "pending"
                ? "failed"
                : prev.savedRouteProgressStatus,
          }
        : prev,
    );
  }
}
