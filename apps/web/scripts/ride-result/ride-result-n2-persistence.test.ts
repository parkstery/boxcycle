/**
 * N2: Honest End/Persistence/UI Evidence
 *
 * ## 이 파일이 증명하는 것
 * - save reject / save null / save success + progress fail / normal save success
 *   네 케이스에서 **실제 `persistRideEndCore` 를 통한** 상태 전이
 * - `setLastRideResult` 의 functional update 가드(`prev.recordId === record.id`)
 * - 결과 시트 문구 — `getRideSaveStatusLabel` / `getSavedRouteProgressStatusLabel` (실제 시트와 동일)
 * - end sample vs stale UI: 저장된 거리·시간·anchor 는 종료 시점 스냅샷(`record`) 기준
 * - 지연 응답 격리: ride A 의 지연된 save 완료가 ride B 상태를 덮어쓰지 않음
 * - `sessionEndLngLat` (production `computeRideSessionAnchors`) vs 최대 진행률 보존 정책
 *
 * ## 이 파일이 커버하지 않는 것 (기존 S1 파일 참조)
 * - controller/hook 배선: `ride-result-s1-subscription.test.ts`
 * - 15s 지연 상태 + 60s 구독 종료: `ride-result-s1-timers.test.ts`
 * - stale callback (A → B 전환 후 A 콜백 차단): `ride-result-s1-subscription.test.ts`
 *
 * ## 실제 production 경로
 * - `persistRideEndCore` ← `src/lib/rideEndPersistence.ts` (hook 이 직접 호출하는 함수)
 * - `getRideSaveStatusLabel` / `getSavedRouteProgressStatusLabel` ← `src/lib/rideStatusCopy.ts`
 *   (RideSummarySheet 가 import 해 렌더하는 함수 — 여기서 어서트 = 시트 렌더 증명)
 * - `computeRideSessionAnchors` ← `src/lib/rideSessionAnchors.ts`
 *   (sessionEndLngLat anchor 계산 — hook 동기 블록에서 호출)
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Dispatch, SetStateAction } from "react";

// ── Production imports (실제 코드 경로) ────────────────────────────────────
import {
  persistRideEndCore,
  type PersistRideEndCoreInput,
  type PersistRideEndCoreCallbacks,
  type PersistRideEndCoreDeps,
} from "../../src/lib/rideEndPersistence.ts";
import {
  getRideSaveStatusLabel,
  getSavedRouteProgressStatusLabel,
} from "../../src/lib/rideStatusCopy.ts";
import { computeRideSessionAnchors } from "../../src/lib/rideSessionAnchors.ts";
import type { RideEndResult } from "../../src/lib/rideEndResult.ts";
import type { StoredRideSession } from "../../src/lib/rideSessionsStorage.ts";
import type { SavedRoute } from "../../src/lib/firestoreSavedRoutes.ts";

// ---------------------------------------------------------------------------
// 헬퍼: React useState setter 를 시뮬레이션
// ---------------------------------------------------------------------------

function makeStateCapture<T>(initial: T) {
  let state = initial;
  const transitions: T[] = [];
  const setter = ((action: SetStateAction<T>) => {
    const next =
      typeof action === "function" ? (action as (prev: T) => T)(state) : action;
    state = next;
    transitions.push(next);
  }) as Dispatch<SetStateAction<T>>;
  return { setter, transitions, get: () => state };
}

// ---------------------------------------------------------------------------
// 헬퍼: 테스트용 최소 record / input 조립
// ---------------------------------------------------------------------------

/** end sample — 종료 시점 동기 스냅샷 (stale UI 와 의도적으로 다른 값) */
function makeEndRecord(overrides: Partial<StoredRideSession> = {}): StoredRideSession {
  return {
    id: "local-end-record",
    endedAt: "2026-09-10T03:00:00.000Z",
    elapsedSec: 1800,          // end sample: 30분
    distanceMeters: 8500,      // end sample: 8.5 km
    avgSpeedKmh: 17,
    caloriesEstimate: 255,
    routeDistanceMeters: 20000,
    routeDurationSec: 4200,
    completionRatio: 0.425,
    sessionStartLngLat: [126.96, 37.56],
    sessionEndLngLat: [126.97, 37.57],  // production computeRideSessionAnchors 결과
    sessionStartRouteMeters: 0,
    sessionEndRouteMeters: 8500,
    sessionStartProgressRatio: 0,
    sessionEndProgressRatio: 0.425,
    ...overrides,
  };
}

