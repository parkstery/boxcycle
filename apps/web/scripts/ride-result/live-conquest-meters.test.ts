/**
 * 라이브 「새 도로」는 셀×30m 가 아니라 경로 실측 미터(미보유 셀만).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLiveNewRoadFromRoute } from "../../src/hooks/useLiveConquestPaint.ts";
import { buildConquestCellsFromRoute, conquestCellIdAt } from "../../src/lib/conquestTiles.ts";
import type { LineStringGeometry } from "../../src/lib/geo.ts";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "../../src/lib/geo.ts";

/** ~111m 남북 직선 (위도 0.001°) */
function shortLine(): LineStringGeometry {
  return {
    type: "LineString",
    coordinates: [
      [127.0, 37.5],
      [127.0, 37.501],
    ],
  };
}

describe("computeLiveNewRoadFromRoute", () => {
  it("미보유 구간이면 새 도로 미터 ≈ 세션 주행 미터", () => {
    const geometry = shortLine();
    const traveled = 80;
    const session = computeLiveNewRoadFromRoute({
      geometry,
      traveledMeters: traveled,
      fromMeters: 0,
      ownedAtStart: new Set(),
    });
    assert.ok(session.liveNewMeters > 0, "new meters > 0");
    // 셀 반올림 오차 허용 — 30m×셀 근사(예: 150)와는 확실히 구분
    assert.ok(
      Math.abs(session.liveNewMeters - traveled) <= 2,
      `expected ~${traveled}m got ${session.liveNewMeters}m`,
    );
    assert.ok(session.liveNewMeters < 120, "must not use cell×30 inflation");
  });

  it("시작 시점 보유 셀은 새 도로에서 제외", () => {
    const geometry = shortLine();
    const traveled = 80;
    const mid = getPointOnRouteByDistance(geometry, 40);
    assert.ok(mid);
    const ownedId = conquestCellIdAt(mid!);
    const all = buildConquestCellsFromRoute(geometry, traveled, 0);
    const totalM = all.reduce((s, c) => s + c.m, 0);
    const ownedM = all.filter((c) => c.id === ownedId).reduce((s, c) => s + c.m, 0);

    const got = computeLiveNewRoadFromRoute({
      geometry,
      traveledMeters: traveled,
      fromMeters: 0,
      ownedAtStart: new Set([ownedId]),
    });
    assert.equal(got.liveNewMeters, totalM - ownedM);
    assert.ok(got.liveNewMeters < totalM || ownedM === 0);
  });

  it("fromMeters(재개 offset) 이전 구간은 세션 새 도로에 넣지 않는다", () => {
    const geometry = shortLine();
    const len = lineStringLengthMeters(geometry);
    const from = Math.min(40, Math.floor(len / 2));
    const traveled = Math.min(from + 40, len);
    const sessionLen = traveled - from;

    const got = computeLiveNewRoadFromRoute({
      geometry,
      traveledMeters: traveled,
      fromMeters: from,
      ownedAtStart: new Set(),
    });
    assert.ok(
      Math.abs(got.liveNewMeters - sessionLen) <= 2,
      `session ${sessionLen}m vs live ${got.liveNewMeters}m`,
    );
  });

  it("전 구간이 시작 시점 보유면 새 도로 0", () => {
    const geometry = shortLine();
    const traveled = 80;
    const all = buildConquestCellsFromRoute(geometry, traveled, 0);
    const owned = new Set(all.map((c) => c.id));
    const got = computeLiveNewRoadFromRoute({
      geometry,
      traveledMeters: traveled,
      fromMeters: 0,
      ownedAtStart: owned,
    });
    assert.equal(got.liveNewMeters, 0);
    assert.equal(got.liveNewCells, 0);
  });

  it("traveledMeters 증가 시 liveNewMeters 단조 증가 — +0.00 고착 없음 (A3)", () => {
    const geometry = shortLine();
    const steps = [10, 20, 30, 50, 70, 90];
    const results = steps.map((t) =>
      computeLiveNewRoadFromRoute({
        geometry,
        traveledMeters: t,
        fromMeters: 0,
        ownedAtStart: new Set(),
      }).liveNewMeters,
    );
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i] >= results[i - 1],
        `step ${steps[i]}m: ${results[i]} >= ${results[i - 1]} 여야 함`,
      );
    }
    assert.ok(results[results.length - 1] > 0, "최종값 > 0");
  });

  it("세션 시작 시점(traveledMeters=fromMeters)에서 새 도로 0 — 이전 잔여 비노출 (A5 경계)", () => {
    const geometry = shortLine();
    // traveledMeters === fromMeters → 세션 실주행 0m, 계산 결과도 0
    for (const offset of [0, 30, 60]) {
      const got = computeLiveNewRoadFromRoute({
        geometry,
        traveledMeters: offset,
        fromMeters: offset,
        ownedAtStart: new Set(),
      });
      assert.equal(
        got.liveNewMeters,
        0,
        `offset=${offset}: 세션 시작 시점 새 도로는 0 이어야 함`,
      );
    }
  });

  it("재개 구간 미보유 시 세션 거리 ≈ 새 도로 (이어달리기 + 미보유, A2·A3 통합)", () => {
    const geometry = shortLine();
    const from = 30;
    const traveled = 80;
    const sessionLen = traveled - from;
    const got = computeLiveNewRoadFromRoute({
      geometry,
      traveledMeters: traveled,
      fromMeters: from,
      ownedAtStart: new Set(),
    });
    assert.ok(got.liveNewMeters > 0, "새 도로 > 0");
    assert.ok(
      Math.abs(got.liveNewMeters - sessionLen) <= 2,
      `세션 ${sessionLen}m vs 새도로 ${got.liveNewMeters}m`,
    );
  });
});
