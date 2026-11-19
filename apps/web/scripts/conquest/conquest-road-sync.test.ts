import assert from "node:assert/strict";
import { test } from "node:test";
import { syncConquestRoadData, roadSyncCursor, parseRoadSyncToken, parseRoadSummaryToken, validRoadCache, type RoadCache, type RoadData, type RoadSyncToken } from "../../src/lib/conquest/conquestRoadSync.ts";

const token = (version: number, epoch = "epoch-A"): RoadSyncToken => ({ schema: 1, epoch, version });
const chunk = (id: string, cells: Record<string, string> = { "20_1_1": "2026-11-19" }) => ({ id, cells });
const trace = (id: string) => ({ id, newMeters: 1, geometry: { type: "LineString" as const, coordinates: [[127, 37], [127, 37.001]] as [number, number][] } });
const baseline: RoadCache = { uid: "A", token: token(1), chunks: [chunk("c1")], traces: [trace("t1")] };
function fixture(stored: unknown = baseline) {
  let cache = stored;
  const queries: (number | null)[] = [];
  let confirmed: RoadSyncToken | null = token(2);
  let remote: RoadData = { chunks: [chunk("c2")], traces: [trace("t2")] };
  const ports = {
    readCache: async () => cache,
    writeCache: async (value: RoadCache) => { cache = value; },
    dropCache: async () => { cache = null; },
    readRemote: async (since: number | null) => { queries.push(since); return remote; },
    readToken: async () => confirmed,
  };
  return { ports, queries, cache: () => cache, remote: (v: RoadData) => { remote = v; }, confirm: (v: RoadSyncToken | null) => { confirmed = v; } };
}

test("unchanged version reuses the complete baseline without chunk/trace or verification reads", async () => {
  const f = fixture();
  f.ports.readRemote = async () => { throw new Error("unexpected remote read"); };
  f.ports.readToken = async () => { throw new Error("unexpected parent reread"); };
  assert.deepEqual(await syncConquestRoadData("A", token(1), f.ports), baseline);
});
test("changed chunks replace their old cells and changed trace ids do not duplicate", async () => {
  const f = fixture();
  f.remote({ chunks: [chunk("c1", { "20_2_2": "2026-11-20" })], traces: [trace("t1"), trace("t2")] });
  const value = await syncConquestRoadData("A", token(2), f.ports);
  assert.deepEqual(f.queries, [1]);
  assert.deepEqual(value.chunks[0].cells, { "20_2_2": "2026-11-20" });
  assert.deepEqual(value.traces.map(t => t.id), ["t1", "t2"]);
  assert.equal((f.cache() as RoadCache).token.version, 2);
});
test("new epoch resets the cache even when totals/version happen to match", async () => {
  const f = fixture(); f.confirm(token(1, "epoch-B"));
  const value = await syncConquestRoadData("A", token(1, "epoch-B"), f.ports);
  assert.deepEqual(f.queries, [null]);
  assert.deepEqual(value.chunks.map(c => c.id), ["c2"]);
  assert.deepEqual(value.traces.map(t => t.id), ["t2"]);
});
test("wrong uid, corrupt persistence and missing persistence all require full baseline", async () => {
  for (const stored of [null, {}, { ...baseline, uid: "B" }, { ...baseline, traces: [{ id: "broken" }] }]) {
    const f = fixture(stored);
    await syncConquestRoadData("A", token(2), f.ports);
    assert.deepEqual(f.queries, [null]);
  }
});
test("old server or missing summary discards persistent baseline and retains full read compatibility", async () => {
  const f = fixture();
  await syncConquestRoadData("A", null, f.ports);
  assert.deepEqual(f.queries, [null]);
  assert.equal(f.cache(), null);
});
test("a query error cannot mark a partial baseline as current", async () => {
  const f = fixture();
  f.ports.readRemote = async () => { throw new Error("network unavailable"); };
  await assert.rejects(syncConquestRoadData("A", token(2), f.ports), /network unavailable/);
  assert.deepEqual(f.cache(), baseline);
});
test("parent deletion during fetch clears cache and rejects pre-reset results", async () => {
  const f = fixture(); f.confirm(null);
  await assert.rejects(syncConquestRoadData("A", token(2), f.ports), /summary-changed/);
  assert.equal(f.cache(), null);
});
test("version changes during fetch retry without skipping intervening changed documents", async () => {
  const f = fixture(); f.confirm(token(3));
  await syncConquestRoadData("A", token(2), f.ports);
  assert.deepEqual(f.queries, [1, 1]);
  assert.equal((f.cache() as RoadCache).token.version, 3);
});
test("epoch change during fetch forces next request to load the new complete baseline", async () => {
  const f = fixture(); f.confirm(token(1, "epoch-B"));
  await syncConquestRoadData("A", token(2), f.ports);
  assert.deepEqual(f.queries, [1, null]);
  assert.equal((f.cache() as RoadCache).token.epoch, "epoch-B");
});
test("continuously changing server cannot publish a falsely current cache", async () => {
  const f = fixture(); let version = 2;
  f.ports.readToken = async () => token(++version);
  await assert.rejects(syncConquestRoadData("A", token(2), f.ports), /summary-changing/);
  assert.deepEqual(f.cache(), baseline);
  assert.equal(f.queries.length, 3);
});
test("cursor order handles 9→10, isolates epochs, and rejects invalid protocol tokens", () => {
  assert.ok(roadSyncCursor(token(9)) < roadSyncCursor(token(10)));
  assert.ok(roadSyncCursor(token(10)) < "epoch-A:\uf8ff");
  assert.ok(roadSyncCursor(token(1, "epoch-B")) > "epoch-A:\uf8ff");
  for (const value of [null, {}, token(0), token(1.5), token(Number.MAX_SAFE_INTEGER + 1), { ...token(1), schema: 2 }]) assert.equal(parseRoadSyncToken(value), null);
  assert.equal(validRoadCache({ ...baseline, traces: [trace("t1"), { ...trace("bad"), geometry: { type: "LineString", coordinates: [[NaN, 1], [2, 3]] } }] }, "A"), false);
});

test("mixed deployment / old writer cannot reuse a version whose parent timestamp has moved", () => {
  const stamp = { seconds: 100, nanoseconds: 5 };
  const roadSync = { ...token(1), updatedAt: stamp };
  assert.deepEqual(parseRoadSummaryToken({ roadSync, updatedAt: stamp }), token(1));
  assert.equal(parseRoadSummaryToken({ roadSync, updatedAt: { ...stamp, nanoseconds: 6 } }), null);
  assert.equal(parseRoadSummaryToken({ roadSync: token(1), updatedAt: stamp }), null);
  assert.equal(parseRoadSummaryToken(undefined), null);
});
