// 단일 이어달리기 슬롯 정책 테스트
// pure layer(rideResumeSlotPolicy) + Firestore tx core(applyRideResumeSlotTx) 검증
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyRideResumeSlot,
  parseRideResumeSlot,
  isResumableRoute,
  isResumableProgressFields,
  hasResumableGeometryData,
  hasMeaningfulRideAfterTombstone,
  pickBootstrapRouteId,
  applySlotTransition,
  canResumeOffset,
  isResumeBlockedBySlot,
  filterProgressAppliedEventsForUid,
  peekNextProgressAppliedEvent,
  resolveRideEndSlotAction,
  shouldMarkSlotOpProcessed,
  type RideResumeSlot,
} from "../../src/lib/ride/rideResumeSlotPolicy.ts";
import { applyRideResumeSlotTx, type TxLike, type TxRef, type TxSnap } from "../../src/lib/ride/repo/firestoreRideResumeSlot.ts";
import {
  acquireLocalRideResumeSlot,
  clearLocalRideResumeSlotIfActive,
} from "../../src/lib/ride/repo/rideResumeSlotLocal.ts";
import { resolveNextRideView, resolveRecentRideActions } from "../../src/lib/ride/nextRideTarget.ts";
import type { SavedRoute } from "../../src/lib/route/repo/firestoreSavedRoutes.ts";
import type { StoredRideSession } from "../../src/lib/ride/rideSessionsStorage.ts";
import { lineStringLengthMeters, type LineStringGeometry } from "../../src/lib/geo/geo.ts";
import { SAVED_ROUTE_EXPIRY_MS } from "../../src/lib/route/repo/firestoreSavedRoutes.ts";

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

function makeGeometry(points = 11): LineStringGeometry {
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i++) coords.push([127.0 + i * 0.001, 37.5]);
  return { type: "LineString", coordinates: coords };
}

const GEOMETRY = makeGeometry();
const GEO_LEN = lineStringLengthMeters(GEOMETRY);
const GEO_JSON = JSON.stringify(GEOMETRY.coordinates);

function makeRoute(over: Partial<SavedRoute> = {}): SavedRoute {
  return {
    id: "route-A",
    name: "경로A",
    profile: "cycling",
    startLngLat: GEOMETRY.coordinates[0],
    endLngLat: GEOMETRY.coordinates[GEOMETRY.coordinates.length - 1],
    waypoints: [],
    geometry: GEOMETRY,
    distanceMeters: GEO_LEN,
    durationSec: 600,
    createdAtIso: "2026-08-01T00:00:00.000Z",
    updatedAtIso: "2026-08-01T00:00:00.000Z",
    completed: 0,
    completedAtIso: null,
    expiresAtIso: null,
    lastRideId: null,
    lastProgressRatio: 0.2,
    ...over,
  };
}

function makeRide(over: Partial<StoredRideSession> = {}): StoredRideSession {
  return {
    id: "ride-1",
    endedAt: "2026-08-29T10:00:00.000Z",
    elapsedSec: 600,
    distanceMeters: 5200,
    avgSpeedKmh: 31,
    caloriesEstimate: 156,
    routeDistanceMeters: GEO_LEN,
    routeDurationSec: 600,
    userRouteId: "route-A",
    completionRatio: 0.2,
    sessionEndLngLat: [127.002, 37.5],
    ...over,
  };
}

