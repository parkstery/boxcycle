/**
 * routeAutoRouteCache 는 본인 userId 문서만 지우고, tombstone 뒤 재기록은 거절한다.
 * 에뮬레이터는 띄우지 않는다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { ACCOUNT_DELETION_POLICY } from "./accountDeletionCore.js";
import { writeRouteAutoRouteCache } from "./distanceAutoRouteHttp.js";
import { GuestLifecycleBlockedError } from "./guestLifecycleGuard.js";
import { FakeAdminFirestore, seedMarker } from "./guestAdminFakeFirestore.js";
import {
  countGuestUidData,
  deleteGuestUidFirestoreData,
  type PresenceIndex,
} from "./purgeGuestUsersCore.js";

type Row = { collection: string; id: string; data: Record<string, unknown> };

function emptyPresence(): PresenceIndex {
  return {
    trailMembersByUid: new Map(),
    publicationSessionMembersByUid: new Map(),
    livePublicationRidesByUid: new Map(),
    openTrailListingsByHostUid: new Map(),
    trailsByHostUid: new Map(),
  };
}

function memoryDb(rows: Row[]) {
  const deleted: string[] = [];
  const docsOf = (collection: string, field?: string, value?: string) =>
    rows.filter((row) => row.collection === collection && (field == null || row.data[field] === value));
  const asDocs = (found: Row[]) =>
    found.map((row) => ({
      id: row.id,
      ref: { path: `${row.collection}/${row.id}` },
      get: (field: string) => row.data[field],
    }));
  const db = {
    doc(path: string) {
      const row = rows.find((item) => `${item.collection}/${item.id}` === path);
      return {
        path,
        get: async () => ({
          exists: Boolean(row),
          get: (field: string) => row?.data[field],
        }),
      };
    },
    collection(name: string) {
      return {
        where(field: string, _op: string, value: string) {
          const found = docsOf(name, field, value);
          return {
            get: async () => ({ docs: asDocs(found) }),
            count: () => ({ get: async () => ({ data: () => ({ count: found.length }) }) }),
          };
        },
        get: async () => ({ docs: asDocs(docsOf(name)) }),
        count: () => ({ get: async () => ({ data: () => ({ count: docsOf(name).length }) }) }),
      };
    },
    batch() {
      const paths: string[] = [];
      return {
        delete(ref: { path: string }) {
          paths.push(ref.path);
        },
        commit: async () => {
          deleted.push(...paths);
        },
      };
    },
  };
  return { db: db as unknown as Firestore, deleted };
}

const cacheDoc = {
  userId: "mine",
  requestId: "req-1",
  status: "failed" as const,
  routeTokenBalance: 0,
};

test("routeAutoRouteCache 정책은 본인 삭제다", () => {
  assert.equal(ACCOUNT_DELETION_POLICY.routeAutoRouteCache, "delete");
});

test("개인 삭제는 본인 routeAutoRouteCache 만 지우고 타인 캐시는 남긴다", async () => {
  const rows: Row[] = [
    { collection: "routeAutoRouteCache", id: "mine_req-1", data: { userId: "mine" } },
    { collection: "routeAutoRouteCache", id: "other_req-9", data: { userId: "other" } },
  ];
  const store = memoryDb(rows);
  const presence = emptyPresence();
  const before = await countGuestUidData(store.db, "mine", presence);
  assert.equal(before.routeAutoRouteCache, 1);
  const other = await countGuestUidData(store.db, "other", presence);
  assert.equal(other.routeAutoRouteCache, 1);

  await deleteGuestUidFirestoreData(store.db, "mine", presence);
  assert.equal(store.deleted.includes("routeAutoRouteCache/mine_req-1"), true);
  assert.equal(store.deleted.includes("routeAutoRouteCache/other_req-9"), false);
  assert.equal(store.deleted.includes("routePublications/other_req-9"), false);
});

test("tombstone 뒤 routeAutoRouteCache 재기록은 거절되고 문서를 만들지 않는다", async () => {
  const db = new FakeAdminFirestore();
  seedMarker(db, "mine", "deleted");
  await assert.rejects(
    () => writeRouteAutoRouteCache(db as unknown as Firestore, "mine", "req-1", cacheDoc),
    (error: unknown) => error instanceof GuestLifecycleBlockedError,
  );
  assert.equal(
    [...db.docs.keys()].some((path) => path.startsWith("routeAutoRouteCache/")),
    false,
  );
});

test("marker 가 없으면 routeAutoRouteCache 기록을 그대로 쓴다", async () => {
  const db = new FakeAdminFirestore();
  await writeRouteAutoRouteCache(db as unknown as Firestore, "mine", "req-1", cacheDoc);
  const written = db.docs.get("routeAutoRouteCache/mine_req-1");
  assert.equal(written?.userId, "mine");
  assert.equal(written?.requestId, "req-1");
});
