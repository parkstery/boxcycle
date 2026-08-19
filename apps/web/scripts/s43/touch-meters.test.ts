import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { User } from "firebase/auth";
import {
  resetOpenTrailListingRefreshForTests,
  scheduleOpenTrailListingRefresh,
} from "../../src/lib/firestoreOpenTrailListings.ts";
import {
  resetTouchActivityCoalesceForTests,
  resetTouchTrailDocWriterForTests,
  touchTrailInstanceActivity,
} from "../../src/lib/firestoreTrailInstance.ts";
import {
  resetPresenceUpsertWriterForTests,
  upsertTrailPresence,
} from "../../src/lib/firestoreTrail.ts";
import {
  beginTouchMeterWindow,
  endTouchMeterWindow,
  enterListingRefreshReadScope,
  leaveListingRefreshReadScope,
  noteListingRefreshRead,
  noteTrailDocSnapshotReceived,
  resetTouchActivityMeters,
  snapshotTouchActivityMeters,
} from "../../src/lib/touchActivityMeters.ts";

type Timer = { id: number; at: number; fn: () => void };

class FakeClock {
  originMs = 1_700_000_000_000;
  nowMs = 1_700_000_000_000;
  timers: Timer[] = [];
  nextId = 1;
  now = (): number => this.nowMs;
  setTimeout = (fn: () => void, ms: number): number => {
    const id = this.nextId++;
    this.timers.push({ id, at: this.nowMs + ms, fn });
    return id;
  };
  clearTimeout = (id: unknown): void => {
    this.timers = this.timers.filter((t) => t.id !== id);
  };
  async advanceTo(target: number): Promise<void> {
    while (true) {
      const due = this.timers
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id);
      if (due.length === 0) {
        this.nowMs = target;
        return;
      }
      const next = due[0]!;
      this.nowMs = next.at;
      this.timers = this.timers.filter((t) => t !== next);
      next.fn();
      await Promise.resolve();
      await Promise.resolve();
    }
  }
}

const fakeUser = { uid: "rider-a", photoURL: null } as User;

function listingFullPathReads(): Promise<void> {
  noteListingRefreshRead();
  noteListingRefreshRead();
  noteListingRefreshRead();
  noteListingRefreshRead();
  return Promise.resolve();
}

function installSeams(clock: FakeClock): void {
  resetTouchTrailDocWriterForTests(async () => {});
  resetPresenceUpsertWriterForTests(async () => {});
  resetTouchActivityCoalesceForTests(() => clock.now());
  resetOpenTrailListingRefreshForTests({
    clock,
    refreshBody: listingFullPathReads,
  });
}

async function runSoloRideWindowMs(windowMs: number) {
  const clock = new FakeClock();
  installSeams(clock);
  beginTouchMeterWindow({ riders: 1, spectators: 0 });
  for (let elapsed = 0; elapsed < windowMs; elapsed += 1_000) {
    await clock.advanceTo(clock.originMs + elapsed);
    await touchTrailInstanceActivity("trail-a", "routePublish");
    if (elapsed > 0 && elapsed % 30_000 === 0) {
      await touchTrailInstanceActivity("trail-a", "presenceHeartbeat");
      await upsertTrailPresence(fakeUser, "trail-a");
    }
  }
  await clock.advanceTo(clock.originMs + windowMs);
  if (windowMs % 30_000 === 0 && windowMs > 0) {
    await touchTrailInstanceActivity("trail-a", "presenceHeartbeat");
    await upsertTrailPresence(fakeUser, "trail-a");
  }
  await clock.advanceTo(clock.originMs + windowMs);
  return endTouchMeterWindow();
}

async function runSpectatorWindowMs(windowMs: number) {
  const clock = new FakeClock();
  installSeams(clock);
  beginTouchMeterWindow({ riders: 0, spectators: 1 });
  for (let elapsed = 30_000; elapsed <= windowMs; elapsed += 30_000) {
    await clock.advanceTo(clock.originMs + elapsed);
    await touchTrailInstanceActivity("trail-a", "presenceHeartbeat");
    await upsertTrailPresence(fakeUser, "trail-a");
  }
  await clock.advanceTo(clock.originMs + windowMs);
  return endTouchMeterWindow();
}

