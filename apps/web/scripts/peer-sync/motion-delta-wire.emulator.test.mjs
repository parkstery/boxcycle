import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer as createTcpServer, connect } from "node:net";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, deleteApp } from "firebase/app";
import { connectDatabaseEmulator, getDatabase, ref, set, update, onValue, onDisconnect, goOffline, goOnline } from "firebase/database";
import { createServer } from "vite";

test("real RTDB Rules, identical remote snapshots, 5Hz request/wire bytes and reconnect", { timeout: 60000 }, async () => {
  const port = Number(process.env.PEER_DELTA_EMULATOR_PORT ?? 9019);
  let up = 0;
  let down = 0;
  const sockets = new Set();
  const proxy = createTcpServer((client) => {
    const upstream = connect(port, "127.0.0.1");
    sockets.add(client); sockets.add(upstream);
    client.on("data", (data) => { up += data.length; });
    upstream.on("data", (data) => { down += data.length; });
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.pipe(upstream); upstream.pipe(client);
  });
  await new Promise((done) => proxy.listen(0, "127.0.0.1", done));
  const proxyPort = proxy.address().port;
  const vite = await createServer({ root: fileURLToPath(new URL("../..", import.meta.url)), optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  const { createMotionDeltaWriter } = await vite.ssrLoadModule("/src/lib/peerMotion/repo/motionDeltaWriter.ts");
  const { decodeTrailMotionPayload } = await vite.ssrLoadModule("/src/lib/peerMotion/repo/rtdbTrailMotion.ts");
  const apps = [];
  const databases = [];
  const results = [];
  const waitFor = async (condition, label) => {
    const end = Date.now() + 5000;
    while (!condition()) { if (Date.now() > end) throw new Error(`timeout ${label}`); await delay(10); }
  };
  const newDb = (uid, name) => {
    const app = initializeApp({ projectId: "demo-peer-traffic", databaseURL: "https://demo-peer-traffic-default-rtdb.firebaseio.com" }, name);
    apps.push(app);
    const db = getDatabase(app);
    connectDatabaseEmulator(db, "127.0.0.1", proxyPort, { mockUserToken: { sub: uid, user_id: uid } });
    databases.push(db);
    return db;
  };
  try {
    for (const mode of ["full", "delta"]) {
      const sender = newDb("rider-a", `sender-${mode}`);
      const viewer = newDb("rider-b", `viewer-${mode}`);
      const key = `trails/wire-${mode}/motion/rider-a`;
      let received;
      const release = onValue(ref(viewer, key), (snap) => { received = snap.val(); });
      const bodies = [];
      const writer = createMotionDeltaWriter({
        set: async (k, value) => { bodies.push(value); await set(ref(sender, k), value); },
        update: async (k, value) => { bodies.push(value); await update(ref(sender, k), value); },
      });
      const base = { p: "publication-1234567890", d: 100, v: 1.39, ph: "live", t: 1700000000000, tSrv: 1700000000000 };
      await assert.rejects(set(ref(viewer, key), base), /permission_denied/i, "other UID must be denied by actual Rules");
      await assert.rejects(set(ref(sender, key), { d: 100 }), /permission_denied/i, "incomplete row must fail Rules validation");
      await set(ref(sender, key), base);
      await waitFor(() => received?.t === base.t, "initial remote state");
      await delay(100);
      up = 0; down = 0;
      let fullJsonBytes = 0;
      for (let i = 1; i <= 20; i++) {
        const value = { ...base, d: Math.round((base.d + i * (5 / 3.6) * 0.2) * 100) / 100, t: base.t + i * 200, tSrv: base.tSrv + i * 200 };
        fullJsonBytes += Buffer.byteLength(JSON.stringify(value));
        if (mode === "delta") await writer.write(key, value);
        else { bodies.push(value); await set(ref(sender, key), value); }
        await waitFor(() => received?.t === value.t, `remote tick ${i}`);
        assert.deepEqual(received, value);
        assert.equal(decodeTrailMotionPayload("rider-a", received).distM, value.d);
        await delay(200);
      }
      const measured = { mode, samples: 20, fullJsonBytes, submittedJsonBytes: bodies.reduce((sum, body) => sum + Buffer.byteLength(JSON.stringify(body)), 0), tcpUpBytes: up, tcpDownBytes: down };
      results.push(measured);
      if (mode === "delta") {
        // Simulate a server-side deletion unknown to the acknowledged base.
        await set(ref(sender, key), null);
        await waitFor(() => received === null, "unexpected removal");
        const restored = { ...base, d: 110, t: base.t + 5000, tSrv: base.tSrv + 5000 };
        await writer.write(key, restored);
        await waitFor(() => received?.t === restored.t, "failed delta full-state recovery");
        assert.deepEqual(received, restored);
      }
      for (const value of [
        { ...base, ph: "paused", v: 0 },
        { ...base, p: "new-publication", ph: "completed", v: 0 },
        { p: "legacy", d: 0, v: 0, ph: "live", t: base.t + 9999 },
      ]) {
        await writer.write(key, value);
        await waitFor(() => JSON.stringify(received) === JSON.stringify(value) || (received?.p === value.p && received?.ph === value.ph && received?.t === value.t && received?.tSrv === value.tSrv), "phase/optional removal");
        assert.deepEqual(received, value);
      }
      await onDisconnect(ref(sender, key)).remove();
      goOffline(sender);
      await waitFor(() => received === null, "disconnect removal");
      writer.invalidate();
      goOnline(sender);
      await writer.write(key, base);
      await waitFor(() => received?.p === base.p, "reconnect full state");
      assert.deepEqual(received, base);
      release();
      goOffline(sender); goOffline(viewer);
    }
    assert.equal(results[0].samples, results[1].samples);
    assert.ok(results[1].submittedJsonBytes < results[0].submittedJsonBytes * 0.7);
    const report = { generatedAt: new Date().toISOString(), project: "demo-peer-traffic", rules: "repository database.rules.json", transport: "local unencrypted TCP including WebSocket protocol; not production billed bandwidth", results };
    const output = process.env.PEER_DELTA_EVIDENCE ?? resolve("../../document/ops/20261029-peer-cost-quality/evidence/motion-delta-wire.json");
    mkdirSync(resolve(output, ".."), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    databases.forEach((db) => goOffline(db));
    await Promise.all(apps.map((app) => deleteApp(app)));
    for (const socket of sockets) socket.destroy();
    await new Promise((done) => proxy.close(done));
    await vite.close();
  }
});
