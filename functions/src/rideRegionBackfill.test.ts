/**
 * 지역별 주행 거리 소급 — 순수 계획 시험. 계약: document/ops/20261106-region-ride-stats/README.md
 * 실행 (C:\20.HDev\boxcycle\functions): `npm test`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { conquestCellIdAt, type LngLat } from "./geoTiles.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { planUserRideRegions, type BackfillRideInput } from "./rideRegionBackfill.js";

const cellsAt = (lng: number, lat: number, n: number, m: number) =>
  Array.from({ length: n }, (_, i) => ({ id: conquestCellIdAt([lng + i * 0.0004, lat] as LngLat), m }));

const ride = (id: string, over: Partial<BackfillRideInput>): BackfillRideInput => ({
  id,
  distanceMeters: 1000,
  elapsedSec: 600,
  conquestCells: undefined,
  regionDistances: undefined,
  ...over,
});

const rides: BackfillRideInput[] = [
  ride("a", { conquestCells: cellsAt(126.978, 37.5665, 10, 100) }), // 서울 1000m
  ride("b", { conquestCells: cellsAt(2.35, 48.85, 10, 100) }), // 파리 1000m
  ride("c", { regionDistances: [{ country: "KR", admin1: "KR-11", meters: 500 }], distanceMeters: 500, elapsedSec: 300 }), // 이미 있음
  ride("d", {}), // 셀 없음
  ride("e", { conquestCells: cellsAt(-40, 30, 5, 100), distanceMeters: 500 }), // 바다만
];

test("소급 계획: 계산·기존·셀 없음 구분, 지역 문서 합계", () => {
  const plan = planUserRideRegions(rides, resolveGeoRegion);
  assert.equal(plan.rides, 5);
  assert.equal(plan.computed, 3); // a b e
  assert.equal(plan.nocells, 1); // d
  assert.equal(plan.skipped, 0);
  assert.deepEqual(
    plan.items.map((i) => `${i.id}:${i.status}`),
    ["a:computed", "b:computed", "c:had", "d:nocells", "e:computed"],
  );
  assert.equal(plan.items.find((i) => i.id === "c")!.toWrite, null, "이미 있는 값은 다시 쓰지 않는다");
  const kr = plan.docs.find((d) => d.scopeCode === "KR")!;
  assert.deepEqual(kr, { scopeType: "country", scopeCode: "KR", meters: 1500, sec: 900, rideCount: 2 });
  assert.equal(plan.docs.find((d) => d.scopeCode === "KR-11")!.meters, 1500);
  assert.equal(plan.docs.find((d) => d.scopeCode === "FR")!.rideCount, 1);
  assert.ok(!plan.docs.some((d) => d.scopeCode === ""), "바다는 문서 없음");
  assert.equal(plan.auditOk, true);
});

test("소급은 멱등: 계산 결과를 주행에 써 넣고 다시 돌려도 같은 문서 합계", () => {
  const first = planUserRideRegions(rides, resolveGeoRegion);
  const written = rides.map((r) => {
    const it = first.items.find((i) => i.id === r.id)!;
    return it.toWrite ? { ...r, regionDistances: it.toWrite } : r;
  });
  const second = planUserRideRegions(written, resolveGeoRegion);
  assert.deepEqual(second.docs, first.docs);
  assert.equal(second.computed, 0);
  assert.ok(second.items.filter((i) => i.toWrite).length === 0);
});

test("상한·판정 예외 주행은 skipped 로 세고 합계에 넣지 않는다", () => {
  const spread = Array.from({ length: 161 }, (_, i) => ({ id: `20_${(1000 + i) * 256}_${2000 * 256}`, m: 10 }));
  const plan = planUserRideRegions([ride("x", { conquestCells: spread }), ride("y", { conquestCells: cellsAt(126.978, 37.5665, 2, 10) })], () => {
    throw new Error("boom");
  });
  assert.equal(plan.skipped, 2);
  assert.equal(plan.computed, 0);
  assert.deepEqual(plan.docs, []);
});

test("검산: 국가 거리 합이 주행 거리 합을 크게 넘으면 불일치", () => {
  const bad = planUserRideRegions(
    [ride("z", { distanceMeters: 100, regionDistances: [{ country: "KR", admin1: "KR-11", meters: 5000 }] })],
    resolveGeoRegion,
  );
  assert.equal(bad.auditOk, false);
});