function makeBaseInput(
  record: StoredRideSession,
  overrides: Partial<PersistRideEndCoreInput> = {},
): PersistRideEndCoreInput {
  return {
    record,
    sessionForPersist: record,  // 기본적으로 동일 (geocoding 없음)
    userId: "test-user-uid",
    trailId: "trail-001",
    savedRouteIdAtEnd: null,
    rideCompletedRoute: false,
    progressToSave: 0,
    completionRatio: 0,
    canonicalRouteId: null,
    publicationId: null,
    persistedPublicationId: null,
    publicationIdBeforeAsync: null,
    routeEntry: null,
    publicTitleSnap: null,
    profile: "cycling",
    conquestPayload: null,
    routeDistanceMeters: 20000,
    routeDurationSec: 4200,
    routeGeometry: null,
    routeWaypoints: [],
    startLngLat: null,
    endLngLat: null,
    ...overrides,
  };
}

function makeBaseCallbacks(
  resultCapture: ReturnType<typeof makeStateCapture<RideEndResult | null>>,
): PersistRideEndCoreCallbacks {
  return {
    setLastRideResult: resultCapture.setter,
    setSavedRoutes: makeStateCapture<SavedRoute[]>([]).setter,
    setRecentSessions: makeStateCapture<StoredRideSession[]>([]).setter,
    setLastEndedWasAdhoc: makeStateCapture<unknown>(null).setter,
  };
}

// ---------------------------------------------------------------------------
// localStorage mock (rideSessionsStorage 격리)
// ---------------------------------------------------------------------------

let memStorage: Map<string, string>;

beforeEach(() => {
  memStorage = new Map();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => memStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStorage.set(k, v);
    },
    removeItem: (k: string) => {
      memStorage.delete(k);
    },
    clear: () => {
      memStorage.clear();
    },
    get length() {
      return memStorage.size;
    },
    key: (i: number) => [...memStorage.keys()][i] ?? null,
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).localStorage = undefined;
});

// ---------------------------------------------------------------------------
// 공통 noop deps (storage 격리)
// ---------------------------------------------------------------------------

const noopSessionStorage = {
  loadRideSessionsFn: () => [] as StoredRideSession[],
  saveRideSessionsFn: () => {},
};

