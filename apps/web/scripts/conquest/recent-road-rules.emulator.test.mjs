import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, deleteDoc, terminate } from "firebase/firestore";
const require = createRequire(new URL("../../../../functions/package.json", import.meta.url));
const admin = require("firebase-admin/app");
const { getFirestore: adminFirestore } = require("firebase-admin/firestore");
const projectId = "demo-new-road-display";
const host = process.env.FIRESTORE_EMULATOR_HOST ?? "";
assert.match(host, /^127\.0\.0\.1:\d+$/, "emulator only");
test("recent road document is readable only by its owner and writable only by the server", async () => {
  const backend = admin.initializeApp({ projectId }, "recent-road-rules");
  const clients = [];
  try {
    const db = adminFirestore(backend);
    await db.doc("conquest/owner/recentNewRoad/current").set({ day: "2026-10-20", geometry: [{ path: [127,37.5,127,37.501] }] });
    function client(uid) {
      const app = initializeApp({ projectId, apiKey: "emulator" }, `rules-${uid ?? "unauth"}`);
      const store = getFirestore(app);
      connectFirestoreEmulator(store, "127.0.0.1", Number(host.split(":")[1]), uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
      clients.push({ app, store });
      return store;
    }
    const owner = client("owner");
    const other = client("other");
    const unauth = client(null);
    assert.equal((await getDoc(doc(owner, "conquest/owner/recentNewRoad/current"))).data().day, "2026-10-20");
    for (const store of [other, unauth]) await assert.rejects(getDoc(doc(store, "conquest/owner/recentNewRoad/current")), e => e.code === "permission-denied");
    await assert.rejects(setDoc(doc(owner, "conquest/owner/recentNewRoad/current"), { day: "2026-10-21" }), e => e.code === "permission-denied");
    await assert.rejects(deleteDoc(doc(owner, "conquest/owner/recentNewRoad/current")), e => e.code === "permission-denied");
  } finally {
    for (const { app, store } of clients) { await terminate(store); await deleteApp(app); }
    await admin.deleteApp(backend);
  }
});