function makeRouteDoc(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: "uid1",
    completed: 0,
    lastProgressRatio: 0.2,
    geometryCoordsJson: GEO_JSON,
    expiresAt: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// 순수 정책 테스트
// ---------------------------------------------------------------------------

describe("emptyRideResumeSlot / parseRideResumeSlot", () => {
  it("기본 슬롯은 미초기화·빈 active", () => {
    const s = emptyRideResumeSlot();
    assert.equal(s.v, 1);
    assert.equal(s.activeRouteId, null);
    assert.equal(s.initialized, false);
  });

  it("유효한 객체를 파싱한다", () => {
    const raw = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const s = parseRideResumeSlot(raw);
    assert.equal(s.activeRouteId, "route-A");
    assert.equal(s.initialized, true);
  });

  it("잘못된 입력은 empty로 폴백", () => {
    assert.deepEqual(parseRideResumeSlot(null), emptyRideResumeSlot());
    assert.deepEqual(parseRideResumeSlot({ v: 2 }), emptyRideResumeSlot());
  });
});

describe("isResumableRoute / progress / geometry", () => {
  it("0<progress<0.98이고 geometry가 유효하면 재개 가능", () => {
    assert.ok(isResumableRoute(makeRoute({ lastProgressRatio: 0.2 })));
  });
  it("completed=1이면 재개 불가", () => {
    assert.equal(isResumableRoute(makeRoute({ completed: 1, lastProgressRatio: 0.2 })), false);
  });
  it("progress=0이면 재개 불가", () => {
    assert.equal(isResumableProgressFields({ completed: 0, lastProgressRatio: 0 }), false);
  });
  it("progress>=0.98이면 재개 불가", () => {
    assert.equal(isResumableProgressFields({ completed: 0, lastProgressRatio: 0.98 }), false);
  });
  it("geometryCoordsJson 없으면 geometry 무효", () => {
    assert.equal(hasResumableGeometryData({}), false);
  });
  it("geometryCoordsJson 2점 이상이면 유효", () => {
    assert.ok(hasResumableGeometryData({ geometryCoordsJson: GEO_JSON }));
  });
});

describe("applySlotTransition", () => {
  it("bootstrap: !initialized 시 활성화", () => {
    const s = emptyRideResumeSlot();
    const next = applySlotTransition(s, { type: "bootstrap", routeId: "route-A" });
    assert.equal(next.activeRouteId, "route-A");
    assert.equal(next.initialized, true);
  });

  it("bootstrap: initialized면 no-op", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const next = applySlotTransition(s, { type: "bootstrap", routeId: "route-A" });
    assert.equal(next.activeRouteId, null);
  });

  it("acquire: 빈 슬롯이면 획득", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const next = applySlotTransition(s, { type: "acquire", routeId: "route-B" });
    assert.equal(next.activeRouteId, "route-B");
  });

  it("acquire: 다른 id 활성 중이면 교체 안 함", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const next = applySlotTransition(s, { type: "acquire", routeId: "route-B" });
    assert.equal(next.activeRouteId, "route-A");
  });

  it("abandon: expectedRouteId 불일치면 no-op (낡은 A가 현재 B를 포기시키지 않음)", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: "route-B", initialized: true, lastProcessedEnd: null };
    const next = applySlotTransition(s, {
      type: "abandon",
      at: "2026-10-06T00:00:00.000Z",
      expectedRouteId: "route-A",
    });
    assert.equal(next.activeRouteId, "route-B");
    assert.equal(next.lastProcessedEnd, null);
  });

  it("abandon: expectedRouteId 일치 시 해제 + tombstone", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const now = "2026-10-06T00:00:00.000Z";
    const next = applySlotTransition(s, { type: "abandon", at: now, expectedRouteId: "route-A" });
    assert.equal(next.activeRouteId, null);
    assert.equal(next.lastProcessedEnd?.routeId, "route-A");
  });

  it("clearIfActive: 일치하는 id만 해제", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const next = applySlotTransition(s, { type: "clearIfActive", routeId: "route-A" });
    assert.equal(next.activeRouteId, null);
  });

  it("clearIfActive: 다른 id는 no-op", () => {
    const s: RideResumeSlot = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const next = applySlotTransition(s, { type: "clearIfActive", routeId: "route-B" });
    assert.equal(next.activeRouteId, "route-A");
  });

  it("markInitializedEmpty: initialized=true, active=null", () => {
    const s = emptyRideResumeSlot();
    const next = applySlotTransition(s, { type: "markInitializedEmpty" });
    assert.equal(next.initialized, true);
    assert.equal(next.activeRouteId, null);
  });
});

describe("canResumeOffset / isResumeBlockedBySlot", () => {
  it("active===routeId → canResumeOffset true", () => {
    assert.ok(canResumeOffset("route-A", "route-A"));
  });
  it("active===null → canResumeOffset false", () => {
    assert.equal(canResumeOffset(null, "route-A"), false);
  });
  it("active=다른 id → isResumeBlockedBySlot true", () => {
    assert.ok(isResumeBlockedBySlot("route-A", "route-B"));
  });
});

