import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNewGeometryFromClaimedPath,
  mergeRecentNewRoadState,
  resolveConquestClaimProjection,
} from "./conquestOnRideCreated.js";
import { conquestCellIdAt, lngLatToTileXY } from "./geoTiles.js";
import { FieldValue, type DocumentReference, type Firestore, type Transaction } from "firebase-admin/firestore";
import { applyConquestInTransaction } from "./conquestOnRideCreated.js";

test("server projection emits only the newly claimed geometry", () => {
  const result = resolveConquestClaimProjection({
    cells: [
      { id: "20_1_1", m: 40 },
      { id: "20_1_2", m: 40 },
    ],
    ownedCellIds: new Set(["20_1_1"]),
    creditMeters: 70,
  });

  assert.deepEqual(result.newCellIds, ["20_1_2"]);
  assert.equal(result.newMeters, 30);
  assert.equal(result.consumedMeters, 70);
  assert.equal(result.claimedMetersByCell.get("20_1_2"), 30);
});

test("server projection preserves separated revisited-cell geometry", () => {
  const result = resolveConquestClaimProjection({
    cells: [
      { id: "20_1_1", m: 40 },
      { id: "20_1_2", m: 30 },
    ],
    ownedCellIds: new Set(),
    creditMeters: 40,
  });

  assert.equal(result.newMeters, 40);
  assert.equal(result.claimedMetersByCell.get("20_1_1"), 40);
});

test("server geometry follows claimed cells and preserves separated path runs", () => {
  const a: [number, number] = [127, 37.5];
  const b: [number, number] = [127.0002, 37.5];
  const c: [number, number] = [127.0005, 37.5];
  const d: [number, number] = [127.0007, 37.5];
  const firstCell = conquestCellIdAt([127.0001, 37.5]);
  const secondCell = conquestCellIdAt([127.00035, 37.5]);
  const result = buildNewGeometryFromClaimedPath(
    [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]],
    new Map([[firstCell, 40], [secondCell, 30]]),
  );
  assert.ok(result.length >= 1);
  assert.ok(result.every((segment) => segment.path.length >= 4));
});

test("recent new road state keeps the newest day and merges rides on that day", () => {
  const oldState = {
    day: "20261018",
    geometry: [{ path: [126, 37, 126.01, 37.01] }],
    newMeters: 4000,
  };
  const sameDay = {
    day: "20261018",
    geometry: [{ path: [126.02, 37.02, 126.03, 37.03] }],
    newMeters: 6000,
  };
  const newer = {
    day: "20261020",
    geometry: [{ path: [127, 38, 127.01, 38.01] }],
    newMeters: 1200,
  };

  assert.deepEqual(mergeRecentNewRoadState(oldState, sameDay), {
    day: "20261018",
    geometry: [...oldState.geometry, ...sameDay.geometry],
    newMeters: 10000,
  });
  assert.deepEqual(mergeRecentNewRoadState(oldState, newer), newer);
  assert.deepEqual(mergeRecentNewRoadState(newer, oldState), newer);
});

test("long simplified trace finds newly claimed cells away from its midpoint", () => {
  const start: [number, number] = [127, 37.5];
  const finish: [number, number] = [127, 37.502];
  const firstCell = conquestCellIdAt([127, 37.50005]);
  const lastCell = conquestCellIdAt([127, 37.50195]);
  const result = buildNewGeometryFromClaimedPath([...start, ...finish], new Map([[firstCell, 20], [lastCell, 20]]));
  assert.equal(result.length, 2, "separate new ends remain separate; old middle is excluded");
  assert.ok(result[0].path[1] < 37.5003);
  assert.ok(result[1].path[1] > 37.5016);
});

/* ---- G5 S2: 지역별 합산 기록 (가짜 transaction) ---- */

type FakeWrite = { op: "set" | "update"; path: string; data: Record<string, unknown>; merge?: boolean };

function fakeRegionTx(docs: Record<string, Record<string, unknown>> = {}) {
  const writes: FakeWrite[] = [];
  const refOf = (path: string) => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => refOf(`${path}/${name}/${id}`) }),
  });
  const db = { doc: (path: string) => refOf(path) } as unknown as Firestore;
  const tx = {
    get: async (ref: { path: string }) => {
      const d = docs[ref.path];
      return { exists: !!d, data: () => d, get: (k: string) => d?.[k] };
    },
    set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      writes.push({ op: "set", path: ref.path, data, merge: opts?.merge });
    },
    update: (ref: { path: string }, data: Record<string, unknown>) => {
      writes.push({ op: "update", path: ref.path, data });
    },
  } as unknown as Transaction;
  const rideRef = refOf("rides/r1") as unknown as DocumentReference;
  return { tx, db, rideRef, writes };
}

function cellsAt(lng: number, lat: number, n: number): { id: string; m: number }[] {
  const { x, y } = lngLatToTileXY(lng, lat, 20);
  return Array.from({ length: n }, (_, i) => ({ id: `20_${x + i}_${y}`, m: 100 }));
}

const baseInput = {
  rideId: "r1",
  userId: "u1",
  path: [] as number[],
  tier: "t0" as const,
  pedalSec: null,
  elapsedSec: 3600,
  distanceMeters: 20000,
};

type ByRegion = { country: string | null; meters: number; cells: number }[];

