/**
 * Guest 수명 — 메모리 포트로 시간 경계·경합·소유권·실패 재시도를 실행한다.
 * 실행: functions 에서 `npm test` (guestLifecycleCore.test.js).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { handleGuestActivityRequest, handleGuestLinkRequest } from "./guestLifecycleHandlers.js";
import { authSnapshotFromFields } from "./guestLifecycleAdmin.js";
import {
  GUEST_INACTIVITY_MS,
  GUEST_WRITE_BLOCK_STATUSES,
  MemoryGuestAuth,
  MemoryGuestRtdb,
  MemoryGuestStore,
  beginGuestLinkLease,
  blankGuestLifecycleDoc,
  completeGuestLink,
  guestLifecyclePath,
  guestMarkerBlocksClientWrite,
  recordGuestActivity,
  runGuestLifecycleSweep,
  unionCandidateUids,
  type GuestLifecycleDoc,
  type GuestLifecyclePorts,
} from "./guestLifecycleCore.js";

function guest(uid = "guest-1") {
  return { uid, anonymous: true, disabled: false, admin: false, email: null };
}

function portsFor(auth: MemoryGuestAuth, store: MemoryGuestStore, rtdb: MemoryGuestRtdb, nowMs: number, extra: Partial<GuestLifecyclePorts> = {}): GuestLifecyclePorts {
  return {
    nowMs,
    auth,
    store,
    rtdb,
    protectedUids: new Set(),
    listAuthUsers: async () => auth.list(),
    listProfileUids: async () => [],
    listRetryUids: async () => [],
    readUserProfile: async () => null,
    recentRideOrPresence: async () => false,
    deleteAccountData: async () => undefined,
    ...extra,
  };
}

async function seed(store: MemoryGuestStore, uid: string, patch: Partial<GuestLifecycleDoc>) {
  await store.runTransaction(async (tx) => {
    tx.set(guestLifecyclePath(uid), { ...blankGuestLifecycleDoc(), ...patch });
  });
}

test("활동 시각이 30일에서 1ms 남으면 삭제하지 않고, 정확히 30일이면 삭제한다", async () => {
  const now = 5_000_000_000_000;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("edge", guest("edge"));
  await seed(store, "edge", { lastActivityAtMs: now - GUEST_INACTIVITY_MS + 1, observedAtMs: 0 });
  const keep = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now));
  assert.equal(keep.deleted, 0);
  assert.equal(keep.skippedFresh, 1);
  await seed(store, "edge", { lastActivityAtMs: now - GUEST_INACTIVITY_MS, observedAtMs: 0 });
  let deleted = 0;
  const drop = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now, {
    deleteAccountData: async () => { deleted += 1; },
  }));
  assert.equal(drop.deleted, 1);
  assert.equal(deleted, 1);
  assert.equal(auth.users.has("edge"), false);
});

test("활동 갱신 뒤에는 같은 시각의 배치가 지우지 않는다", async () => {
  const now = GUEST_INACTIVITY_MS + 50;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(store, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  const ping = await recordGuestActivity(portsFor(auth, store, rtdb, now), "g", now);
  assert.equal(ping.ok, true);
  const report = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now));
  assert.equal(report.deleted, 0);
  assert.equal(auth.users.has("g"), true);
});

test("등록·admin·보호 uid 는 Auth 와 데이터를 바꾸지 않는다", async () => {
  const now = GUEST_INACTIVITY_MS + 10;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("reg", { uid: "reg", anonymous: false, disabled: false, admin: false, email: "a@b.c" });
  auth.users.set("adm", { uid: "adm", anonymous: true, disabled: false, admin: true, email: null });
  auth.users.set("pro", guest("pro"));
  let deleted = 0;
  await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now, {
    protectedUids: new Set(["pro"]),
    deleteAccountData: async () => { deleted += 1; },
  }));
  assert.equal(deleted, 0);
  assert.deepEqual(auth.disabled, []);
  assert.equal(rtdb.blocked.size, 0);
  assert.equal(auth.users.get("reg")?.disabled, false);
});

test("Auth 만 있는 Guest 는 처음 관찰하고, 관찰 30일 뒤에 삭제한다", async () => {
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("only", guest("only"));
  const first = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, 1_000));
  assert.equal(first.observed, 1);
  assert.equal(auth.users.has("only"), true);
  let deleted = 0;
  const second = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, 1_000 + GUEST_INACTIVITY_MS, {
    deleteAccountData: async () => { deleted += 1; },
  }));
  assert.equal(second.deleted, 1);
  assert.equal(deleted, 1);
});

test("삭제 도중 실패하면 차단을 유지하고 다음 실행이 끝낸다", async () => {
  const now = GUEST_INACTIVITY_MS + 5;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(store, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  let calls = 0;
  const failPorts = portsFor(auth, store, rtdb, now, {
    deleteAccountData: async () => {
      calls += 1;
      if (calls === 1) throw new Error("storage unavailable");
    },
  });
  const first = await runGuestLifecycleSweep(failPorts);
  assert.equal(first.failed, 1);
  assert.equal(rtdb.blocked.get("g"), true);
  assert.equal(auth.users.get("g")?.disabled, true);
  const doc = await store.get(guestLifecyclePath("g"));
  assert.equal(doc?.status, "failed");
  assert.equal(doc?.disabledByLifecycle, true);
  const second = await runGuestLifecycleSweep({ ...failPorts, workerId: "retry" });
  assert.equal(second.deleted, 1);
  assert.equal(auth.users.has("g"), false);
  assert.equal(calls, 2);
});

test("연결 lease 중에는 삭제하지 않고, 예약 뒤에는 연결을 거절한다", async () => {
  const now = GUEST_INACTIVITY_MS + 20;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(store, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  const lease = await beginGuestLinkLease(portsFor(auth, store, rtdb, now), "g", now);
  assert.equal(lease.ok, true);
  const held = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now + 1_000));
  assert.equal(held.deleted, 0);
  assert.equal(held.skippedLease, 1);
  assert.deepEqual(auth.disabled, []);
  await seed(store, "g", {
    ...blankGuestLifecycleDoc(),
    status: "deletionScheduled",
    lastActivityAtMs: 0,
    observedAtMs: 0,
    generation: 2,
    deletionOwner: "owner",
    deletionLeaseUntilMs: now + 60_000,
  });
  const blocked = await beginGuestLinkLease(portsFor(auth, store, rtdb, now), "g", now);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, "deletion-pending");
});

test("우리가 끈 뒤에 Google 제공자가 보이면 복구하고, 데이터는 지우지 않는다", async () => {
  const now = GUEST_INACTIVITY_MS + 9;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  const original = auth.updateUser.bind(auth);
  auth.updateUser = async (uid, patch) => {
    await original(uid, patch);
    if (patch.disabled === true) {
      const user = auth.users.get(uid);
      if (user) {
        user.anonymous = false;
        user.email = "kept@example.com";
      }
    }
  };
  await seed(store, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  let deleted = 0;
  const report = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now, {
    deleteAccountData: async () => { deleted += 1; },
  }));
  assert.equal(report.restored, 1);
  assert.equal(deleted, 0);
  assert.equal(auth.users.get("g")?.disabled, false);
  assert.equal((await store.get(guestLifecyclePath("g")))?.status, "exempt");
});

test("pipeline 소유가 바뀌면 개인 데이터를 삭제하지 않는다", async () => {
  const now = GUEST_INACTIVITY_MS + 3;
  const inner = new MemoryGuestStore();
  const auth = new MemoryGuestAuth();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(inner, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  let steal = false;
  const store: MemoryGuestStore = Object.assign(inner, {
    runTransaction: (fn: Parameters<MemoryGuestStore["runTransaction"]>[0]) => inner.runTransaction(async (tx) => fn({
      get: async (path) => {
        const doc = await tx.get(path);
        if (steal && doc && doc.status === "disabling") return { ...doc, deletionOwner: "other-worker" };
        return doc;
      },
      set: (path, data) => {
        if (data.status === "disabling") steal = true;
        tx.set(path, data);
      },
    })),
  });
  let deleted = 0;
  const report = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, now, {
    workerId: "owner-a",
    deleteAccountData: async () => { deleted += 1; },
  }));
  assert.equal(deleted, 0);
  assert.notEqual(report.deleted, 1);
});

test("임대 중인 다른 worker 는 같은 Guest 를 삭제하지 않는다", async () => {
  const now = GUEST_INACTIVITY_MS + 8;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(store, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started = () => {};
  const startedGate = new Promise<void>((resolve) => { started = resolve; });
  let deletes = 0;
  const base = portsFor(auth, store, rtdb, now);
  const sweepA = runGuestLifecycleSweep({
    ...base,
    workerId: "worker-a",
    deleteAccountData: async () => {
      deletes += 1;
      started();
      await gate;
    },
  });
  await startedGate;
  const reportB = await runGuestLifecycleSweep({
    ...base,
    workerId: "worker-b",
    deleteAccountData: async () => { deletes += 1; },
  });
  assert.equal(reportB.deleted, 0);
  assert.equal(reportB.skippedBusy, 1);
  release();
  const reportA = await sweepA;
  assert.equal(reportA.deleted, 1);
  assert.equal(deletes, 1);
});

test("프로필 조회 오류는 그 uid 만 재시도하고 다른 Guest 를 막지 않는다", async () => {
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("bad", guest("bad"));
  auth.users.set("good", guest("good"));
  const report = await runGuestLifecycleSweep(portsFor(auth, store, rtdb, 10, {
    readUserProfile: async (uid) => {
      if (uid === "bad") throw new Error("unavailable");
      return null;
    },
  }));
  assert.equal(report.retryable, 1);
  assert.equal(report.observed, 1);
  assert.notEqual(rtdb.blocked.get("bad"), true);
  assert.deepEqual(auth.disabled, []);
});

test("users 가 없는 개인 데이터와 RTDB uid 를 후보에 합친다", () => {
  assert.deepEqual(unionCandidateUids(["auth-1"], ["private-1"], [], ["motion-1"]), ["auth-1", "private-1", "motion-1"]);
});

test("Auth 실제조회 스냅샷은 익명과 등록을 가른다", () => {
  const anon = authSnapshotFromFields({ uid: "a", disabled: false, providerCount: 0, email: null, phoneNumber: null, customClaims: {} });
  const google = authSnapshotFromFields({ uid: "g", disabled: true, providerCount: 1, email: "a@b.c", customClaims: {} });
  const admin = authSnapshotFromFields({ uid: "m", disabled: false, providerCount: 0, customClaims: { admin: true } });
  assert.equal(anon.anonymous, true);
  assert.equal(google.anonymous, false);
  assert.equal(admin.admin, true);
});

test("관리자가 끈 등록 계정은 연결 완료에서도 다시 켜지 않는다", async () => {
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", { uid: "g", anonymous: false, disabled: true, admin: false, email: "a@b.c" });
  const done = await completeGuestLink(portsFor(auth, store, rtdb, 1), "g", "lease-token-value");
  assert.equal(done.ok, true);
  assert.equal(auth.users.get("g")?.disabled, true);
  assert.deepEqual(auth.disabled, []);
});

test("활동과 삭제 예약은 둘 다 성공하지 않는다", async () => {
  const now = GUEST_INACTIVITY_MS + 4;
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(store, "g", { lastActivityAtMs: 0, observedAtMs: 0 });
  let deleted = 0;
  const shared = portsFor(auth, store, rtdb, now, { deleteAccountData: async () => { deleted += 1; } });
  const [activity, report] = await Promise.all([
    recordGuestActivity(shared, "g", now),
    runGuestLifecycleSweep(shared),
  ]);
  assert.equal(activity.ok && deleted > 0, false);
  assert.ok(activity.ok || report.deleted === 1 || report.failed === 1);
});

test("활동 HTTP 는 익명 Auth 조회가 아니면 거절하고, 정리 중이면 409 다", async () => {
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  auth.users.set("g", guest("g"));
  const deps = {
    nowMs: 10,
    verifyToken: async () => ({ uid: "g" }),
    ports: { auth, store },
  };
  const ok = await handleGuestActivityRequest({ method: "POST", authorization: "Bearer token" }, deps);
  assert.equal(ok.status, 200);
  auth.users.set("g", { ...guest("g"), anonymous: false, email: "a@b.c" });
  const denied = await handleGuestActivityRequest({ method: "POST", authorization: "Bearer token" }, deps);
  assert.equal(denied.status, 412);
  auth.users.set("g", guest("g"));
  await seed(store, "g", { status: "deletionScheduled", deletionOwner: "w", generation: 1 });
  const pending = await handleGuestActivityRequest({ method: "POST", authorization: "Bearer token" }, deps);
  assert.equal(pending.status, 409);
});

test("연결 HTTP 는 정리 중 begin 을 거절한다", async () => {
  const auth = new MemoryGuestAuth();
  const store = new MemoryGuestStore();
  const rtdb = new MemoryGuestRtdb();
  auth.users.set("g", guest("g"));
  await seed(store, "g", { status: "deleting", deletionOwner: "w", generation: 3, disabledByLifecycle: true });
  const out = await handleGuestLinkRequest(
    { method: "POST", authorization: "Bearer token", action: "begin", leaseToken: null },
    { nowMs: 10, verifyToken: async () => ({ uid: "g" }), ports: { auth, store, rtdb } },
  );
  assert.equal(out.status, 409);
});

test("Rules 의 클라이언트 쓰기는 만료 marker 를 보고, RTDB marker 는 본인이 못 쓴다", () => {
  const rules = readFileSync(path.resolve(process.cwd(), "..", "firestore.rules"), "utf8");
  const database = readFileSync(path.resolve(process.cwd(), "..", "database.rules.json"), "utf8");
  for (const status of GUEST_WRITE_BLOCK_STATUSES) assert.ok(rules.includes(`'${status}'`), status);
  const stripped = rules.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const allows = stripped.match(/allow\s+[^;]+;/g) ?? [];
  const writes = allows.filter((block) => /allow\s+(?:create|update|delete|write|read,\s*delete|read,\s*write|create,\s*update|update,\s*delete)/.test(block));
  const unguarded = writes.filter((block) => !block.includes("if false") && !block.includes("clientMayWrite") && !block.includes("isSelfWriter"));
  assert.deepEqual(unguarded, []);
  assert.equal(guestMarkerBlocksClientWrite("deletionScheduled"), true);
  assert.equal(guestMarkerBlocksClientWrite("active"), false);
  assert.match(database, /guestLifecycle/);
  assert.match(database, /blocked/);
  assert.match(database, /"\.write": false/);
});