describe("tombstone: 이름변경 updatedAt만으로는 재확보 금지", () => {
  it("abandon 후 updatedAt만 올라도 meaningful ride 없음", () => {
    const lastProcessedEnd = { routeId: "route-A", at: "2026-10-06T00:00:00.000Z" };
    assert.equal(
      hasMeaningfulRideAfterTombstone({
        routeId: "route-A",
        rides: [],
        lastProcessedEnd,
      }),
      false,
    );
    // 이름 변경으로 updatedAt이 올라도 rides에 새 endedAt이 없으면 false
    assert.equal(
      hasMeaningfulRideAfterTombstone({
        routeId: "route-A",
        rides: [makeRide({ endedAt: "2026-10-05T00:00:00.000Z" })],
        lastProcessedEnd,
      }),
      false,
    );
  });

  it("abandon 이후 새 ride endedAt이 있으면 true", () => {
    const lastProcessedEnd = { routeId: "route-A", at: "2026-10-06T00:00:00.000Z" };
    assert.ok(
      hasMeaningfulRideAfterTombstone({
        routeId: "route-A",
        rides: [makeRide({ endedAt: "2026-10-07T00:00:00.000Z" })],
        lastProcessedEnd,
      }),
    );
  });
});

describe("pickBootstrapRouteId", () => {
  it("재개 가능 경로가 있으면 id 반환", () => {
    const id = pickBootstrapRouteId({
      routes: [makeRoute()],
      rides: [makeRide()],
      slot: emptyRideResumeSlot(),
    });
    assert.equal(id, "route-A");
  });

  it("tombstone(abandon 이후 새 ride 없음)은 건너뜀 — updatedAt만 올라도", () => {
    const slot: RideResumeSlot = {
      v: 1,
      activeRouteId: null,
      initialized: false,
      lastProcessedEnd: { routeId: "route-A", at: "2026-10-06T00:00:00.000Z" },
    };
    const route = makeRoute({ updatedAtIso: "2026-10-07T00:00:00.000Z" }); // 이름변경 가정
    const id = pickBootstrapRouteId({ routes: [route], rides: [], slot });
    assert.equal(id, null);
  });

  it("tombstone이어도 포기 이후 새 ride면 후보", () => {
    const slot: RideResumeSlot = {
      v: 1,
      activeRouteId: null,
      initialized: false,
      lastProcessedEnd: { routeId: "route-A", at: "2026-10-05T00:00:00.000Z" },
    };
    const route = makeRoute({ updatedAtIso: "2026-10-06T00:00:00.000Z" });
    const id = pickBootstrapRouteId({
      routes: [route],
      rides: [makeRide({ endedAt: "2026-10-06T12:00:00.000Z" })],
      slot,
    });
    assert.equal(id, "route-A");
  });
});

