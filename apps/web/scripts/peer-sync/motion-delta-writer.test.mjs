import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let createWriter;
before(async () => {
  server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  createWriter = (await server.ssrLoadModule("/src/lib/peerMotion/repo/motionDeltaWriter.ts")).createMotionDeltaWriter;
});
after(async () => { await server?.close(); });

const initial = { p: "publication-1234567890", d: 100.12, v: 1.39, ph: "live", t: 1700000000000, tSrv: 1700000000000 };
function harness() {
  const rows = new Map();
  const requests = [];
  const pauses = [];
  let rejectNextUpdate = false;
  const apply = (kind, key, value) => {
    requests.push({ kind, key, value: { ...value } });
    if (kind === "update" && rejectNextUpdate) { rejectNextUpdate = false; return Promise.reject(new Error("missing-node")); }
    const next = kind === "set" ? { ...value } : { ...rows.get(key), ...value };
    for (const prop of Object.keys(next)) if (next[prop] === null) delete next[prop];
    rows.set(key, next);
    const pause = pauses.shift();
    return pause ? pause.promise : Promise.resolve();
  };
  const writer = createWriter({ set: (k, v) => apply("set", k, v), update: (k, v) => apply("update", k, v) });
  return {
    writer, rows, requests,
    rejectUpdate() { rejectNextUpdate = true; },
    pause() { let resolve; const promise = new Promise((done) => { resolve = done; }); pauses.push({ promise }); return resolve; },
  };
}

test("same 5Hz payload sequence reconstructs every row and cuts steady request bytes", async () => {
  const h = harness();
  let fullBytes = 0;
  for (let i = 0; i < 100; i++) {
    const value = { ...initial, d: initial.d + i * 0.28, t: initial.t + i * 200, tSrv: initial.tSrv + i * 200 };
    fullBytes += Buffer.byteLength(JSON.stringify(value));
    await h.writer.write("a", value);
    assert.deepEqual(h.rows.get("a"), value, `row ${i}`);
  }
  const bytes = h.requests.reduce((sum, r) => sum + Buffer.byteLength(JSON.stringify(r.value)), 0);
  assert.equal(h.requests.length, 100, "cadence must not be reduced");
  assert.ok(bytes < fullBytes * 0.65, `bytes ${bytes} vs full ${fullBytes}`);
  assert.equal(h.requests[0].kind, "set");
  assert.equal(h.requests[1].kind, "update");
});

test("phase, speed, publication and optional-field removal restore exact full state", async () => {
  const h = harness();
  for (const value of [initial, { ...initial, ph: "paused", v: 0 }, { ...initial, p: "other", ph: "completed", v: 0 }, { p: "legacy", d: 0, v: 0, ph: "live", t: initial.t + 1 }]) {
    await h.writer.write("a", value);
    assert.deepEqual(h.rows.get("a"), value);
  }
});

test("disconnect and cleanup invalidate metadata before recreating an absent node", async () => {
  const h = harness();
  await h.writer.write("a", initial);
  h.rows.delete("a");
  h.writer.invalidate("a");
  await h.writer.write("a", { ...initial, d: 101 });
  assert.equal(h.requests.at(-1).kind, "set");
  h.writer.invalidate();
  await h.writer.write("b", initial);
  assert.equal(h.requests.at(-1).kind, "set");
});

test("overlapping writes send complete states and reversed acknowledgements cannot poison cache", async () => {
  const h = harness();
  await h.writer.write("a", initial);
  const firstDone = h.pause();
  const first = h.writer.write("a", { ...initial, ph: "paused", v: 0 });
  const second = h.writer.write("a", { ...initial, d: 102 });
  await second;
  firstDone();
  await first;
  const final = { ...initial, d: 103 };
  await h.writer.write("a", final);
  assert.deepEqual(h.rows.get("a"), final);
  assert.equal(h.requests[2].kind, "set");
});

test("one failed delta restores the latest complete snapshot; stale completion after reset is ignored", async () => {
  const h = harness();
  await h.writer.write("a", initial);
  h.rejectUpdate();
  const fresh = { ...initial, d: 105 };
  await h.writer.write("a", fresh);
  assert.deepEqual(h.rows.get("a"), fresh);
  assert.equal(h.requests.at(-1).kind, "set");
  const oldDone = h.pause();
  const old = h.writer.write("a", { ...fresh, d: 106 });
  h.writer.invalidate("a");
  await h.writer.write("a", { ...fresh, p: "new-session", d: 1 });
  oldDone();
  await old;
  const latest = { ...fresh, p: "new-session", d: 2 };
  await h.writer.write("a", latest);
  assert.deepEqual(h.rows.get("a"), latest);
});

test("a superseded failed delta never replays an old snapshot over a newer full write", async () => {
  let rejectOld;
  const calls = [];
  const writer = createWriter({
    set: async (_key, value) => { calls.push({ ...value }); },
    update: () => new Promise((_resolve, reject) => { rejectOld = reject; }),
  });
  await writer.write("a", initial);
  const old = writer.write("a", { ...initial, d: 101 });
  const rejection = assert.rejects(old, /old-failure/);
  const newer = { ...initial, p: "new-publication", d: 102 };
  await writer.write("a", newer);
  rejectOld(new Error("old-failure"));
  await rejection;
  assert.deepEqual(calls, [initial, newer]);
});
