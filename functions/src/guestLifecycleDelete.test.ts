/**
 * Guest 삭제 pipeline RTDB 계약 — guestLifecycle sweep 와 accountDeletionCore 의 경계.
 *
 * - RTDB 초기화 실패(null)는 절대 조용히 통과하지 않는다. 차단 쓰기를 보장할 수 없으면
 *   삭제 계열 쓰기는 실패·재시도로 남는다(sweep cap 안에서).
 * - deleteAccountData 는 Firestore membership 뿐 아니라 RTDB-only motion 도 지우고,
 *   공용 Trail 문서 자체는 건드리지 않는다.
 *
 * 실행: functions 에서 `node --test lib/guestLifecycleDelete.test.js`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Database } from "firebase-admin/database";
import type { Firestore } from "firebase-admin/firestore";
import { deleteAccountData, rtdbTrailIdsWithMotion } from "./accountDeletionCore.js";
import { guestRtdbPort, listRtdbMotionUids } from "./guestLifecycleAdmin.js";

type MiniSnap = {
  key: string | null;
  child(name: string): MiniSnap;
  exists(): boolean;
  val(): unknown;
  forEach(cb: (child: MiniSnap) => unknown): void;
};

function miniSnap(value: unknown, key: string | null = null): MiniSnap {
  const isLeaf = typeof value === "number" || typeof value === "string";
  return {
    key,
    child(name) {
      return isLeaf
        ? miniSnap(null, name)
        : miniSnap((value as Record<string, unknown>)[name] ?? null, name);
    },
    exists() {
      return value != null;
    },
    val() {
      return value;
    },
    forEach(cb) {
      if (isLeaf) return;
      for (const [name, childValue] of Object.entries(value as Record<string, unknown>)) {
        cb(miniSnap(childValue, name));
      }
    },
  };
}

/** `trails/{trailId}/motion/{uid}` 형태의 RTDB 가짜. remove 경로를 기록한다. */
function fakeRtdb(motionByTrail: Record<string, Record<string, number>>): { db: Database; removed: string[] } {
  const removed: string[] = [];
  const tree: Record<string, { motion: Record<string, number> }> = Object.fromEntries(
    Object.entries(motionByTrail).map(([trailId, motion]) => [trailId, { motion }]),
  );
  const api = {
    ref(path: string) {
      if (path === "trails") {
        return {
          get: async () => miniSnap(tree),
        };
      }
      return {
        get: async () => miniSnap(null),
        remove: async () => {
          removed.push(path);
        },
        set: async (value: unknown) => {
          removed.push(`${path}=${JSON.stringify(value)}`);
        },
      };
    },
    goOffline() {
      return undefined;
    },
  };
  return { db: api as unknown as Database, removed };
}

/** deleteAccountData 가 쓰는 Firestore 표면의 최소 가짜. 개인 문서는 모두 비어 있다. */
function fakeFirestore(): { db: Firestore; fsDeleted: string[] } {
  const fsDeleted: string[] = [];
  const emptyDocs = { docs: [] as Array<{ id: string }>, empty: true, size: 0 };
  const db = {
    doc(path: string) {
      return {
        path,
        get: async () => ({ exists: false, get: () => null }),
      };
    },
    collection(name: string) {
      return {
        where: () => ({ get: async () => emptyDocs }),
        get: async () => name.endsWith("/recentNewRoad")
          ? { docs: [{ ref: { path: `${name}/current` } }] }
          : name.endsWith("/regions")
            ? { docs: [{ ref: { path: `${name}/KR` } }, { ref: { path: `${name}/KR-11` } }] }
            : name.endsWith("/rideRegions")
              ? { docs: [{ ref: { path: `${name}/KR` } }, { ref: { path: `${name}/KR-11` } }] }
              : emptyDocs,
        select: () => ({ get: async () => emptyDocs }),
      };
    },
    collectionGroup() {
      return { get: async () => emptyDocs, select: () => ({ get: async () => emptyDocs }) };
    },
    batch() {
      return {
        delete: (ref: { path: string }) => {
          fsDeleted.push(ref.path);
          return ref;
        },
        commit: async () => undefined,
      };
    },
  };
  return { db: db as unknown as Firestore, fsDeleted };
}

const uid = "guest-orphan-1";