describe("A20% 활성 중 B 주행 종료 → A 슬롯 유지", () => {
  const routeA = makeRoute({ id: "route-A", lastProgressRatio: 0.2 });
  const routeB = makeRoute({
    id: "route-B",
    lastProgressRatio: 0,
    completed: 0,
    name: "경로B",
    updatedAtIso: "2026-09-01T00:00:00.000Z",
  });
  const slotWithA: RideResumeSlot = {
    v: 1,
    activeRouteId: "route-A",
    initialized: true,
    lastProcessedEnd: null,
  };

  it("A가 활성일 때 B acquire 시도는 차단", () => {
    const next = applySlotTransition(slotWithA, { type: "acquire", routeId: "route-B" });
    assert.equal(next.activeRouteId, "route-A");
  });

  it("resolveNextRideView: active=A면 A 20% 표시", () => {
    const rideA = makeRide({ id: "ride-A", userRouteId: "route-A", completionRatio: 0.2 });
    const view = resolveNextRideView({
      rides: [rideA],
      savedRoutes: [routeA, routeB],
      activeRouteId: "route-A",
    });
    assert.equal(view?.target.kind, "resume_route");
    assert.equal(view?.target.kind === "resume_route" ? view.target.routeId : null, "route-A");
    const progress = view?.target.kind === "resume_route" ? view.target.progressRatio : 0;
    assert.ok(Math.abs(progress - 0.2) < 1e-9);
  });

  it("history eviction: ride 없어도 slot synthetic view(거리·시간 0)", () => {
    const view = resolveNextRideView({
      rides: [],
      savedRoutes: [routeA],
      activeRouteId: "route-A",
    });
    assert.equal(view?.target.kind, "resume_route");
    assert.equal(view?.ride.distanceMeters, 0);
    assert.equal(view?.ride.elapsedSec, 0);
    assert.equal(view?.ride.id.startsWith("slot:"), true);
  });

  it("active=A 중 B에 대한 이어달리기 버튼은 resumeBlocked=true", () => {
    const rideB = makeRide({
      id: "ride-B",
      userRouteId: "route-B",
      completionRatio: 0.3,
      endedAt: "2026-09-01T12:00:00.000Z",
    });
    const routeBWithProgress = makeRoute({ id: "route-B", lastProgressRatio: 0.3 });
    const actions = resolveRecentRideActions(rideB, [routeA, routeBWithProgress], {
      activeRouteId: "route-A",
    });
    assert.equal(actions.resumeRouteId, null);
    assert.equal(actions.resumeBlocked, true);
  });
});

describe("abandon 후 reload → A tombstone → 새 B는 ensureAcquired만", () => {
  it("abandon 후 pickBootstrap이 A를 건너뜀", () => {
    const now = "2026-10-06T00:00:00.000Z";
    let slot = emptyRideResumeSlot();
    slot = applySlotTransition(slot, { type: "bootstrap", routeId: "route-A" });
    slot = applySlotTransition(slot, { type: "abandon", at: now, expectedRouteId: "route-A" });
    const routeA = makeRoute({ updatedAtIso: "2026-10-07T00:00:00.000Z" });
    const id = pickBootstrapRouteId({ routes: [routeA], rides: [], slot });
    assert.equal(id, null);
  });

  it("abandon 후 새 B는 acquire 가능(명시 ensureAcquired 경로)", () => {
    const now = "2026-10-06T00:00:00.000Z";
    let slot: RideResumeSlot = {
      v: 1,
      activeRouteId: "route-A",
      initialized: true,
      lastProcessedEnd: null,
    };
    slot = applySlotTransition(slot, { type: "abandon", at: now, expectedRouteId: "route-A" });
    const next = applySlotTransition(slot, { type: "acquire", routeId: "route-B" });
    assert.equal(next.activeRouteId, "route-B");
  });

  it("초기화 후 과거 B가 자동 bootstrap되지 않음(initialized empty)", () => {
    let slot = emptyRideResumeSlot();
    slot = applySlotTransition(slot, { type: "markInitializedEmpty" });
    // bootstrap no-op
    const after = applySlotTransition(slot, { type: "bootstrap", routeId: "route-B" });
    assert.equal(after.activeRouteId, null);
    assert.equal(after.initialized, true);
  });
});

describe("resolveNextRideView: activeRouteId=null", () => {
  it("슬롯 빈 상태(null)에서 미완주 경로가 있어도 resume 선택 안 함", () => {
    const ride = makeRide();
    const route = makeRoute({ lastProgressRatio: 0.3 });
    const view = resolveNextRideView({
      rides: [ride],
      savedRoutes: [route],
      activeRouteId: null,
    });
    assert.ok(view === null || view.target.kind === "extend_from_ride");
  });
});

describe("resolveRecentRideActions legacy", () => {
  it("activeRouteId 미전달 시 resumeBlocked=false", () => {
    const ride = makeRide({ userRouteId: "route-B" });
    const route = makeRoute({ id: "route-B", lastProgressRatio: 0.3 });
    const actions = resolveRecentRideActions(ride, [route]);
    assert.equal(actions.resumeBlocked, false);
    assert.equal(actions.resumeRouteId, "route-B");
  });
});

// ---------------------------------------------------------------------------
// fake tx: applyRideResumeSlotTx
// ---------------------------------------------------------------------------