test("서울+파리 묶음 주행: byRegion 합계=newMeters, regions 문서 4개를 increment 로 기록", async () => {
  const f = fakeRegionTx();
  await applyConquestInTransaction(f.tx, f.db, f.rideRef, {
    ...baseInput,
    cells: [...cellsAt(126.978, 37.5665, 3), ...cellsAt(2.35, 48.85, 2)],
  });
  const upd = f.writes.find((w) => w.op === "update")!;
  const result = upd.data.conquestResult as { newMeters: number; byRegion: ByRegion };
  assert.equal(result.newMeters, 500);
  assert.equal(result.byRegion.reduce((a, r) => a + r.meters, 0), result.newMeters);
  const regionWrites = f.writes.filter((w) => w.path.startsWith("conquest/u1/regions/"));
  assert.deepEqual(
    regionWrites.map((w) => w.path.split("/").pop()).sort(),
    ["FR", "FR-IDF", "KR", "KR-11"],
  );
  const kr = regionWrites.find((w) => w.path.endsWith("/KR"))!;
  assert.equal(kr.merge, true);
  assert.equal(kr.data.scopeType, "country");
  assert.ok((kr.data.meters as FieldValue).isEqual(FieldValue.increment(300)));
  assert.ok((kr.data.cells as FieldValue).isEqual(FieldValue.increment(3)));
  assert.equal(regionWrites.find((w) => w.path.endsWith("/FR-IDF"))!.data.scopeType, "admin1");
  // byRegion 은 tier 와 같은 update 한 번에 들어간다.
  assert.equal((upd.data.conquestResult as { tier: string }).tier, "t0");
});

test("새 셀이 없으면 regions 쓰기 없음, byRegion 은 빈 배열", async () => {
  const cells = cellsAt(126.978, 37.5665, 2);
  const { x, y } = lngLatToTileXY(126.978, 37.5665, 20);
  const owned = Object.fromEntries(cells.map((c) => [c.id, "20261101"]));
  const f = fakeRegionTx({ [`conquest/u1/chunks/12_${x >> 8}_${y >> 8}`]: { cells: owned } });
  await applyConquestInTransaction(f.tx, f.db, f.rideRef, { ...baseInput, cells });
  const result = f.writes.find((w) => w.op === "update")!.data.conquestResult as {
    newCells: number;
    byRegion: ByRegion;
  };
  assert.equal(result.newCells, 0);
  assert.deepEqual(result.byRegion, []);
  assert.equal(f.writes.filter((w) => w.path.includes("/regions/")).length, 0);
});

test("판정기 주입: 바다 묶음은 byRegion 에는 남고 regions 에는 쓰이지 않는다", async () => {
  const f = fakeRegionTx();
  await applyConquestInTransaction(f.tx, f.db, f.rideRef, {
    ...baseInput,
    cells: cellsAt(126.978, 37.5665, 2),
    resolveRegion: () => null,
  });
  const result = f.writes.find((w) => w.op === "update")!.data.conquestResult as { byRegion: ByRegion };
  assert.equal(result.byRegion.length, 1);
  assert.equal(result.byRegion[0].country, null);
  assert.equal(result.byRegion[0].meters, 200);
  assert.equal(f.writes.filter((w) => w.path.includes("/regions/")).length, 0);
});

test("지역 판정이 실패해도 도로망 기록은 끝까지 간다(byRegion 빈 배열, regions 쓰기 없음)", async () => {
  const f = fakeRegionTx();
  await applyConquestInTransaction(f.tx, f.db, f.rideRef, {
    ...baseInput,
    cells: cellsAt(126.978, 37.5665, 3),
    resolveRegion: () => {
      throw new Error("geo-data missing");
    },
  });
  const upd = f.writes.find((w) => w.op === "update")!;
  const result = upd.data.conquestResult as { newMeters: number; tier: string; byRegion: ByRegion };
  assert.equal(result.newMeters, 300, "도로망 집계는 정상");
  assert.equal(result.tier, "t0");
  assert.deepEqual(result.byRegion, []);
  assert.equal(f.writes.filter((w) => w.path.includes("/regions/")).length, 0);
  assert.ok(f.writes.some((w) => w.path === "conquest/u1"), "요약은 갱신");
});

test("흩어진 셀(새 묶음 161개)이면 지역 기록만 건너뛰고 도로망은 그대로", async () => {
  const f = fakeRegionTx();
  const cells: { id: string; m: number }[] = [];
  for (let i = 0; i < 161; i += 1) {
    // 묶음마다 하나씩 — z12 한 칸 = z20 256칸
    cells.push({ id: `20_${(5000 + i) * 256}_${3000 * 256}`, m: 10 });
  }
  let called = 0;
  await applyConquestInTransaction(f.tx, f.db, f.rideRef, {
    ...baseInput,
    cells,
    resolveRegion: () => {
      called += 1;
      return null;
    },
  });
  const result = f.writes.find((w) => w.op === "update")!.data.conquestResult as { newCells: number; byRegion: ByRegion };
  assert.equal(result.newCells, 161);
  assert.deepEqual(result.byRegion, []);
  assert.equal(called, 0);
  assert.equal(f.writes.filter((w) => w.path.includes("/regions/")).length, 0);
  assert.equal(f.writes.filter((w) => w.path.includes("/chunks/")).length, 161, "도로망 chunks 쓰기는 기존 그대로");
});
