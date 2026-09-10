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
});