describe("applyRideResumeSlotTx (fake tx)", () => {
  function makeFakeStore(
    userDoc: Record<string, unknown> | null,
    routes: Record<string, Record<string, unknown> | null> = {},
  ) {
    const store: Map<string, Record<string, unknown>> = new Map();
    if (userDoc) store.set("users/uid1", userDoc);
    for (const [id, docData] of Object.entries(routes)) {
      if (docData) store.set(`savedRoutes/${id}`, docData);
    }

    const updates: Map<string, Record<string, unknown>> = new Map();

    const tx: TxLike = {
      async get(ref: TxRef): Promise<TxSnap> {
        // apply pending updates for subsequent reads in same "tx" simulation
        const base = store.get(ref.path) ?? null;
        const pending = updates.get(ref.path);
        const data = base || pending ? { ...(base ?? {}), ...(pending ?? {}) } : null;
        return {
          exists: () => data !== null,
          data: () => data ?? {},
        };
      },
      update(ref: TxRef, data: Record<string, unknown>) {
        const current = updates.get(ref.path) ?? {};
        updates.set(ref.path, { ...current, ...data });
        const base = store.get(ref.path);
        if (base) store.set(ref.path, { ...base, ...data });
      },
      set(ref: TxRef, data: Record<string, unknown>) {
        updates.set(ref.path, data);
        store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
      },
    };
    return { tx, updates, store };
  }

  const makeRef = (path: string): TxRef => ({ path });

  it("acquire: 성공 시 expiresAt=null로 TTL 보호", async () => {
    const initSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: initSlot }, {
      "route-A": makeRouteDoc({ expiresAt: { toDate: () => new Date() } }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "acquire",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(result.ok, `acquire 실패: ${!result.ok ? result.reason : ""}`);
    assert.equal(updates.get("savedRoutes/route-A")?.expiresAt, null);
    assert.equal(result.slot.activeRouteId, "route-A");
  });

  it("bootstrap initialized no-op: TTL을 null로 바꾸지 않음", async () => {
    const initSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: initSlot }, {
      "route-A": makeRouteDoc({ expiresAt: "keep-me" }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "bootstrap",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(result.ok);
    assert.equal(result.slot.activeRouteId, null);
    assert.equal(updates.has("savedRoutes/route-A"), false);
  });

  it("acquire progress=0이면 route_not_resumable + TTL 미변경", async () => {
    const initSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: initSlot }, {
      "route-A": makeRouteDoc({ lastProgressRatio: 0 }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "acquire",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "route_not_resumable");
    assert.equal(updates.has("savedRoutes/route-A"), false);
  });

  it("acquire geometry 없으면 route_geometry_invalid", async () => {
    const initSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const { tx } = makeFakeStore({ rideResumeSlot: initSlot }, {
      "route-A": { userId: "uid1", completed: 0, lastProgressRatio: 0.2 },
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "acquire",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "route_geometry_invalid");
  });

  it("acquire 경쟁: slot_occupied", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-other", initialized: true, lastProcessedEnd: null };
    const { tx } = makeFakeStore({ rideResumeSlot: slotWithA }, {
      "route-A": makeRouteDoc(),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "acquire",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "slot_occupied");
  });

  it("abandon expectedRouteId 불일치: 현재 B 유지", async () => {
    const slotWithB = { v: 1, activeRouteId: "route-B", initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: slotWithB }, {
      "route-B": makeRouteDoc(),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "abandon",
      expectedRouteId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "expected_mismatch");
    assert.equal(result.slot.activeRouteId, "route-B");
    assert.equal(updates.has("savedRoutes/route-B"), false);
  });

  it("abandon 미완주: expiresAt 복구", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: slotWithA }, {
      "route-A": makeRouteDoc({ expiresAt: null }),
    });
    const now = "2026-10-06T00:00:00.000Z";
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "abandon",
      expectedRouteId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
      now,
    });
    assert.ok(result.ok);
    assert.equal(result.slot.activeRouteId, null);
    const expiresAt = updates.get("savedRoutes/route-A")?.expiresAt as { toDate?: () => Date };
    assert.ok(expiresAt && typeof expiresAt.toDate === "function");
    const diff = expiresAt.toDate!().getTime() - Date.parse(now);
    assert.ok(Math.abs(diff - SAVED_ROUTE_EXPIRY_MS) < 1000);
  });

  it("clearIfActive: 일치 id 해제, 삭제된 경로 문서 재생성 안 함", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: slotWithA }, {});
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      expectedUid: "uid1",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(result.ok);
    assert.equal(result.slot.activeRouteId, null);
    assert.equal(updates.has("savedRoutes/route-A"), false);
  });

  it("clearIfActive: 유효 미완주면 route_still_resumable 거부", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: slotWithA }, {
      "route-A": makeRouteDoc({ expiresAt: null }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      expectedUid: "uid1",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "route_still_resumable");
    assert.equal(result.slot.activeRouteId, "route-A");
    assert.equal(updates.has("users/uid1"), false);
  });

  it("clearIfActive: completed=1 이면 해제", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const { tx } = makeFakeStore({ rideResumeSlot: slotWithA }, {
      "route-A": makeRouteDoc({ completed: 1, lastProgressRatio: 1 }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      expectedUid: "uid1",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(result.ok);
    assert.equal(result.slot.activeRouteId, null);
  });

  it("clearIfActive: progress≥0.98 이면 해제 + 미완주 TTL 복구", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: slotWithA }, {
      "route-A": makeRouteDoc({ completed: 0, lastProgressRatio: 0.99, expiresAt: null }),
    });
    const now = "2026-10-06T00:00:00.000Z";
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      expectedUid: "uid1",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
      now,
    });
    assert.ok(result.ok);
    assert.equal(result.slot.activeRouteId, null);
    assert.ok(updates.get("savedRoutes/route-A")?.expiresAt != null);
  });

  it("clearIfActive: expectedUid 불일치면 uid_mismatch", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const { tx } = makeFakeStore({ rideResumeSlot: slotWithA }, {
      "route-A": makeRouteDoc({ completed: 1 }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      expectedUid: "other-uid",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "uid_mismatch");
    assert.equal(result.slot.activeRouteId, "route-A");
  });

  it("clearIfActive: 경로 읽기 거절은 삭제로 오인하지 않음", async () => {
    const slotWithA = { v: 1, activeRouteId: "route-A", initialized: true, lastProcessedEnd: null };
    const store: Map<string, Record<string, unknown>> = new Map([
      ["users/uid1", { rideResumeSlot: slotWithA }],
    ]);
    const tx: TxLike = {
      async get(ref: TxRef): Promise<TxSnap> {
        if (ref.path.startsWith("savedRoutes/")) {
          throw new Error("permission-denied");
        }
        const data = store.get(ref.path) ?? null;
        return { exists: () => data !== null, data: () => data ?? {} };
      },
      update() {},
      set() {},
    };
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      expectedUid: "uid1",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok ? result.reason : "", "route_read_denied");
    assert.equal(result.slot.activeRouteId, "route-A");
  });

  it("clear 완주 race: 낡은 clear(A)가 새 슬롯 B를 지우지 않음", async () => {
    const slotWithB = { v: 1, activeRouteId: "route-B", initialized: true, lastProcessedEnd: null };
    const { tx, updates } = makeFakeStore({ rideResumeSlot: slotWithB }, {
      "route-B": makeRouteDoc({ id: "route-B" }),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "clearIfActive",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(result.ok);
    assert.equal(result.slot.activeRouteId, "route-B");
    assert.equal(updates.has("users/uid1"), false);
  });

  it("TTL 보호 중 progress max write는 expiresAt을 복원하지 않음(시뮬레이션)", async () => {
    // acquire로 null 보호 후, progress update는 expiresAt 필드를 쓰지 않는 계약
    const initSlot = { v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null };
    const { tx, updates, store } = makeFakeStore({ rideResumeSlot: initSlot }, {
      "route-A": makeRouteDoc({ expiresAt: { toDate: () => new Date() } }),
    });
    const acquired = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "acquire",
      routeId: "route-A",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(acquired.ok);
    assert.equal(store.get("savedRoutes/route-A")?.expiresAt, null);

    // progress max 갱신 시뮬레이션 — expiresAt 미포함
    tx.update(makeRef("savedRoutes/route-A"), {
      lastProgressRatio: 0.43,
      lastRideId: "ride-new",
    });
    assert.equal(store.get("savedRoutes/route-A")?.expiresAt, null);
    assert.equal(updates.get("savedRoutes/route-A")?.expiresAt, null);
  });

  it("markInitializedEmpty: TTL 미터치", async () => {
    const { tx, updates } = makeFakeStore({ rideResumeSlot: null }, {
      "route-A": makeRouteDoc(),
    });
    const result = await applyRideResumeSlotTx(tx, {
      uid: "uid1",
      operation: "markInitializedEmpty",
      makeUserRef: (uid) => makeRef(`users/${uid}`),
      makeRouteRef: (rid) => makeRef(`savedRoutes/${rid}`),
    });
    assert.ok(result.ok);
    assert.equal(result.slot.initialized, true);
    assert.equal(result.slot.activeRouteId, null);
    assert.equal(updates.has("savedRoutes/route-A"), false);
  });
});