describe("touchActivityMeters", () => {
  beforeEach(() => {
    resetTouchActivityMeters();
    resetTouchTrailDocWriterForTests(async () => {});
    resetPresenceUpsertWriterForTests(async () => {});
    resetTouchActivityCoalesceForTests();
    resetOpenTrailListingRefreshForTests({ refreshBody: listingFullPathReads });
  });

  afterEach(() => {
    resetOpenTrailListingRefreshForTests();
    resetTouchTrailDocWriterForTests();
    resetPresenceUpsertWriterForTests();
    resetTouchActivityCoalesceForTests();
    resetTouchActivityMeters();
  });

  it("호출 지점별로 ①을 나누고 ②는 updateDoc 수행 지점에서 센다", async () => {
    let now = 0;
    resetTouchActivityCoalesceForTests(() => {
      now += 60_000;
      return now;
    });
    await touchTrailInstanceActivity("t1", "routePublish");
    await touchTrailInstanceActivity("t1", "presenceHeartbeat");
    await touchTrailInstanceActivity("t1", "appJoin");
    const snap = snapshotTouchActivityMeters();
    assert.equal(snap.touchCallsBySite.routePublish, 1);
    assert.equal(snap.touchCallsBySite.presenceHeartbeat, 1);
    assert.equal(snap.touchCallsBySite.appJoin, 1);
    assert.equal(snap.touchCallsBySite.progressTick, 0);
    assert.equal(snap.touchCallsTotal, 3);
    assert.equal(snap.trailUpdateDocTotal, 3);
    assert.ok(snap.touchCallsTotal >= 1, "계측이 살아 있음 — ① 비-0");
    assert.ok(snap.trailUpdateDocTotal >= 1, "계측이 살아 있음 — ② 비-0");
  });

  it("같은 Trail touch 는 heartbeat 간격 안으로 합친다 — ①은 남고 ②만 줄어든다", async () => {
    resetTouchActivityCoalesceForTests(() => 1_700_000_000_000);
    await touchTrailInstanceActivity("t1", "routePublish");
    await touchTrailInstanceActivity("t1", "routePublish");
    await touchTrailInstanceActivity("t1", "presenceHeartbeat");
    const snap = snapshotTouchActivityMeters();
    assert.equal(snap.touchCallsTotal, 3);
    assert.equal(snap.trailUpdateDocTotal, 1);
    assert.ok(snap.listingRefreshScheduleTotal >= 3);
  });

  it("source 생략은 unspecified 로 센다 (eslint 선행 오류 파일은 태그를 못 단다)", async () => {
    await touchTrailInstanceActivity("t1");
    assert.equal(snapshotTouchActivityMeters().touchCallsBySite.unspecified, 1);
    assert.equal(snapshotTouchActivityMeters().touchCallsTotal, 1);
  });

  it("③ Trail 문서 onSnapshot 은 수신 콜백에서만 오른다", () => {
    assert.equal(snapshotTouchActivityMeters().trailDocSnapshotReceivedTotal, 0);
    noteTrailDocSnapshotReceived();
    noteTrailDocSnapshotReceived();
    assert.equal(snapshotTouchActivityMeters().trailDocSnapshotReceivedTotal, 2);
  });

  it("listing 예약 수와 실행 수를 분리한다 — 예약이 실행보다 많다", async () => {
    const clock = new FakeClock();
    installSeams(clock);
    resetTouchActivityMeters();
    for (let i = 0; i < 8; i += 1) {
      scheduleOpenTrailListingRefresh("trail-a");
    }
    const beforeRun = snapshotTouchActivityMeters();
    assert.equal(beforeRun.listingRefreshScheduleTotal, 8);
    assert.equal(beforeRun.listingRefreshRunTotal, 0);
    await clock.advanceTo(clock.originMs + 2_500);
    const afterRun = snapshotTouchActivityMeters();
    assert.equal(afterRun.listingRefreshScheduleTotal, 8);
    assert.equal(afterRun.listingRefreshRunTotal, 1);
    assert.equal(afterRun.listingRefreshReadsTotal, 4);
    assert.ok(
      afterRun.listingRefreshScheduleTotal > afterRun.listingRefreshRunTotal,
      "예약을 비용으로 세면 과대다",
    );
  });

  it("listing read 는 재계산 스코프 안에서만 센다", () => {
    noteListingRefreshRead();
    assert.equal(snapshotTouchActivityMeters().listingRefreshReadsTotal, 0);
    enterListingRefreshReadScope();
    noteListingRefreshRead();
    leaveListingRefreshReadScope();
    noteListingRefreshRead();
    assert.equal(snapshotTouchActivityMeters().listingRefreshReadsTotal, 1);
  });

  it("⑤ presence heartbeat 쓰기는 upsert 수행 지점에서 센다", async () => {
    await upsertTrailPresence(fakeUser, "trail-a");
    await upsertTrailPresence(fakeUser, "trail-a");
    assert.equal(snapshotTouchActivityMeters().presenceHeartbeatWriteTotal, 2);
  });

  it("A 혼자 주행 60초 — ①②가 비-0 이고 routePublish 가 주 호출이다", async () => {
    const a = await runSoloRideWindowMs(60_000);
    assert.equal(a.riders, 1);
    assert.equal(a.spectators, 0);
    assert.equal(a.touchCallsBySite.routePublish, 60);
    assert.equal(a.touchCallsBySite.presenceHeartbeat, 2);
    assert.equal(a.touchCallsBySite.progressTick, 0);
    assert.equal(a.touchCallsTotal, 62);
    assert.equal(a.trailUpdateDocTotal, 3);
    assert.equal(a.presenceHeartbeatWriteTotal, 2);
    assert.equal(a.trailDocSnapshotReceivedTotal, 0);
    assert.ok(a.listingRefreshScheduleTotal >= 62);
    assert.equal(a.listingRefreshRunTotal, 2);
    assert.equal(a.listingRefreshReadsTotal, 8);
    assert.ok(a.touchCallsTotal > 0 && a.trailUpdateDocTotal > 0, "A 구간 ①② 비-0 — 배선 생존");
  });

  it("B/A 라이더 1→2 일 때 ②는 선형(약 2배)이지 제곱이 아니다", async () => {
    const a = await runSoloRideWindowMs(60_000);
    resetTouchActivityMeters();
    const b1 = await runSoloRideWindowMs(60_000);
    resetTouchActivityMeters();
    const b2 = await runSoloRideWindowMs(60_000);
    const combinedUpdate = b1.trailUpdateDocTotal + b2.trailUpdateDocTotal;
    const combinedSnap = b1.trailDocSnapshotReceivedTotal + b2.trailDocSnapshotReceivedTotal;
    const ratio2 = combinedUpdate / a.trailUpdateDocTotal;
    assert.equal(a.trailUpdateDocTotal, 3);
    assert.equal(combinedUpdate, 6);
    assert.ok(ratio2 > 1.8 && ratio2 < 2.2, `② B/A=${ratio2} 는 선형 근처여야 한다`);
    assert.equal(combinedSnap, 0, "trails/{id} onSnapshot 이 없어 ③ 제곱 항은 0");
  });

  it("C 주행1+관전1 — 관전자는 heartbeat 만 더한다", async () => {
    const rider = await runSoloRideWindowMs(60_000);
    resetTouchActivityMeters();
    const spec = await runSpectatorWindowMs(60_000);
    assert.equal(spec.touchCallsBySite.routePublish, 0);
    assert.equal(spec.touchCallsBySite.presenceHeartbeat, 2);
    assert.equal(spec.trailUpdateDocTotal, 2);
    assert.equal(spec.presenceHeartbeatWriteTotal, 2);
    const combined2 = rider.trailUpdateDocTotal + spec.trailUpdateDocTotal;
    assert.equal(combined2, 5);
  });

  it("D Trailhead idle — touch 없음. 0 은 배선 실패가 아니라 idle 관측이다", async () => {
    const clock = new FakeClock();
    installSeams(clock);
    beginTouchMeterWindow({ riders: 0, spectators: 0 });
    await clock.advanceTo(clock.originMs + 60_000);
    const d = endTouchMeterWindow();
    assert.equal(d.touchCallsTotal, 0);
    assert.equal(d.trailUpdateDocTotal, 0);
    assert.equal(d.listingRefreshRunTotal, 0);
    assert.equal(d.presenceHeartbeatWriteTotal, 0);
  });
});