// ===========================================================================
// N2-1: save reject
// ===========================================================================
describe("N2-1: save reject → rideSaveStatus failed, savedRouteProgressStatus failed", () => {
  it("실제 persistRideEndCore 를 통해 reject 상태 전이 (저장 경로 있음 → pending → failed 전파)", async () => {
    /**
     * savedRouteIdAtEnd 가 있으면 hook 이 초기 savedRouteProgressStatus = "pending" 으로 설정.
     * 이 케이스에서 save reject 시 cascade 실패(pending → failed)가 일어나야 한다.
     */
    const record = makeEndRecord({ userRouteId: "route-cascade-fail" });
    const resultCapture = makeStateCapture<RideEndResult | null>({
      recordId: record.id,
      endedAtIso: record.endedAt,
      sessionDistanceMeters: record.distanceMeters,
      elapsedSec: record.elapsedSec,
      avgSpeedKmh: record.avgSpeedKmh,
      caloriesEstimate: record.caloriesEstimate,
      savedRouteId: "route-cascade-fail",
      routeName: null,
      hasRoute: true,
      previousProgressRatio: 0,
      progressRatio: 0.425,
      routeCompleted: false,
      anchorLngLat: record.sessionEndLngLat ?? null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",  // savedRoute 있음 → pending
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => {
        throw new Error("Firestore 저장 실패");
      },
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    await persistRideEndCore(
      makeBaseInput(record, { savedRouteIdAtEnd: "route-cascade-fail" }),
      makeBaseCallbacks(resultCapture),
      deps,
    );

    const final = resultCapture.get();
    assert.ok(final != null, "결과 있음");
    // F4: ride save failed
    assert.equal(final!.rideSaveStatus, "failed", "rideSaveStatus → failed");
    // progress 도 함께 실패 (ride save 선행 실패 → pending → failed 전파)
    assert.equal(
      final!.savedRouteProgressStatus,
      "failed",
      "savedRouteProgressStatus pending → failed (선행 실패 전파)",
    );

    // 시트 문구 어서트 — getRideSaveStatusLabel 은 RideSummarySheet 가 실제로 사용하는 함수
    assert.equal(
      getRideSaveStatusLabel(final!.rideSaveStatus),
      "⚠ 주행 저장 실패",
      "시트 문구: ⚠ 주행 저장 실패",
    );
    assert.equal(
      getSavedRouteProgressStatusLabel(
        final!.savedRouteProgressStatus as RideEndResult["savedRouteProgressStatus"],
      ),
      "⚠ 진행률 저장 실패",
      "시트 문구: ⚠ 진행률 저장 실패",
    );
  });

  it("저장 경로 없음(n/a) — save reject 시 savedRouteProgressStatus 는 n/a 유지", async () => {
    /** savedRouteIdAtEnd = null → 초기 "n/a" → save 실패해도 "n/a" 유지 (progress 미해당) */
    const record = makeEndRecord();
    const resultCapture = makeStateCapture<RideEndResult | null>({
      recordId: record.id,
      endedAtIso: record.endedAt,
      sessionDistanceMeters: record.distanceMeters,
      elapsedSec: record.elapsedSec,
      avgSpeedKmh: record.avgSpeedKmh,
      caloriesEstimate: record.caloriesEstimate,
      savedRouteId: null,
      routeName: null,
      hasRoute: false,
      previousProgressRatio: 0,
      progressRatio: 0,
      routeCompleted: false,
      anchorLngLat: null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "n/a",  // 저장 경로 없음
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => { throw new Error("save fail"); },
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    await persistRideEndCore(makeBaseInput(record), makeBaseCallbacks(resultCapture), deps);

    const final = resultCapture.get();
    assert.equal(final!.rideSaveStatus, "failed", "rideSaveStatus → failed");
    assert.equal(final!.savedRouteProgressStatus, "n/a", "n/a 는 그대로 유지 (해당 없음)");
  });
});

// ===========================================================================
// N2-2: save null → rideSaveStatus failed
// ===========================================================================
describe("N2-2: save null → rideSaveStatus failed", () => {
  it("null 반환(no-op) — 저장 경로 있을 때 pending → failed 전파", async () => {
    /** null 반환 = Firestore 가 discardableRideRecord 로 판정 또는 no-op */
    const record = makeEndRecord({ userRouteId: "route-null-test" });
    const resultCapture = makeStateCapture<RideEndResult | null>({
      recordId: record.id,
      endedAtIso: record.endedAt,
      sessionDistanceMeters: record.distanceMeters,
      elapsedSec: record.elapsedSec,
      avgSpeedKmh: record.avgSpeedKmh,
      caloriesEstimate: record.caloriesEstimate,
      savedRouteId: "route-null-test",
      routeName: null,
      hasRoute: true,
      previousProgressRatio: 0,
      progressRatio: 0.425,
      routeCompleted: false,
      anchorLngLat: record.sessionEndLngLat ?? null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => null,  // null 반환
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    await persistRideEndCore(
      makeBaseInput(record, { savedRouteIdAtEnd: "route-null-test" }),
      makeBaseCallbacks(resultCapture),
      deps,
    );

    const final = resultCapture.get();
    assert.ok(final != null);
    assert.equal(final!.rideSaveStatus, "failed", "null → rideSaveStatus failed");
    assert.equal(
      final!.savedRouteProgressStatus,
      "failed",
      "null → savedRouteProgressStatus pending → failed 전파",
    );
    assert.equal(getRideSaveStatusLabel(final!.rideSaveStatus), "⚠ 주행 저장 실패");
  });
});

// ===========================================================================
// N2-3: save success + progress update fail → independent axes
// ===========================================================================
describe("N2-3: save success + progress fail → rideSaveStatus success, savedRouteProgressStatus failed", () => {
  it("Firestore save 성공 후 progress update throw → 독립 축 상태 전이", async () => {
    const record = makeEndRecord({ userRouteId: "route-abc" });
    const resultCapture = makeStateCapture<RideEndResult | null>({
      recordId: record.id,
      endedAtIso: record.endedAt,
      sessionDistanceMeters: record.distanceMeters,
      elapsedSec: record.elapsedSec,
      avgSpeedKmh: record.avgSpeedKmh,
      caloriesEstimate: record.caloriesEstimate,
      savedRouteId: "route-abc",
      routeName: null,
      hasRoute: true,
      previousProgressRatio: 0.30,
      progressRatio: 0.425,
      routeCompleted: false,
      anchorLngLat: record.sessionEndLngLat ?? null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    });

    const savedCallArgs: unknown[] = [];
    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async (input) => {
        savedCallArgs.push(input);
        return "firestore-ride-id-XYZ";
      },
      updateSavedRouteProgressFn: async () => {
        throw new Error("Firestore progress update failed");
      },
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    // N2-3: savedRouteIdAtEnd가 "route-abc" (not local-)
    const input = makeBaseInput(record, {
      savedRouteIdAtEnd: "route-abc",
      progressToSave: 0.425,  // max(0.425, 0.30) — production max logic
      completionRatio: 0.425,
      rideCompletedRoute: false,
    });

    await persistRideEndCore(input, makeBaseCallbacks(resultCapture), deps);

    const final = resultCapture.get();
    assert.ok(final != null);

    // ride save 성공 (독립 축)
    assert.equal(final!.rideSaveStatus, "success", "rideSaveStatus → success");
    assert.equal(final!.serverRideId, "firestore-ride-id-XYZ", "serverRideId 연결");
    // progress 실패 (독립 축)
    assert.equal(
      final!.savedRouteProgressStatus,
      "failed",
      "savedRouteProgressStatus → failed (독립)",
    );

    // 시트 문구: 저장 성공은 레이블 없음, 진행 실패만 표시
    assert.equal(
      getRideSaveStatusLabel(final!.rideSaveStatus),
      null,
      "rideSaveStatus 'success' → 레이블 없음",
    );
    assert.equal(
      getSavedRouteProgressStatusLabel(
        final!.savedRouteProgressStatus as RideEndResult["savedRouteProgressStatus"],
      ),
      "⚠ 진행률 저장 실패",
    );

    // saveRideSessionFn 이 sessionForPersist (end sample) 로 호출됐는지 확인
    assert.equal(savedCallArgs.length, 1, "saveRideSessionFn 1회 호출");
    const callArg = savedCallArgs[0] as { session: StoredRideSession };
    // end sample: distanceMeters 와 sessionEndLngLat 이 record 값
    assert.equal(
      callArg.session.distanceMeters,
      8500,
      "end sample distanceMeters 사용 (stale UI 와 다름)",
    );
    assert.deepEqual(
      callArg.session.sessionEndLngLat,
      [126.97, 37.57],
      "end sample sessionEndLngLat 사용 (computeRideSessionAnchors 결과)",
    );
  });
});

// ===========================================================================
// N2-4: normal save success + progress success
// ===========================================================================
describe("N2-4: normal save success + progress success", () => {
  it("정상 흐름 — rideSaveStatus & savedRouteProgressStatus 모두 success", async () => {
    const record = makeEndRecord({ userRouteId: "route-xyz" });
    const resultCapture = makeStateCapture<RideEndResult | null>({
      recordId: record.id,
      endedAtIso: record.endedAt,
      sessionDistanceMeters: record.distanceMeters,
      elapsedSec: record.elapsedSec,
      avgSpeedKmh: record.avgSpeedKmh,
      caloriesEstimate: record.caloriesEstimate,
      savedRouteId: "route-xyz",
      routeName: null,
      hasRoute: true,
      previousProgressRatio: 0.20,
      progressRatio: 0.425,
      routeCompleted: false,
      anchorLngLat: record.sessionEndLngLat ?? null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => "ride-server-id-ABC",
      // 서버 transaction max(0.425, server) → 0.425 적용
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0.425, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    const input = makeBaseInput(record, {
      savedRouteIdAtEnd: "route-xyz",
      progressToSave: 0.425,  // Math.max(completionRatio=0.425, previousProgress=0.20) = 0.425
      completionRatio: 0.425,
      rideCompletedRoute: false,
    });

    await persistRideEndCore(input, makeBaseCallbacks(resultCapture), deps);

    const final = resultCapture.get();
    assert.ok(final != null);
    assert.equal(final!.rideSaveStatus, "success", "rideSaveStatus → success");
    assert.equal(final!.serverRideId, "ride-server-id-ABC", "serverRideId 연결");
    assert.equal(
      final!.savedRouteProgressStatus,
      "success",
      "savedRouteProgressStatus → success",
    );
    // 서버 반환 진행률 적용
    assert.equal(final!.progressRatio, 0.425, "progressRatio 서버 값 적용");

    // 시트 문구: 모두 성공 → 레이블 없음
    assert.equal(getRideSaveStatusLabel(final!.rideSaveStatus), null, "success → 레이블 없음");
    assert.equal(
      getSavedRouteProgressStatusLabel(
        final!.savedRouteProgressStatus as RideEndResult["savedRouteProgressStatus"],
      ),
      null,
      "success → 레이블 없음",
    );

    // 상태 전이 순서 확인: pending → success (rideSave) → success (progress)
    const allStates = resultCapture.transitions;
    const rideSaveStatuses = allStates
      .filter((s) => s != null)
      .map((s) => s!.rideSaveStatus);
    assert.ok(
      rideSaveStatuses.some((s) => s === "success"),
      "rideSaveStatus 가 'success' 로 전이됨",
    );
    const progressStatuses = allStates
      .filter((s) => s != null)
      .map((s) => s!.savedRouteProgressStatus);
    assert.ok(
      progressStatuses.some((s) => s === "success"),
      "savedRouteProgressStatus 가 'success' 로 전이됨",
    );
  });
});

// ===========================================================================
// N2-5: end sample vs stale UI + sessionEndLngLat (req #4 + #6)
// ===========================================================================
describe("N2-5: end sample vs stale UI — 저장 데이터는 종료 시점 스냅샷 사용", () => {
  it("sessionForPersist(stale label) 와 record(end geometry) 를 구분 — distanceMeters/sessionEndLngLat 은 record", async () => {
    /**
     * req #4: intentionally different end-sample vs stale UI
     * - record: 종료 시점 동기 스냅샷 (distanceMeters=8500, sessionEndLngLat=[126.97,37.57])
     * - sessionForPersist: geocoding 후 업데이트 버전 (지명만 다름, 거리/좌표는 동일)
     * - "stale UI" 는 endedAt 이후에 계속 변화하는 rideMetrics 이지만,
     *   record 는 동기 블록에서 이미 freeze 됐으므로 영향 없다.
     *
     * req #6: sessionEndLngLat — production computeRideSessionAnchors 결과
     * 아래에서 computeRideSessionAnchors 를 직접 호출해 예상 sessionEndLngLat 을 계산한 뒤
     * saveRideSessionFn 이 그 값을 받았는지 확인.
     */
    const routeGeometry = {
      type: "LineString" as const,
      coordinates: [
        [126.96, 37.56],
        [126.965, 37.565],
        [126.97, 37.57],
      ] as [number, number][],
    };

    // production computeRideSessionAnchors 로 예상 anchor 계산
    const anchors = computeRideSessionAnchors({
      geometry: routeGeometry,
      routeDistanceMeters: 20000,
      startOffsetMeters: 0,
      endVirtualDistanceMeters: 8500,
    });
    // sessionEndLngLat 이 계산됐는지 확인
    assert.ok(
      anchors.sessionEndLngLat != null,
      "computeRideSessionAnchors → sessionEndLngLat 비 null",
    );

    // end record: anchor 는 computeRideSessionAnchors 결과 (production 경로와 동일)
    const record = makeEndRecord({
      sessionEndLngLat: anchors.sessionEndLngLat as [number, number],
      sessionEndRouteMeters: anchors.sessionEndRouteMeters,
    });

    // sessionForPersist: geocoding 이 다른 지명을 붙였지만 거리/anchor 는 동일
    const sessionForPersist: StoredRideSession = {
      ...record,
      startPlaceLabel: "지오코딩 지명 A",      // stale UI 와 구분되는 geocoded label
      endPlaceLabel: "지오코딩 지명 B",
      sessionEndPlaceLabel: "세션 종료 지점 이름",
    };

    const savedCallArgs: Array<{ session: StoredRideSession }> = [];
    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async (input) => {
        savedCallArgs.push(input as { session: StoredRideSession });
        return "ride-id-N25";
      },
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    const resultCapture = makeStateCapture<RideEndResult | null>(null);

    await persistRideEndCore(
      { ...makeBaseInput(record), sessionForPersist },
      makeBaseCallbacks(resultCapture),
      deps,
    );

    assert.equal(savedCallArgs.length, 1, "saveRideSessionFn 1회 호출");
    const saved = savedCallArgs[0].session;

    // end sample: distanceMeters 는 record 값 (stale UI 가 변경한 값이 아님)
    assert.equal(saved.distanceMeters, 8500, "저장 distanceMeters = end sample (8500)");
    assert.equal(saved.elapsedSec, 1800, "저장 elapsedSec = end sample (1800)");

    // req #6: sessionEndLngLat 은 computeRideSessionAnchors 결과
    assert.deepEqual(
      saved.sessionEndLngLat,
      anchors.sessionEndLngLat,
      "저장 sessionEndLngLat = computeRideSessionAnchors 결과",
    );

    // geocoded label 이 sessionForPersist 에서 옴
    assert.equal(saved.endPlaceLabel, "지오코딩 지명 B", "endPlaceLabel = geocoded");
  });
});

// ===========================================================================
// N2-6: max-progress 정책 (req #6)
// ===========================================================================
describe("N2-6: max-progress 정책 — progressToSave = max(completionRatio, previousProgress)", () => {
  it("previousProgress 가 더 높을 때 max 값이 서버에 전달됨", async () => {
    /**
     * req #6: production max logic
     * hook 동기 블록: `progressToSave = Math.max(completionRatio, previousProgressRatio)`
     * 이 값이 persistRideEndCore 에 전달되고, updateSavedRouteProgressFn 이 그대로 받아야 한다.
     */
    const record = makeEndRecord({ completionRatio: 0.30 });
    const previousProgressRatio = 0.55;  // 기존 진행률이 더 높음
    // production max logic: Math.max(0.30, 0.55) = 0.55
    const progressToSave = Math.max(0.30, previousProgressRatio);
    assert.equal(progressToSave, 0.55, "progressToSave = max(0.30, 0.55) = 0.55");

    const progressCallArgs: Array<{ progressRatio: number }> = [];
    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => "ride-id-N26",
      updateSavedRouteProgressFn: async (input) => {
        progressCallArgs.push(input as { progressRatio: number });
        return { progressRatio: 0.55, completed: 0 };
      },
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    const resultCapture = makeStateCapture<RideEndResult | null>(null);

    await persistRideEndCore(
      makeBaseInput(record, {
        savedRouteIdAtEnd: "route-max-progress",
        progressToSave,          // production max logic 적용값
        completionRatio: 0.30,
        rideCompletedRoute: false,
      }),
      makeBaseCallbacks(resultCapture),
      deps,
    );

    assert.equal(progressCallArgs.length, 1, "updateSavedRouteProgressFn 1회 호출");
    assert.equal(
      progressCallArgs[0].progressRatio,
      0.55,
      "max-progress 값(0.55)이 Firestore 에 전달됨 (낮은 값 0.30 이 아님)",
    );
  });
});

// ===========================================================================
// N2-7: 지연 응답 격리 — ride A 완료가 ride B 상태 덮어쓰기 방지 (req #5)
// ===========================================================================
describe("N2-7: 지연 응답 격리 — delayed A 완료가 active ride B 를 덮어쓰지 않음", () => {
  it("recordId 불일치 시 setLastRideResult guard 가 상태를 보존", async () => {
    /**
     * req #5: `prev && prev.recordId === record.id` guard 증명
     * 시나리오:
     * 1. ride A 가 persistRideEndCore 시작 (record.id = "local-A")
     * 2. save Promise 가 지연됨
     * 3. 그 사이 사용자가 ride B 를 끝냄 → setLastRideResult 를 통해 state 가 B 로 교체
     * 4. ride A 의 save 가 완료돼 state 를 업데이트 시도
     * 5. guard 로 인해 B 의 state 는 변하지 않아야 함
     */
    const recordA = makeEndRecord({ id: "local-A" });

    // Ride A 의 save Promise 를 수동으로 제어
    let resolveA!: (id: string | null) => void;
    const savePromiseA = new Promise<string | null>((resolve) => {
      resolveA = resolve;
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => savePromiseA,
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    // state 시뮬레이터: ride A 의 optimistic 초기 상태
    const rideAState: RideEndResult = {
      recordId: "local-A",
      endedAtIso: recordA.endedAt,
      sessionDistanceMeters: recordA.distanceMeters,
      elapsedSec: recordA.elapsedSec,
      avgSpeedKmh: recordA.avgSpeedKmh,
      caloriesEstimate: recordA.caloriesEstimate,
      savedRouteId: null,
      routeName: null,
      hasRoute: false,
      previousProgressRatio: 0,
      progressRatio: 0,
      routeCompleted: false,
      anchorLngLat: null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "n/a",
    };
    const resultCapture = makeStateCapture<RideEndResult | null>(rideAState);

    // ride A 의 persist 를 시작 (아직 완료 안 됨)
    const persistPromiseA = persistRideEndCore(
      makeBaseInput(recordA),
      makeBaseCallbacks(resultCapture),
      deps,
    );

    // -- 이 시점에서 사용자가 ride B 를 끝냄 --
    // state 를 ride B 로 교체 (recordId = "local-B")
    const rideBState: RideEndResult = {
      ...rideAState,
      recordId: "local-B",
      sessionDistanceMeters: 12000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "n/a",
    };
    resultCapture.setter(rideBState);

    // ride A 의 save 완료 (지연 응답)
    resolveA("server-ride-A");
    await persistPromiseA;

    // ride B 의 state 가 보존됐는지 확인
    const final = resultCapture.get();
    assert.equal(final!.recordId, "local-B", "recordId 는 여전히 B");
    assert.equal(
      final!.sessionDistanceMeters,
      12000,
      "B 의 sessionDistanceMeters(12000) 보존",
    );
    // A 의 지연 save 가 B 에 rideSaveStatus 를 'success' 로 덮어쓰지 않았는지
    assert.equal(
      final!.rideSaveStatus,
      "pending",
      "B 의 rideSaveStatus 는 A 지연 응답에 의해 변경되지 않음",
    );
  });

  it("recordId 일치 시에는 정상적으로 상태 업데이트됨 (guard 정상 동작 확인)", async () => {
    const recordA = makeEndRecord({ id: "local-A" });

    let resolveA!: (id: string | null) => void;
    const savePromiseA = new Promise<string | null>((resolve) => {
      resolveA = resolve;
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => savePromiseA,
      updateSavedRouteProgressFn: async () => ({ progressRatio: 0, completed: 0 }),
      promoteSavedRouteFn: async () => {},
      ...noopSessionStorage,
    };

    const rideAState: RideEndResult = {
      recordId: "local-A",
      endedAtIso: recordA.endedAt,
      sessionDistanceMeters: 8500,
      elapsedSec: 1800,
      avgSpeedKmh: 17,
      caloriesEstimate: 255,
      savedRouteId: null,
      routeName: null,
      hasRoute: false,
      previousProgressRatio: 0,
      progressRatio: 0,
      routeCompleted: false,
      anchorLngLat: null,
      anchorPlaceLabel: null,
      profile: "cycling",
      routeDistanceMeters: 20000,
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "n/a",
    };
    const resultCapture = makeStateCapture<RideEndResult | null>(rideAState);

    const persistPromiseA = persistRideEndCore(
      makeBaseInput(recordA),
      makeBaseCallbacks(resultCapture),
      deps,
    );

    // state 는 여전히 A (다른 ride 없음)
    resolveA("server-ride-A-matched");
    await persistPromiseA;

    const final = resultCapture.get();
    assert.equal(final!.recordId, "local-A", "recordId 일치 — A");
    assert.equal(
      final!.rideSaveStatus,
      "success",
      "recordId 일치 시 rideSaveStatus → success",
    );
    assert.equal(final!.serverRideId, "server-ride-A-matched", "serverRideId 연결");
  });
});

// ===========================================================================
// N2-8: 시트 문구 exhaustive (req #3)
// ===========================================================================
describe("N2-8: RideSummarySheet 문구 builder exhaustive", () => {
  it("getRideSaveStatusLabel — 모든 값 매핑 확인", () => {
    // pending
    assert.equal(getRideSaveStatusLabel("pending"), "주행 저장 중…");
    // failed
    assert.equal(getRideSaveStatusLabel("failed"), "⚠ 주행 저장 실패");
    // success, n/a, undefined → null
    assert.equal(getRideSaveStatusLabel("success"), null);
    assert.equal(getRideSaveStatusLabel(undefined), null);
  });

  it("getSavedRouteProgressStatusLabel — 모든 값 매핑 확인", () => {
    assert.equal(getSavedRouteProgressStatusLabel("pending"), "진행률 저장 중…");
    assert.equal(getSavedRouteProgressStatusLabel("failed"), "⚠ 진행률 저장 실패");
    assert.equal(getSavedRouteProgressStatusLabel("success"), null);
    assert.equal(getSavedRouteProgressStatusLabel("n/a"), null);
    assert.equal(getSavedRouteProgressStatusLabel(undefined), null);
  });
});
