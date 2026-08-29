// 완료 구간·남은 구간 분할 계약(RIDE-CONTINUE-1 §7.1 「Route 분할」).
// 경계 틈·중복이 생기면 지도에서 마젠타(달린 길)와 빨강(안 간 길) 사이가 벌어진다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitLineStringAtMeters } from "../../src/lib/routeProgressSplit.ts";
import {
  getDistanceMeters,
  lineStringLengthMeters,
  type LineStringGeometry,
} from "../../src/lib/geo.ts";

function makeRoute(points = 11): LineStringGeometry {
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i += 1) coords.push([127.0 + i * 0.001, 37.5]);
  return { type: "LineString", coordinates: coords };
}

const ROUTE = makeRoute();
const GEO_LEN = lineStringLengthMeters(ROUTE);

describe("M0 · 시험 fixture 자가 검산", () => {
  it("경로 전장이 유의미하다", () => {
    assert.ok(GEO_LEN > 500, `전장이 너무 짧다: ${GEO_LEN}`);
  });
});

describe("splitLineStringAtMeters", () => {
  it("0%: 완료 선 없음 · 남은 선 전체", () => {
    const s = splitLineStringAtMeters(ROUTE, 0);
    assert.equal(s.completed, null);
    assert.ok(s.remaining);
    assert.ok(Math.abs(lineStringLengthMeters(s.remaining!) - GEO_LEN) < 1);
  });

  it("중간: 두 선의 경계 좌표가 정확히 같다", () => {
    const s = splitLineStringAtMeters(ROUTE, GEO_LEN * 0.31);
    assert.ok(s.completed && s.remaining);
    const completedEnd = s.completed!.coordinates[s.completed!.coordinates.length - 1];
    const remainingStart = s.remaining!.coordinates[0];
    assert.deepEqual(completedEnd, remainingStart, "경계 좌표가 다르다(틈·중복 발생)");
  });

  it("중간: 두 선 거리 합이 원본과 같다", () => {
    for (const ratio of [0.1, 0.31, 0.43, 0.5, 0.97]) {
      const s = splitLineStringAtMeters(ROUTE, GEO_LEN * ratio);
      const sum =
        (s.completed ? lineStringLengthMeters(s.completed) : 0) +
        (s.remaining ? lineStringLengthMeters(s.remaining) : 0);
      assert.ok(
        Math.abs(sum - GEO_LEN) < 1,
        `합계 불일치 ratio=${ratio}: ${sum} vs ${GEO_LEN}`,
      );
    }
  });

  it("중간: 완료 선 길이가 요청 거리와 같다", () => {
    const target = GEO_LEN * 0.43;
    const s = splitLineStringAtMeters(ROUTE, target);
    assert.ok(s.completed);
    assert.ok(Math.abs(lineStringLengthMeters(s.completed!) - target) < 1);
  });

  it("100%: 완료 선 전체 · 남은 선 없음", () => {
    const s = splitLineStringAtMeters(ROUTE, GEO_LEN);
    assert.ok(s.completed);
    assert.equal(s.remaining, null);
    assert.ok(Math.abs(lineStringLengthMeters(s.completed!) - GEO_LEN) < 1);
    const last = ROUTE.coordinates[ROUTE.coordinates.length - 1];
    assert.ok(getDistanceMeters(s.boundary!, last) < 0.5);
  });

  it("전장 초과·음수·비유한 입력에도 깨지지 않는다", () => {
    assert.equal(splitLineStringAtMeters(ROUTE, GEO_LEN * 5).remaining, null);
    assert.equal(splitLineStringAtMeters(ROUTE, -10).completed, null);
    assert.equal(splitLineStringAtMeters(ROUTE, Number.NaN).completed, null);
  });

  it("좌표가 2점 미만이면 아무것도 그리지 않는다", () => {
    const s = splitLineStringAtMeters({ type: "LineString", coordinates: [[127, 37.5]] }, 10);
    assert.equal(s.completed, null);
    assert.equal(s.remaining, null);
    assert.equal(s.boundary, null);
  });
});
