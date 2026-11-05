import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countTrailsByCountry,
  defaultTrailFinderScope,
  estimateTrailMinutes,
  filterTrailFinderRows,
  formatTrailMinutes,
  groupTrailFinderRows,
  type TrailFinderRow,
} from "../../src/lib/trail/trailFinder.ts";

/** 2026-11-05 Chief F1~F4 — Trail 찾기 규칙 */
const row = (id: string, o: Partial<TrailFinderRow>): TrailFinderRow => ({
  id, displayNumber: 1, regionLabel: null, distanceKm: null, publicationId: null, riderCount: 1, createdAtMs: 0,
  geoContinent: null, geoCountry: null, ...o,
});

describe("trailFinder", () => {
  it("기본 범위 = 대표 국가, 없으면 세계(F1)", () => {
    assert.deepEqual(defaultTrailFinderScope("KR"), { type: "country", code: "KR" });
    assert.deepEqual(defaultTrailFinderScope(null), { type: "world" });
  });

  it("예상 시간 = 거리 ÷ 평균 속도", () => {
    assert.equal(estimateTrailMinutes(6, 18), 20);
    assert.equal(estimateTrailMinutes(null, 18), null);
    assert.equal(formatTrailMinutes(20.4), "20분");
    assert.equal(formatTrailMinutes(95), "1시간 35분");
  });

  it("거리·시간 구간과 검색으로 거른다(F3)", () => {
    const rows = [row("a", { distanceKm: 6.2, regionLabel: "남산공원길" }), row("b", { distanceKm: 12.3, regionLabel: "한강 북단" }), row("c", { distanceKm: 3 })];
    assert.deepEqual(filterTrailFinderRows(rows, { distance: "5to15", time: "all", avgKmh: 18 }).map((r) => r.id), ["a", "b"]);
    assert.deepEqual(filterTrailFinderRows(rows, { distance: "all", time: "lt20", avgKmh: 18 }).map((r) => r.id), ["c"]);
    assert.deepEqual(filterTrailFinderRows(rows, { distance: "all", time: "all", avgKmh: 18, query: "한강" }).map((r) => r.id), ["b"]);
  });

  it("같은 경로 Trail 은 한 줄로, 사람 많은 순(F2)", () => {
    const g = groupTrailFinderRows(
      [row("a", { publicationId: "p", riderCount: 3 }), row("b", { publicationId: "p", riderCount: 1 }), row("c", { riderCount: 2 })],
      "riders",
    );
    assert.deepEqual(g.map((x) => [x.key, x.riderCount, x.trails.length]), [["p:p", 4, 2], ["t:c", 2, 1]]);
    assert.deepEqual(g[0].trails.map((t) => t.id), ["a", "b"]);
  });

  it("새로 열린 순은 묶음 안 가장 최근 Trail 기준", () => {
    const g = groupTrailFinderRows([row("a", { riderCount: 9, createdAtMs: 1 }), row("b", { riderCount: 1, createdAtMs: 5 })], "new");
    assert.deepEqual(g.map((x) => x.key), ["t:b", "t:a"]);
  });

  it("국가별 Trail 수(범위 고르기)", () => {
    const c = countTrailsByCountry([row("a", { geoCountry: "FR" }), row("b", { geoCountry: "FR" }), row("c", { geoCountry: "DE" }), row("d", {})]);
    assert.deepEqual(c.map((x) => [x.code, x.count]), [["FR", 2], ["DE", 1]]);
  });
});
