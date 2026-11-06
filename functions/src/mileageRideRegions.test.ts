/**
 * 마일리지 트리거의 지역별 주행 기록 계약 — 격리 fake DB 로 트랜잭션 본문을 직접 실행한다.
 * 계약: document/ops/20261106-region-ride-stats/README.md
 * 실행 (C:\20.HDev\boxcycle\functions): `npm test`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeAdminFirestore, type FakeTx } from "./guestAdminFakeFirestore.js";
import { applyMileageInTransaction } from "./mileageOnRideCreated.js";
import { conquestCellIdAt, type LngLat } from "./geoTiles.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";

const UID = "region-rider-1";
const RIDE_PATH = "rides/r1";

const cellsAt = (lng: number, lat: number, n: number, m: number) =>
  Array.from({ length: n }, (_, i) => ({ id: conquestCellIdAt([lng + i * 0.0004, lat] as LngLat), m }));

type Recorded = { kind: "set" | "update"; path: string; data: Record<string, unknown> };

/** 트랜잭션 쓰기를 가로채 기록한다(update 가 한 번인지 확인용). */
async function run(
  db: FakeAdminFirestore,
  input: { resolveRegion?: Parameters<typeof applyMileageInTransaction>[3]["resolveRegion"] } = {},
): Promise<Recorded[]> {
  const rec: Recorded[] = [];
  await db.runTransaction(async (tx: FakeTx) => {
    rec.length = 0;
    const spy: FakeTx = {
      get: (ref) => tx.get(ref),
      set: (ref, data, opts) => {
        rec.push({ kind: "set", path: ref.path, data });
        tx.set(ref, data, opts);
      },
      update: (ref, data) => {
        rec.push({ kind: "update", path: ref.path, data });
        tx.update(ref, data);
      },
      delete: (ref) => tx.delete(ref),
    };
    await applyMileageInTransaction(spy as never, db as never, db.doc(RIDE_PATH) as never, {
      rideId: "r1",
      userId: UID,
      distanceMeters: 1000,
      elapsedSec: 600,
      ...input,
    });
  });
  return rec;
}

function seedRide(db: FakeAdminFirestore, conquest: unknown): void {
  db.seed(RIDE_PATH, { userId: UID, distanceMeters: 1000, elapsedSec: 600, ...(conquest ? { conquest } : {}) });
}

const payload = () => ({
  v: 2,
  z: 20,
  cells: [...cellsAt(126.978, 37.5665, 6, 100), ...cellsAt(2.35, 48.85, 4, 100)],
});

test("regionDistances 는 mileageApplied 와 같은 update 한 번에 들어가고 rideRegions 4건이 increment 로 쓰인다", async () => {
  const db = new FakeAdminFirestore();
  seedRide(db, payload());
  const rec = await run(db);

  const updates = rec.filter((r) => r.kind === "update");
  assert.equal(updates.length, 1, "주행 문서 update 는 한 번");
  assert.equal(updates[0]!.path, RIDE_PATH);
  assert.equal(updates[0]!.data.mileageApplied, true);
  const rd = updates[0]!.data.regionDistances as Array<{ country: string | null; meters: number }>;
  assert.equal(rd.reduce((a, r) => a + r.meters, 0), 1000);

  const rr = rec.filter((r) => r.path.startsWith(`conquest/${UID}/rideRegions/`));
  assert.deepEqual(rr.map((r) => r.path.split("/").pop()).sort(), ["FR", "FR-IDF", "KR", "KR-11"]);
  for (const w of rr) {
    for (const f of ["meters", "sec", "rideCount"]) {
      assert.equal((w.data[f] as object).constructor.name, "NumericIncrementTransform", `${w.path} ${f} 는 increment`);
    }
  }
  const kr = db.docs.get(`conquest/${UID}/rideRegions/KR`)!;
  assert.equal(kr.meters, 600);
  assert.equal(kr.sec, 360);
  assert.equal(kr.rideCount, 1);
  assert.equal(kr.scopeType, "country");
  assert.equal(db.docs.get(`users/${UID}`)!.mileageRideCount, 1);
});

test("멱등: mileageApplied 가 이미 true 면 지역도 마일리지도 다시 쓰지 않는다", async () => {
  const db = new FakeAdminFirestore();
  seedRide(db, payload());
  await run(db);
  const again = await run(db);
  assert.deepEqual(again, []);
  assert.equal(db.docs.get(`conquest/${UID}/rideRegions/KR`)!.rideCount, 1);
  assert.equal(db.docs.get(`users/${UID}`)!.mileageRideCount, 1);
});

test("지역 계산이 실패해도 마일리지는 그대로 쓰고 regionDistances 키는 없다", async () => {
  const db = new FakeAdminFirestore();
  seedRide(db, payload());
  const rec = await run(db, {
    resolveRegion: () => {
      throw new Error("geo-data missing");
    },
  });
  const update = rec.find((r) => r.kind === "update")!;
  assert.equal(update.data.mileageApplied, true);
  assert.ok(!("regionDistances" in update.data));
  assert.ok(!rec.some((r) => r.path.includes("/rideRegions/")));
  assert.equal(db.docs.get(`users/${UID}`)!.mileageTotalMeters, 1000);
  assert.equal(db.docs.get(`users/${UID}`)!.mileageRideCount, 1);
});

test("셀 정보가 없는 주행은 지역 쓰기 없이 마일리지만", async () => {
  const db = new FakeAdminFirestore();
  seedRide(db, null);
  const rec = await run(db, { resolveRegion: resolveGeoRegion });
  assert.ok(!rec.some((r) => r.path.includes("/rideRegions/")));
  const update = rec.find((r) => r.kind === "update")!;
  assert.deepEqual(update.data, { mileageApplied: true });
  assert.equal(db.docs.get(`users/${UID}`)!.mileageRideCount, 1);
});

test("상한 초과(흩어진 셀 161 묶음)는 지역 필드·문서 없이 마일리지만", async () => {
  const db = new FakeAdminFirestore();
  const spread = Array.from({ length: 161 }, (_, i) => ({ id: `20_${(1000 + i) * 256}_${2000 * 256}`, m: 10 }));
  seedRide(db, { v: 2, z: 20, cells: spread });
  const rec = await run(db, { resolveRegion: () => null });
  assert.ok(!rec.some((r) => r.path.includes("/rideRegions/")));
  assert.deepEqual(rec.find((r) => r.kind === "update")!.data, { mileageApplied: true });
});