// ---------------------------------------------------------------------------
// App 배선: progress 성공 후 슬롯 op · UID guard
// ---------------------------------------------------------------------------

describe("resolveRideEndSlotAction (App wiring)", () => {
  const base = {
    savedRouteId: "route-A",
    routeCompleted: false,
    savedRouteProgressStatus: "success" as const,
    slotStatus: "ready" as const,
    slotInitialized: true,
    slotOwnerUid: "uid1",
    currentUid: "uid1",
    recordId: "rec-1",
    alreadyProcessed: false,
  };

  it("progress pending → wait (ensureAcquired 지연)", () => {
    assert.equal(
      resolveRideEndSlotAction({ ...base, savedRouteProgressStatus: "pending" }),
      "wait",
    );
  });

  it("progress success + 미완주 → acquire", () => {
    assert.equal(resolveRideEndSlotAction(base), "acquire");
  });

  it("progress success + 완주 → clear", () => {
    assert.equal(resolveRideEndSlotAction({ ...base, routeCompleted: true }), "clear");
  });

  it("slot loading / owner 불일치 → wait", () => {
    assert.equal(resolveRideEndSlotAction({ ...base, slotStatus: "loading" }), "wait");
    assert.equal(resolveRideEndSlotAction({ ...base, slotOwnerUid: "other" }), "wait");
  });

  it("이미 processed / progress failed → skip", () => {
    assert.equal(resolveRideEndSlotAction({ ...base, alreadyProcessed: true }), "skip");
    assert.equal(
      resolveRideEndSlotAction({ ...base, savedRouteProgressStatus: "failed" }),
      "skip",
    );
  });

  it("shouldMarkSlotOpProcessed: 성공·영구점유만", () => {
    assert.equal(shouldMarkSlotOpProcessed({ ok: true }), true);
    assert.equal(shouldMarkSlotOpProcessed({ ok: false, reason: "slot_occupied" }), true);
    assert.equal(shouldMarkSlotOpProcessed({ ok: false, reason: "uid_mismatch" }), true);
    assert.equal(shouldMarkSlotOpProcessed({ ok: false, reason: "route_not_resumable" }), false);
    assert.equal(shouldMarkSlotOpProcessed({ ok: false, reason: "lock_busy" }), false);
  });

  it("filterProgressAppliedEventsForUid: 다른 UID 늦은 성공 폐기", () => {
    const events = [
      { userId: "a", recordId: "r1", routeId: "route-A", routeCompleted: false },
      { userId: "b", recordId: "r2", routeId: "route-B", routeCompleted: false },
    ];
    assert.deepEqual(filterProgressAppliedEventsForUid(events, "b").map((e) => e.recordId), ["r2"]);
    assert.deepEqual(filterProgressAppliedEventsForUid(events, null), []);
  });

  it("peekNextProgressAppliedEvent: FIFO, 덮어쓰기 누락 없음", () => {
    const events = [
      { userId: "a", recordId: "r1", routeId: "route-A", routeCompleted: false },
      { userId: "a", recordId: "r2", routeId: "route-B", routeCompleted: true },
    ];
    const processed = new Set<string>();
    assert.equal(peekNextProgressAppliedEvent(events, processed)?.recordId, "r1");
    processed.add("r1");
    assert.equal(peekNextProgressAppliedEvent(events, processed)?.recordId, "r2");
  });
});

