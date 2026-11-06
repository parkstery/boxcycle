import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRegionShare,
  filterSessionsByRegion,
  regionShareOf,
  type RideRegionKey,
} from "../src/lib/ride/regionStatsFilter.ts";
import type { StoredRideSession } from "../src/lib/ride/rideSessionsStorage.ts";

const WORLD: RideRegionKey = { country: null, admin1: null };
const KR: RideRegionKey = { country: "KR", admin1: null };
const KR11: RideRegionKey = { country: "KR", admin1: "KR-11" };

function ride(over: Partial<StoredRideSession>): StoredRideSession {
  return {
    id: "r1",
    endedAt: "2026-11-01T00:00:00.000Z",
    elapsedSec: 1000,
    distanceMeters: 10000,
    avgSpeedKmh: 20,
    caloriesEstimate: 400,
    routeDistanceMeters: 0,
    routeDurationSec: 0,
    ...over,
  };
}

const mixed = ride({
  regionDistances: [
    { country: "KR", admin1: "KR-11", meters: 3000 },
    { country: "KR", admin1: "KR-41", meters: 2000 },
    { country: "JP", admin1: "JP-13", meters: 5000 },
  ],
});

test("세계는 원본 그대로", () => {
  const list = [mixed, ride({ id: "r2" })];
  assert.equal(filterSessionsByRegion(list, WORLD), list);
  assert.equal(regionShareOf(ride({ id: "x" }), WORLD), 1);
});

test("국가 합", () => {
  assert.equal(regionShareOf(mixed, KR), 0.5);
});

test("행정구역 합", () => {
  assert.equal(regionShareOf(mixed, KR11), 0.3);
});

test("지역 정보 없는 주행은 지역에서 제외", () => {
  const list = [ride({ id: "r2" }), mixed];
  const out = filterSessionsByRegion(list, KR);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "r1");
});

test("합이 주행 거리를 넘으면 1 로 clamp", () => {
  const s = ride({ distanceMeters: 1000, regionDistances: [{ country: "KR", admin1: null, meters: 5000 }] });
  assert.equal(regionShareOf(s, KR), 1);
});

test("시간·칼로리 비례, 평균 속도 유지", () => {
  const r = applyRegionShare(mixed, KR11)!;
  assert.equal(r.distanceMeters, 3000);
  assert.equal(r.elapsedSec, 300);
  assert.equal(r.caloriesEstimate, 120);
  assert.equal(r.avgSpeedKmh, 20);
});

test("칼로리 null 은 null 유지", () => {
  const r = applyRegionShare({ ...mixed, caloriesEstimate: null }, KR)!;
  assert.equal(r.caloriesEstimate, null);
});

test("비율 0 이거나 거리 0 이면 제외", () => {
  assert.equal(applyRegionShare(mixed, { country: "US", admin1: null }), null);
  assert.equal(applyRegionShare({ ...mixed, distanceMeters: 0 }, KR), null);
});
