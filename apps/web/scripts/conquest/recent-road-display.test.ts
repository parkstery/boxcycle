import { test } from "node:test";
import assert from "node:assert/strict";
import { RecentRoadDisplaySession, restoreRecentRoadDisplay, conquestDay, type RecentRoadInput } from "../../src/lib/conquest/recentNewRoadDisplay.ts";
import { buildConquestRoutePieces } from "../../src/lib/conquest/conquestTiles.ts";
import { lineStringLengthMeters, type LineStringGeometry } from "../../src/lib/geo/geo.ts";

const route: LineStringGeometry = { type: "LineString", coordinates: [[127, 37.5], [127, 37.502]] };
const other: LineStringGeometry = { type: "LineString", coordinates: [[128, 37.5], [128, 37.502]] };
const day = conquestDay();
const iso = new Date().toISOString();
const input = (extra: Partial<RecentRoadInput> = {}): RecentRoadInput => ({
  uid: "a", active: false, persisted: null, cellIds: [], route, traveled: 120, from: 0, ended: null, ...extra,
});
function end(s: RecentRoadDisplaySession, id = "r1", geometry = route) {
  s.advance(input({ active: true, route: geometry }));
  return s.advance(input({ route: null, traveled: 0, ended: { recordId: id, endedAtIso: iso, sessionPathLngLat: geometry.coordinates } }));
}

test("active to idle with reset meters and missing server document retains frozen final path", () => {
  const s = new RecentRoadDisplaySession();
  assert.ok(end(s).length);
  assert.ok(s.advance(input()).length, "closing the result cannot clear the candidate");
  assert.ok(s.result("r1", { status: "positive", newMeters: 70, day }).length);
  const out = s.advance(input());
  assert.ok(Math.abs(out.reduce((n, g) => n + lineStringLengthMeters(g), 0) - 70) < 0.01);
  assert.ok(s.result("r1", { status: "positive", newMeters: 70, day }).length, "duplicate legacy positive must not erase the confirmed geometry");
});
test("same-day rides merge; duplicate callback replaces only its own entry", () => {
  const s = new RecentRoadDisplaySession();
  end(s);
  s.result("r1", { status: "positive", newMeters: 100, day, newGeometry: [route] });
  end(s, "r2", other);
  const result = { status: "positive" as const, newMeters: 100, day, newGeometry: [other] };
  assert.equal(s.result("r2", result).length, 2);
  assert.equal(s.result("r2", result).length, 2);
  assert.equal(s.advance(input({ persisted: { day: "20200101", geometry: [other] } })).length, 2);
});
for (const status of ["confirmed_zero", "error", "timeout"] as const) test(`${status} removes only current candidate`, () => {
  const s = new RecentRoadDisplaySession();
  end(s);
  s.result("r1", { status: "positive", newMeters: 100, day, newGeometry: [route] });
  end(s, "r2", other);
  const out = status === "timeout" ? s.timeout("r2") : s.result("r2", { status, newMeters: 0 });
  assert.deepEqual(out, [route]);
  assert.deepEqual(s.advance(input()), [route]);
});
test("newer confirmed date replaces previous date, late snapshot cannot revert it", () => {
  const s = new RecentRoadDisplaySession();
  s.advance(input({ persisted: { day: "20200101", geometry: [other] } }));
  end(s);
  s.result("r1", { status: "positive", newMeters: 100, day, newGeometry: [route] });
  assert.deepEqual(s.advance(input({ persisted: { day: "20200101", geometry: [other] } })), [route]);
});
test("wrong ride response and previous account are isolated", () => {
  const s = new RecentRoadDisplaySession();
  end(s);
  assert.ok(s.result("wrong", { status: "confirmed_zero", newMeters: 0 }).length);
  assert.deepEqual(s.advance(input({ uid: "b" })), []);
  assert.deepEqual(s.result("r1", { status: "positive", newMeters: 100, newGeometry: [route] }), []);
  assert.deepEqual(s.advance(input({ uid: null })), []);
});
test("legacy acquisition date restores all latest-day traces but excludes old cells and other dates", () => {
  const pieces = buildConquestRoutePieces(route, Infinity);
  const oldCell = pieces[0].cellId;
  const cells = new Map(pieces.map((p) => [p.cellId, p.cellId === oldCell ? "20200101" : day]));
  for (const p of buildConquestRoutePieces(other, Infinity)) cells.set(p.cellId, day);
  const restored = restoreRecentRoadDisplay(cells, [{ day, geometry: route }, { day, geometry: other }, { day: "20200101", geometry: route }]);
  assert.equal(restored?.day, day);
  assert.ok(restored!.geometry.length >= 2);
  assert.ok(restored!.geometry.some((g) => g.coordinates[0][0] === 128));
  assert.ok(restored!.geometry.filter((g) => g.coordinates[0][0] === 127).reduce((n, g) => n + lineStringLengthMeters(g), 0) < lineStringLengthMeters(route));
  assert.equal(restoreRecentRoadDisplay(new Map([[oldCell, "invalid"]]), [{ day, geometry: route }]), null);
});
test("KST day crosses midnight independently of the machine timezone", () => {
  assert.equal(conquestDay("2026-10-19T15:00:00Z"), "2026-10-20");
  assert.equal(conquestDay("2026-10-19T14:59:59Z"), "2026-10-19");
});
test("late legacy positive restores a timed-out candidate from its frozen end path", () => {
  const s = new RecentRoadDisplaySession();
  end(s);
  assert.deepEqual(s.timeout("r1"), []);
  assert.ok(s.result("r1", { status: "positive", newMeters: 70, day }).length);
});

test("real server dashed acquisition dates restore and merge with compact dates", () => {
  const pieces = buildConquestRoutePieces(route, Infinity);
  const cells = new Map(pieces.map((p) => [p.cellId, "2026-10-20"]));
  assert.equal(restoreRecentRoadDisplay(cells, [{ day: "2026-10-20", geometry: route }])?.day, "2026-10-20");
  const s = new RecentRoadDisplaySession();
  s.advance(input({ persisted: { day: "2026-10-20", geometry: [route] } }));
  s.advance(input({ active: true, route: other }));
  s.advance(input({ ended: { recordId: "r", endedAtIso: "2026-10-20T01:00:00Z" } }));
  assert.equal(s.result("r", { status: "positive", newMeters: 50, day: "20261020", newGeometry: [other] }).length, 2);
});