// ---------------------------------------------------------------------------
// Guest local: Web Locks 직렬화 · clear 유효미완주 거부
// ---------------------------------------------------------------------------

describe("rideResumeSlotLocal (Guest locks + clear guard)", () => {
  const uid = "guest-lock-test-uid";
  const slotStorageKey = `boxcycle_ride_resume_slot_v1_${uid}`;

  function installLocalStorageMock() {
    const map = new Map<string, string>();
    const ls = {
      getItem(k: string) {
        return map.has(k) ? map.get(k)! : null;
      },
      setItem(k: string, v: string) {
        map.set(k, String(v));
      },
      removeItem(k: string) {
        map.delete(k);
      },
      clear() {
        map.clear();
      },
    };
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: ls,
    });
    return {
      restore() {
        if (prev === undefined) {
          // @ts-expect-error cleanup
          delete (globalThis as { localStorage?: unknown }).localStorage;
        } else {
          Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            value: prev,
          });
        }
      },
    };
  }

  function installWebLocksMock() {
    type LockCb = () => Promise<unknown> | unknown;
    let chain: Promise<unknown> = Promise.resolve();
    const held: string[] = [];
    const locks = {
      request(_name: string, _opts: unknown, cb: LockCb) {
        const run = chain.then(async () => {
          held.push("x");
          try {
            return await cb();
          } finally {
            held.pop();
          }
        });
        chain = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      },
    };
    const prev = (globalThis as { navigator?: unknown }).navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { ...(prev as object), locks },
    });
    return {
      get concurrentHeld() {
        return held.length;
      },
      restore() {
        if (prev === undefined) {
          // @ts-expect-error cleanup
          delete globalThis.navigator;
        } else {
          Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: prev,
          });
        }
      },
    };
  }

  function seedEmptyInitializedSlot() {
    localStorage.setItem(
      slotStorageKey,
      JSON.stringify({ v: 1, activeRouteId: null, initialized: true, lastProcessedEnd: null }),
    );
  }

  it("Web Locks로 동시 acquire 직렬화 — 한 경로만 성공", async () => {
    const ls = installLocalStorageMock();
    const mock = installWebLocksMock();
    try {
      seedEmptyInitializedSlot();
      const routeA = makeRoute({ id: "route-A", lastProgressRatio: 0.2 });
      const routeB = makeRoute({ id: "route-B", lastProgressRatio: 0.3 });
      const [a, b] = await Promise.all([
        acquireLocalRideResumeSlot(uid, "route-A", [routeA, routeB]),
        acquireLocalRideResumeSlot(uid, "route-B", [routeA, routeB]),
      ]);
      const wins = [a, b].filter((r) => r.ok);
      const occupied = [a, b].filter((r) => !r.ok && r.reason === "slot_occupied");
      assert.equal(wins.length, 1);
      assert.equal(occupied.length, 1);
      assert.ok(mock.concurrentHeld <= 1);
    } finally {
      mock.restore();
      ls.restore();
    }
  });

  it("clearIfActive: 유효 미완주면 거부, force면 해제", async () => {
    const ls = installLocalStorageMock();
    const mock = installWebLocksMock();
    try {
      localStorage.setItem(
        slotStorageKey,
        JSON.stringify({
          v: 1,
          activeRouteId: "route-A",
          initialized: true,
          lastProcessedEnd: null,
        }),
      );
      const routeA = makeRoute({ id: "route-A", lastProgressRatio: 0.2 });
      const refused = await clearLocalRideResumeSlotIfActive(uid, "route-A", [routeA]);
      assert.equal(refused.ok, false);
      assert.equal(!refused.ok ? refused.reason : "", "route_still_resumable");

      const forced = await clearLocalRideResumeSlotIfActive(uid, "route-A", [routeA], {
        force: true,
      });
      assert.ok(forced.ok);
      assert.equal(forced.slot.activeRouteId, null);
    } finally {
      mock.restore();
      ls.restore();
    }
  });
});
