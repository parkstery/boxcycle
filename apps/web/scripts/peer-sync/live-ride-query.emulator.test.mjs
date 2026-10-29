import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore, connectFirestoreEmulator, collection, doc, setDoc, deleteDoc,
  onSnapshot, Timestamp, terminate, disableNetwork, enableNetwork,
} from "firebase/firestore";
import { createServer } from "vite";

test("server-side self exclusion: remote deliveries, continuous fallback rows, reconnect and Rules", { timeout: 60000 }, async () => {
  const projectId = "demo-peer-fs-read";
  const port = Number(process.env.PEER_FS_EMULATOR_PORT ?? 8089);
  const apps = [];
  const databases = [];
  const releases = [];
  const vite = await createServer({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false },
    appType: "custom", logLevel: "error",
  });
  const { livePublicationRidesQuery } = await vite.ssrLoadModule("/src/lib/trail/repo/livePublicationRidesQuery.ts");
  const { trailLiveRowToPeerMotionPacket } = await vite.ssrLoadModule("/src/lib/peerMotion/rowToPacket.ts");
  const newDb = (uid, name) => {
    const app = initializeApp({ projectId }, name);
    apps.push(app);
    const db = getFirestore(app);
    connectFirestoreEmulator(db, "127.0.0.1", port, { mockUserToken: { sub: uid, user_id: uid } });
    databases.push(db);
    return db;
  };
  const waitFor = async (predicate, label) => {
    const until = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > until) throw new Error(`timeout: ${label}`);
      await delay(10);
    }
  };
  const path = "trails/default/livePublicationRides";
  const payload = (n, phase = "live", publicationId = "publication-a") => ({
    publicationId, progressRatio: n / 1000, distMeters: n,
    speedMps: phase === "live" ? 5 / 3.6 : 0, ridePhase: phase,
    displayName: "Remote rider", lastSeenAt: Timestamp.fromMillis(1700000000000 + n * 4000),
  });
  let baseline;
  let filtered;
  let baselineChanges = 0;
  let filteredChanges = 0;
  let baselineDeliveries = 0;
  let filteredDeliveries = 0;
  const errors = [];
  const consume = (mode) => (snap) => {
    if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    if (mode === "baseline") { baseline = rows; baselineChanges += snap.docChanges().length; baselineDeliveries += 1; }
    else { filtered = rows; filteredChanges += snap.docChanges().length; filteredDeliveries += 1; }
  };
  try {
    const aliceWriter = newDb("alice", "alice-writer");
    const bobWriter = newDb("bob", "bob-writer");
    const oldViewer = newDb("alice", "old-viewer");
    const newViewer = newDb("alice", "new-viewer");
    const alice = doc(aliceWriter, path, "alice");
    const bob = doc(bobWriter, path, "bob");
    await setDoc(alice, payload(0));
    await assert.rejects(setDoc(doc(bobWriter, path, "alice"), payload(999)), /permission-denied/, "actual Rules still deny writing another rider");
    releases.push(onSnapshot(collection(oldViewer, path), consume("baseline"), (e) => errors.push(e)));
    releases.push(onSnapshot(livePublicationRidesQuery(collection(newViewer, path), "alice"), consume("filtered"), (e) => errors.push(e)));
    await waitFor(() => baseline?.length === 1 && filtered?.length === 0, "initial queries");
    baselineChanges = 0; filteredChanges = 0; baselineDeliveries = 0; filteredDeliveries = 0;
    for (let n = 1; n <= 20; n++) {
      await setDoc(alice, payload(n));
      await waitFor(() => baseline?.find((r) => r.uid === "alice")?.distMeters === n, "self remote write");
    }
    await delay(200);
    assert.equal(baselineChanges, 20);
    assert.equal(filteredChanges, 0, "own updates must not cause a server document delivery");
    const solo = { baselineChanges, filteredChanges, baselineDeliveries, filteredDeliveries };
    const peerPackets = [];
    for (const [n, phase, publicationId] of [
      [21, "live", "publication-a"], [22, "live", "publication-a"],
      [23, "paused", "publication-a"], [24, "live", "publication-a"],
      [25, "completed", "publication-a"], [26, "live", "publication-b"],
    ]) {
      await setDoc(bob, payload(n, phase, publicationId));
      await waitFor(() => baseline?.find((r) => r.uid === "bob")?.distMeters === n && filtered?.find((r) => r.uid === "bob")?.distMeters === n, "other rider event");
      assert.deepEqual(filtered, baseline.filter((r) => r.uid !== "alice"));
      const packet = (rows) => {
        const row = rows.find((r) => r.uid === "bob");
        return trailLiveRowToPeerMotionPacket({ ...row, lastSeenAtMs: row.lastSeenAt.toMillis() }, publicationId, 1000);
      };
      assert.deepEqual(packet(filtered), packet(baseline), "FS-only / RTDB outage fallback has identical native distance, phase and timestamp");
      peerPackets.push(packet(filtered));
    }
    await deleteDoc(bob);
    await waitFor(() => filtered?.length === 0 && baseline?.length === 1, "peer deletion");
    // While the new viewer is offline, change the other rider. Reconnect must deliver its latest complete row.
    await disableNetwork(newViewer);
    await setDoc(bob, payload(30));
    await waitFor(() => baseline?.some((r) => r.uid === "bob" && r.distMeters === 30), "baseline rejoin");
    await enableNetwork(newViewer);
    await waitFor(() => filtered?.some((r) => r.uid === "bob" && r.distMeters === 30), "filtered reconnect");
    assert.deepEqual(filtered, baseline.filter((r) => r.uid !== "alice"));
    assert.deepEqual(errors, []);
    const evidence = {
      scope: "Firestore emulator remote SDK listeners; document changes, NOT production billing",
      solo, peerPackets, peerEventsCompared: 6, deletion: true, offlineReconnect: true, rulesNegative: true,
    };
    const out = resolve(process.env.PEER_FS_EVIDENCE_DIR ?? "../../document/ops/20261029-peer-cost-quality/evidence");
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, "firestore-self-exclusion-emulator.json"), JSON.stringify(evidence, null, 2) + "\n");
    console.log(JSON.stringify(evidence));
  } finally {
    for (const release of releases) release();
    await Promise.all(databases.map((db) => terminate(db)));
    await Promise.all(apps.map((app) => deleteApp(app)));
    await vite.close();
  }
});
