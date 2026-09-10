/**
 * 라이브 「새 도로」는 셀×30m 가 아니라 경로 실측 미터(미보유 셀만).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeLiveNewRoadFromRoute,
  shouldShowAlreadyOwnedHint,
} from "../../src/hooks/useLiveConquestPaint.ts";
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
});

describe("shouldShowAlreadyOwnedHint", () => {
  it("새 도로 0 + 세션 ≥ 10m → 힌트 표시", () => {
    assert.equal(shouldShowAlreadyOwnedHint(0, 10), true);
    assert.equal(shouldShowAlreadyOwnedHint(0, 50), true);
    assert.equal(shouldShowAlreadyOwnedHint(0, 100), true);
  });

  it("새 도로 0 + 세션 < 10m → 힌트 미표시(아직 달리지 않음)", () => {
    assert.equal(shouldShowAlreadyOwnedHint(0, 0), false);
    assert.equal(shouldShowAlreadyOwnedHint(0, 9), false);
    assert.equal(shouldShowAlreadyOwnedHint(0, 9.9), false);
  });

  it("새 도로 > 0m → 힌트 미표시(정상 증가 중)", () => {
    assert.equal(shouldShowAlreadyOwnedHint(1, 50), false);
    assert.equal(shouldShowAlreadyOwnedHint(30, 50), false);
    assert.equal(shouldShowAlreadyOwnedHint(100, 100), false);
  });

  it("미무장(null) → 힌트 미표시", () => {
    assert.equal(shouldShowAlreadyOwnedHint(null, 0), false);
    assert.equal(shouldShowAlreadyOwnedHint(null, 50), false);
    assert.equal(shouldShowAlreadyOwnedHint(null, 100), false);
  });

  it("전 구간 보유 + 실제 주행 거리 → A4 케이스 검증", () => {
    // A4: ownedAtStart 에 모든 셀이 포함돼 있으면 liveNewMeters = 0 (올바른 동작)
    // 그 상태에서 sessionProgress ≥ 10m 이면 힌트를 표시해 Chief에게 "이미 내 도로" 안내
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
    // 계산은 0이 맞고
    assert.equal(got.liveNewMeters, 0);
    // 세션이 충분히 진행됐으면 힌트가 표시돼야 함
    const sessionProgress = traveled; // fromMeters=0, traveledMeters=80
    assert.equal(shouldShowAlreadyOwnedHint(got.liveNewMeters, sessionProgress), true);
  });

  it("새 도로 있는 경우(A2/A3 정상) + 세션 진행 → 힌트 없음", () => {
    const geometry = shortLine();
    const traveled = 80;
    const got = computeLiveNewRoadFromRoute({
      geometry,
      traveledMeters: traveled,
      fromMeters: 0,
      ownedAtStart: new Set(), // 보유 없음
    });
    assert.ok(got.liveNewMeters > 0, "새 도로가 있어야 함");
    // 새 도로가 있으므로 힌트 없음
    assert.equal(shouldShowAlreadyOwnedHint(got.liveNewMeters, traveled), false);
  });
});