test("RTDB-only motion 도 수거하고, 공용 Trail 문서·다른 라이더 move 는 그대로 둔다", async () => {
  const { db, fsDeleted } = fakeFirestore();
  const { db: rtdb, removed } = fakeRtdb({
    "trail-a": { [uid]: 100, "other-rider": 100 },
    "trail-b": { [uid]: 200 }, // presence 인덱스가 못 보는 RTDB-only trail
    "trail-c": { "third-rider": 300 },
  });
  const report = await deleteAccountData(db, rtdb, uid);
  assert.equal(report.rtdbMotionNodesRemoved, 2);
  assert.ok(removed.includes(`trails/trail-a/motion/${uid}`), "presence 기반 trail");
  assert.ok(removed.includes(`trails/trail-b/motion/${uid}`), "RTDB-only trail");
  assert.ok(!removed.some((path) => path.includes("other-rider")), "다른 라이더 motion");
  assert.ok(!removed.some((path) => path.includes("third-rider")));
  assert.ok(!fsDeleted.some((path) => /^trails\/trail-/.test(path) && !path.includes("/members/")), "공용 Trail 문서 보존");
  assert.ok(fsDeleted.includes(`conquest/${uid}/recentNewRoad/current`), "신규 도로 강조 기록도 계정 귀속 정리");
  assert.ok(fsDeleted.includes(`conquest/${uid}/regions/KR`) && fsDeleted.includes(`conquest/${uid}/regions/KR-11`), "G5 지역 누적도 계정 귀속 정리");
  assert.ok(fsDeleted.includes(`conquest/${uid}/rideRegions/KR`) && fsDeleted.includes(`conquest/${uid}/rideRegions/KR-11`), "지역별 주행 누적도 계정 귀속 정리");
});

test("rtdbTrailIdsWithMotion 은 RTDB 를 직접 훑어 uid 귀속 trail 을 찾는다", async () => {
  const { db: rtdb } = fakeRtdb({
    t1: { [uid]: 1 },
    t2: { someone: 1 },
  });
  const ids = await rtdbTrailIdsWithMotion(rtdb, uid);
  assert.deepEqual(ids, ["t1"]);
});

test("RTDB 가 null 이면 motion 을 수거하지 않고 종료한다(호출 측 sweep 가 재시도 상태로 둔다)", async () => {
  const { db } = fakeFirestore();
  const report = await deleteAccountData(db, null, uid);
  assert.equal(report.rtdbMotionNodesRemoved, 0);
});
test("guestRtdbPort 는 RTDB 가 없으면 차단 쓰기를 거부한다(조용한 통과 금지)", async () => {
  await assert.rejects(
    guestRtdbPort(null).setBlocked(uid, true),
    /rtdb\/unavailable/,
  );
});

test("guestRtdbPort 는 실제 RTDB 에 blocked 마커를 기록한다", async () => {
  const writes: Array<[string, unknown]> = [];
  const fake = {
    ref: (path: string) => ({
      set: async (value: unknown) => {
        writes.push([path, value]);
      },
    }),
  } as unknown as Database;
  await guestRtdbPort(fake).setBlocked(uid, true);
  await guestRtdbPort(fake).setBlocked(uid, false);
  assert.deepEqual(writes.map((entry) => entry[0]), [
    `guestLifecycle/${uid}/blocked`,
    `guestLifecycle/${uid}/blocked`,
  ]);
  assert.equal(writes[0][1], true);
  assert.equal(writes[1][1], false);
});

// ── 지역별 동행 RTDB(00-plan §5.1 P2) ────────────────────────────────────────
test("추가 동행 인스턴스의 motion 도 수거한다(다른 지역에 개인 위치를 남기지 않는다)", async () => {
  const { db } = fakeFirestore();
  const base = fakeRtdb({ "trail-a": { [uid]: 1 } });
  const europe = fakeRtdb({ "trail-eu": { [uid]: 2, "eu-rider": 2 } });
  const report = await deleteAccountData(db, base.db, uid, [europe.db]);
  assert.ok(base.removed.includes(`trails/trail-a/motion/${uid}`), "기본 인스턴스");
  assert.ok(europe.removed.includes(`trails/trail-eu/motion/${uid}`), "추가 인스턴스");
  assert.ok(!europe.removed.some((p) => p.includes("eu-rider")), "다른 라이더 보존");
  assert.ok(report.rtdbMotionNodesRemoved >= 2);
});

test("추가 인스턴스에만 motion 이 남은 uid 도 고아 후보로 찾는다", async () => {
  const base = fakeRtdb({ "trail-a": { "kr-rider": 1 } });
  const europe = fakeRtdb({ "trail-eu": { "eu-only": 2 } });
  const uids = await listRtdbMotionUids(base.db, [europe.db]);
  assert.deepEqual([...uids].sort(), ["eu-only", "kr-rider"]);
});

test("추가 인스턴스 목록을 넘기지 않으면 기존 동작 그대로(기본 인스턴스만)", async () => {
  const base = fakeRtdb({ "trail-a": { "kr-rider": 1 } });
  assert.deepEqual(await listRtdbMotionUids(base.db), ["kr-rider"]);
});
