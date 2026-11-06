/**
 * G5 S5 — 기존 chunks → 지역 누적 계산(순수) 고정 시험.
 * 실행 (C:\20.HDev\boxcycle\functions): `npm test`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { lngLatToTileXY } from "./geoTiles.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { auditRegionPlan, planRegionsFromChunks } from "./conquestRegionBackfill.js";

const chunkAt = (lng: number, lat: number): string => {
  const { x, y } = lngLatToTileXY(lng, lat, 12);
  return `12_${x}_${y}`;
};
const seoul = chunkAt(126.978, 37.5665);
const paris = chunkAt(2.35, 48.85);
const sea = chunkAt(-30, 30);
const by = (plan: ReturnType<typeof planRegionsFromChunks>) => new Map(plan.map((p) => [p.scopeCode, p]));

test("서울+파리: KR·KR-11·FR·FR-IDF, meters 합 = totalMeters", () => {
  const counts = new Map([[seoul, 30], [paris, 10]]);
  const plan = planRegionsFromChunks(10001, counts, resolveGeoRegion);
  const m = by(plan);
  for (const k of ["KR", "KR-11", "FR", "FR-IDF"]) assert.ok(m.has(k), k);
  assert.equal(m.get("KR")!.cells, 30);
  assert.equal(m.get("FR")!.cells, 10);
  assert.equal(m.get("KR")!.meters + m.get("FR")!.meters, 10001);
  assert.equal(m.get("KR")!.meters, m.get("KR-11")!.meters);
  assert.ok(auditRegionPlan(10001, counts, plan, 0));
});

test("바다 묶음은 제외되고 나머지 meters 는 totalMeters 이하", () => {
  const counts = new Map([[seoul, 10], [sea, 10]]);
  const plan = planRegionsFromChunks(1000, counts, resolveGeoRegion);
  assert.deepEqual([...by(plan).keys()].sort(), ["KR", "KR-11"]);
  assert.equal(by(plan).get("KR")!.meters, 500);
  assert.ok(auditRegionPlan(1000, counts, plan, 1));
});

test("totalMeters 0 이면 meters 0, cells 만 센다", () => {
  const plan = planRegionsFromChunks(0, new Map([[seoul, 7]]), resolveGeoRegion);
  assert.equal(by(plan).get("KR")!.meters, 0);
  assert.equal(by(plan).get("KR")!.cells, 7);
  assert.deepEqual(planRegionsFromChunks(0, new Map(), resolveGeoRegion), []);
});

test("멱등: 입력 순서가 달라도 두 번 계산해도 같다", () => {
  const a = planRegionsFromChunks(777, new Map([[seoul, 3], [paris, 5], [sea, 2]]), resolveGeoRegion);
  const b = planRegionsFromChunks(777, new Map([[sea, 2], [paris, 5], [seoul, 3]]), resolveGeoRegion);
  assert.deepEqual(a, b);
  assert.deepEqual(a, planRegionsFromChunks(777, new Map([[seoul, 3], [paris, 5], [sea, 2]]), resolveGeoRegion));
});
