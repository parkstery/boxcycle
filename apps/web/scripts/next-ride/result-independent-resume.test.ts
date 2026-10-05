/**
 * 결과창(UI lastRideResult)과 독립적인 이어달리기 슬롯 이벤트 lifecycle.
 *
 * 문자열 검사로 대체하지 않음 — 실제 persistRideEndCore + controlled Promise +
 * 슬롯 ensureAcquired fake 로 증명한다.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Dispatch, SetStateAction } from "react";

import {
  persistRideEndCore,
  type PersistRideEndCoreDeps,
  type PersistRideEndCoreInput,
  type SavedRouteProgressAppliedEvent,
} from "../../src/lib/ride/rideEndPersistence.ts";
import {
  filterProgressAppliedEventsForUid,
  peekNextProgressAppliedEvent,
  resolveRideEndSlotAction,
  shouldMarkSlotOpProcessed,
  type ProgressAppliedSlotEvent,
} from "../../src/lib/ride/rideResumeSlotPolicy.ts";
import type { RideEndResult } from "../../src/lib/ride/rideEndResult.ts";
import type { StoredRideSession } from "../../src/lib/ride/rideSessionsStorage.ts";
import type { SavedRoute } from "../../src/lib/route/repo/firestoreSavedRoutes.ts";

function makeStateCapture<T>(initial: T) {
  let state = initial;
  const transitions: T[] = [];
  const setter = ((action: SetStateAction<T>) => {
    const next =
      typeof action === "function" ? (action as (prev: T) => T)(state) : action;
    state = next;
    transitions.push(next);
  }) as Dispatch<SetStateAction<T>>;
  return { setter, transitions, get: () => state, set: (v: T) => { state = v; } };
}

function makeEndRecord(overrides: Partial<StoredRideSession> = {}): StoredRideSession {
  return {
    id: "local-end-record",
    endedAt: "2026-10-06T03:00:00.000Z",
    elapsedSec: 600,
    distanceMeters: 2000,
    avgSpeedKmh: 18,
    caloriesEstimate: 60,
    routeDistanceMeters: 10000,
    routeDurationSec: 2400,
    completionRatio: 0.2,
    sessionEndLngLat: [126.97, 37.57],
    ...overrides,
  };
}

function makeBaseInput(
  record: StoredRideSession,
  overrides: Partial<PersistRideEndCoreInput> = {},
): PersistRideEndCoreInput {
  return {
    record,
    sessionForPersist: record,
    userId: "uid-A",
    trailId: "trail-001",
    savedRouteIdAtEnd: "route-A",
    rideCompletedRoute: false,
    progressToSave: 0.2,
    completionRatio: 0.2,
    canonicalRouteId: "route-A",
    publicationId: null,
    persistedPublicationId: null,
    publicationIdBeforeAsync: null,
    routeEntry: "owner_library",
    publicTitleSnap: null,
    profile: "cycling",
    conquestPayload: null,
    routeDistanceMeters: 10000,
    routeDurationSec: 2400,
    routeGeometry: null,
    routeWaypoints: [],
    startLngLat: null,
    endLngLat: null,
    ...overrides,
  };
}

function makePendingResult(record: StoredRideSession): RideEndResult {
  return {
    recordId: record.id,
    endedAtIso: record.endedAt,
    sessionDistanceMeters: record.distanceMeters,
    elapsedSec: record.elapsedSec,
    avgSpeedKmh: record.avgSpeedKmh,
    caloriesEstimate: record.caloriesEstimate,
    savedRouteId: "route-A",
    routeName: null,
    hasRoute: true,
    previousProgressRatio: 0,
    progressRatio: 0.2,
    routeCompleted: false,
    anchorLngLat: record.sessionEndLngLat ?? null,
    anchorPlaceLabel: null,
    profile: "cycling",
    routeDistanceMeters: 10000,
    rideSaveStatus: "pending",
    savedRouteProgressStatus: "pending",
  };
}

const noopSessionStorage = {
  loadRideSessionsFn: () => [] as StoredRideSession[],
  saveRideSessionsFn: () => {},
};

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

/** App 효과와 동등한 최소 드레인 — 이벤트 → ensureAcquired/clear */
async function drainProgressEventsToSlot(input: {
  queue: ProgressAppliedSlotEvent[];
  currentUid: string | null;
  processed: Set<string>;
  slotStatus: "idle" | "loading" | "ready" | "error";
  slotInitialized: boolean;
  slotOwnerUid: string | null;
  ensureAcquired: (routeId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  clearIfActive: (routeId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}): Promise<{ acquired: string[]; cleared: string[] }> {
  const acquired: string[] = [];
  const cleared: string[] = [];
  const queue = filterProgressAppliedEventsForUid(input.queue, input.currentUid);
  let event = peekNextProgressAppliedEvent(queue, input.processed);
  while (event) {
    const action = resolveRideEndSlotAction({
      savedRouteId: event.routeId,
      routeCompleted: event.routeCompleted,
      savedRouteProgressStatus: "success",
      slotStatus: input.slotStatus,
      slotInitialized: input.slotInitialized,
      slotOwnerUid: input.slotOwnerUid,
      currentUid: input.currentUid,
      recordId: event.recordId,
      alreadyProcessed: input.processed.has(event.recordId),
    });
    if (action === "wait") break;
    if (action === "skip") {
      input.processed.add(event.recordId);
      event = peekNextProgressAppliedEvent(queue, input.processed);
      continue;
    }
    const op =
      action === "clear"
        ? await input.clearIfActive(event.routeId)
        : await input.ensureAcquired(event.routeId);
    if (shouldMarkSlotOpProcessed(op)) {
      input.processed.add(event.recordId);
      if (action === "acquire" && op.ok) acquired.push(event.routeId);
      if (action === "clear" && op.ok) cleared.push(event.routeId);
    }
    event = peekNextProgressAppliedEvent(queue, input.processed);
  }
  return { acquired, cleared };
}

describe("result-independent resume: controlled Promise lifecycle", () => {
  it("결과 null로 닫힌 뒤 progress resolve → 이벤트 발생 → 슬롯 acquire", async () => {
    const record = makeEndRecord();
    const resultCapture = makeStateCapture<RideEndResult | null>(makePendingResult(record));
    const events: SavedRouteProgressAppliedEvent[] = [];

    let resolveProgress!: (v: { progressRatio: number; completed: 0 | 1 }) => void;
    const progressPromise = new Promise<{ progressRatio: number; completed: 0 | 1 }>((r) => {
      resolveProgress = r;
    });

    const deps: PersistRideEndCoreDeps = {
      saveRideSessionFn: async () => "server-ride-1",
      updateSavedRouteProgressFn: async () => progressPromise,
      promoteSavedRouteFn: async () => {},
      onSavedRouteProgressApplied: (e) => {
        events.push(e);
      },
      ...noopSessionStorage,
    };

    const persistP = persistRideEndCore(
      makeBaseInput(record),
      {
        setLastRideResult: resultCapture.setter,
        setSavedRoutes: makeStateCapture<SavedRoute[]>([]).setter,
        setRecentSessions: makeStateCapture<StoredRideSession[]>([]).setter,
        setLastEndedWasAdhoc: makeStateCapture<unknown>(null).setter,
      },
      deps,
    );

    // 사용자가 결과창을 닫음 — UI state null (옛 경로는 여기서 슬롯 누락)
    resultCapture.set(null);

    resolveProgress({ progressRatio: 0.2, completed: 0 });
    await persistP;

    assert.equal(events.length, 1, "progress 성공 이벤트는 UI null 과 무관하게 발생");
    assert.equal(events[0]!.userId, "uid-A");
    assert.equal(events[0]!.routeId, "route-A");
    assert.equal(events[0]!.routeCompleted, false);
    assert.equal(resultCapture.get(), null, "UI result 는 null 유지");

    const processed = new Set<string>();
    const slotCalls: string[] = [];
    const { acquired } = await drainProgressEventsToSlot({
      queue: events,
      currentUid: "uid-A",
      processed,
      slotStatus: "ready",
      slotInitialized: true,
      slotOwnerUid: "uid-A",
      ensureAcquired: async (routeId) => {
        slotCalls.push(routeId);
        return { ok: true };
      },
      clearIfActive: async () => ({ ok: true }),
    });
    assert.deepEqual(acquired, ["route-A"]);
    assert.deepEqual(slotCalls, ["route-A"]);
    assert.ok(processed.has(record.id));
  });

  it("progress reject → 이벤트 없음 → 슬롯 획득 안 함", async () => {
    const record = makeEndRecord({ id: "rec-fail" });
    const resultCapture = makeStateCapture<RideEndResult | null>(makePendingResult(record));
    const events: SavedRouteProgressAppliedEvent[] = [];

    let rejectProgress!: (e: Error) => void;
    const progressPromise = new Promise<{ progressRatio: number; completed: 0 | 1 }>((_r, j) => {
      rejectProgress = j;
    });

    const persistP = persistRideEndCore(
      makeBaseInput(record),
      {
        setLastRideResult: resultCapture.setter,
        setSavedRoutes: makeStateCapture<SavedRoute[]>([]).setter,
        setRecentSessions: makeStateCapture<StoredRideSession[]>([]).setter,
        setLastEndedWasAdhoc: makeStateCapture<unknown>(null).setter,
      },
      {
        saveRideSessionFn: async () => "server-ride-2",
        updateSavedRouteProgressFn: async () => progressPromise,
        promoteSavedRouteFn: async () => {},
        onSavedRouteProgressApplied: (e) => {
          events.push(e);
        },
        ...noopSessionStorage,
      },
    );

    resultCapture.set(null);
    rejectProgress(new Error("progress failed"));
    await persistP;

    assert.equal(events.length, 0, "progress 실패 시 이벤트 금지");

    const { acquired } = await drainProgressEventsToSlot({
      queue: events,
      currentUid: "uid-A",
      processed: new Set(),
      slotStatus: "ready",
      slotInitialized: true,
      slotOwnerUid: "uid-A",
      ensureAcquired: async () => {
        throw new Error("ensureAcquired must not run");
      },
      clearIfActive: async () => ({ ok: true }),
    });
    assert.deepEqual(acquired, []);
  });

  it("UID 전환 후 늦은 progress 성공 → 다른 UID 슬롯에 적용 안 됨", async () => {
    const record = makeEndRecord({ id: "rec-uid-switch" });
    const events: SavedRouteProgressAppliedEvent[] = [];

    let resolveProgress!: (v: { progressRatio: number; completed: 0 | 1 }) => void;
    const progressPromise = new Promise<{ progressRatio: number; completed: 0 | 1 }>((r) => {
      resolveProgress = r;
    });

    const persistP = persistRideEndCore(
      makeBaseInput(record, { userId: "uid-A" }),
      {
        setLastRideResult: makeStateCapture<RideEndResult | null>(null).setter,
        setSavedRoutes: makeStateCapture<SavedRoute[]>([]).setter,
        setRecentSessions: makeStateCapture<StoredRideSession[]>([]).setter,
        setLastEndedWasAdhoc: makeStateCapture<unknown>(null).setter,
      },
      {
        saveRideSessionFn: async () => "server-ride-3",
        updateSavedRouteProgressFn: async () => progressPromise,
        promoteSavedRouteFn: async () => {},
        onSavedRouteProgressApplied: (e) => {
          events.push(e);
        },
        ...noopSessionStorage,
      },
    );

    resolveProgress({ progressRatio: 0.25, completed: 0 });
    await persistP;
    assert.equal(events.length, 1);
    assert.equal(events[0]!.userId, "uid-A");

    // 현재 세션은 uid-B — 늦은 이벤트는 필터로 폐기
    const filtered = filterProgressAppliedEventsForUid(events, "uid-B");
    assert.equal(filtered.length, 0);

    let ensureCalled = false;
    const { acquired } = await drainProgressEventsToSlot({
      queue: events,
      currentUid: "uid-B",
      processed: new Set(),
      slotStatus: "ready",
      slotInitialized: true,
      slotOwnerUid: "uid-B",
      ensureAcquired: async () => {
        ensureCalled = true;
        return { ok: true };
      },
      clearIfActive: async () => ({ ok: true }),
    });
    assert.equal(ensureCalled, false);
    assert.deepEqual(acquired, []);
  });

  it("save 실패 → progress 이벤트 없음", async () => {
    const record = makeEndRecord({ id: "rec-save-fail" });
    const events: SavedRouteProgressAppliedEvent[] = [];
    await persistRideEndCore(
      makeBaseInput(record),
      {
        setLastRideResult: makeStateCapture<RideEndResult | null>(makePendingResult(record)).setter,
        setSavedRoutes: makeStateCapture<SavedRoute[]>([]).setter,
        setRecentSessions: makeStateCapture<StoredRideSession[]>([]).setter,
        setLastEndedWasAdhoc: makeStateCapture<unknown>(null).setter,
      },
      {
        saveRideSessionFn: async () => {
          throw new Error("save failed");
        },
        updateSavedRouteProgressFn: async () => ({ progressRatio: 0.2, completed: 0 }),
        promoteSavedRouteFn: async () => {},
        onSavedRouteProgressApplied: (e) => {
          events.push(e);
        },
        ...noopSessionStorage,
      },
    );
    assert.equal(events.length, 0);
  });

  it("큐 FIFO — 마지막 덮어쓰기로 선행 이벤트 누락 없음", () => {
    const queue: ProgressAppliedSlotEvent[] = [
      { userId: "u1", recordId: "r1", routeId: "route-A", routeCompleted: false },
      { userId: "u1", recordId: "r2", routeId: "route-B", routeCompleted: true },
    ];
    const processed = new Set<string>();
    const first = peekNextProgressAppliedEvent(queue, processed);
    assert.equal(first?.recordId, "r1");
    processed.add("r1");
    const second = peekNextProgressAppliedEvent(queue, processed);
    assert.equal(second?.recordId, "r2");
  });
});
